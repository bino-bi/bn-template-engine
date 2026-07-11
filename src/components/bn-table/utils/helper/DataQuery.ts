import { OrderDirection, TableType } from "../model";
import { QueryGroups } from "./QueryGroup";
import { coerceBucketKey, INTERVAL_NONE, intervalBucketSQL } from "./IntervalColumns";
import { TableAttribute } from "../model/TableAttribute";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { TableDrillGroup } from "../model/TableDrillGroup";
import { Order } from "../../../../components";
import { QueryColumnNames, VarianceScenario } from "../../../../utils/model";
import { DataQueryResultRow, DataQueryMetaRow } from "../../../../utils/model/DataQueryResultRow";
import { AlaSQLDatabase } from "../../../../context/scopedDb";

/**
 * AlaSQL-based query builder that produces the complete table result set for bn-table.
 *
 * Translates a {@link TableComponentConfig} into a series of SQL statements executed
 * against in-memory data rows. The pipeline handles scenario aggregation, row/column
 * grouping, drill-down expansion (thereof / partof), REST rows, sum rows, NaN detection,
 * column-level drill columns, and relative variance calculation.
 */
export class DataQuery {
  private readonly config: TableComponentConfig;
  private hasPartOf: boolean = false;
  private i18n: Map<string | number, string>;
  private db!: AlaSQLDatabase;
  private fromExpr!: string;

  constructor(config: TableComponentConfig, i18n: Map<string | number, string>) {
    this.config = config;
    this.i18n = i18n;
  }

  /**
   * Executes the full query pipeline and returns a segmented result set.
   *
   * Pipeline steps:
   * 1. Translate scenario columns into SQL aggregation expressions
   * 2. Run a meta query to discover row groups and their category counts
   * 3. For each group: generate header row, data rows, REST overflow row, and group sum row
   * 4. Append a total sum row (if table type requires it)
   * 5. Execute all accumulated SQL statements against the input data
   * 6. Detect NaN cells (aggregated cells with zero contributing rows)
   * 7. Inject thereof/partof drill rows and column-level drill columns
   * 8. Calculate REST columns (parent minus drilled children)
   * 9. Divide absolute variances by their denominator to produce relative variances
   *
   * @param db - The shared alasql database.
   * @param fromExpr - SQL FROM-clause expression naming the source table or filtered view.
   * @returns Array of row-group segments; each segment is an array of result rows.
   */
  public execute(db: AlaSQLDatabase, fromExpr: string): DataQueryResultRow[][] {
    this.db = db;
    this.fromExpr = fromExpr;

    const queries: string[] = [];
    const sumGroupQueries: string[] = [];
    const res: DataQueryResultRow[][] = [];

    const scenarios = this.config.scenarios
      .map((s) => this.translateScenarioSQL(s, false, this.config.type))
      .toString();
    const scenariosSUMQuery = this.config.scenarios
      .map((s) => this.translateScenarioSQL(s, true, this.config.type))
      .toString();
    const relativeScenarios = this.getRelativeScenarios();

    const attributesSQL = this.config.attributes.map((attribute) => this.translateAttributeSQL(attribute)).toString();

    const groups: QueryGroups = new QueryGroups(this.config);
    const groupsAggregated = this.config.grouped ? [QueryColumnNames.ROWGROUP, QueryColumnNames.ROWGROUPINDEX] : [];

    let order: [string, string] = ["", ""];
    if (this.config.sortOrder.hierarchy.length > 0) {
      order = this.createOrderString(this.config.sortOrder);
    }

    this.hasPartOf = this.checkConfigForPartOf();

    // meta defines groups and the number detail rows in each group
    // Bsp:  0: Object { totalrowcnt: 7, rowgroup: "Umsatz" }
    let meta: DataQueryResultRow[];
    try {
      meta = db.exec<DataQueryResultRow[]>(
        `SELECT COUNT(DISTINCT ${QueryColumnNames.CATEGORY}) as ${QueryColumnNames.TOTALROWCOUNT} ${groupsAggregated.length > 0 ? "," + groupsAggregated : ""}
                       FROM ${fromExpr} ${groupsAggregated.length > 0 ? "GROUP BY " + groupsAggregated : ""}
                       ORDER BY ${order[0]}`,
      );
    } catch (e) {
      console.error("DataQuery: meta query failed", e);
      return [];
    }
    if (
      meta.length === 0 ||
      (meta.length === 1 && (meta[0][QueryColumnNames.TOTALROWCOUNT] ?? 0) === 0 && groupsAggregated.length === 0)
    ) {
      return [];
    }

    // Creates DataSelection for LIST
    (meta as unknown as DataQueryMetaRow[]).forEach((rowGroupEntry: DataQueryMetaRow) => {
      // the following variables are 'helper sections' which are used to constuct dynamicly the sql statement depending of the given config
      // is grouping active?
      const queryWhereSection: string =
        rowGroupEntry.rowGroup && rowGroupEntry.rowGroup.length > 0
          ? `WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'`
          : ``;
      // is limit active?
      let queryLimitSection: string = "";
      if (this.config.limit) {
        queryLimitSection = `LIMIT ${this.config.limit}`;
      }

      this.createGroupHeaderRow(rowGroupEntry, queries);
      this.createDataRow(
        queries,
        rowGroupEntry,
        groups,
        scenarios,
        attributesSQL,
        queryWhereSection,
        order,
        queryLimitSection,
      );
      this.createRestRow(rowGroupEntry, queries, groups, scenarios, queryWhereSection, order);
      this.createGroupSumRow(queries, sumGroupQueries, rowGroupEntry, scenariosSUMQuery, order);
    });

    this.createTotalSumRow(queries, sumGroupQueries, scenariosSUMQuery);

    // executes main queries
    queries.forEach((query) => {
      try {
        res.push(db.exec<DataQueryResultRow[]>(query));
      } catch (err) {
        console.error("DataQuery: SQL query execution failed", query, err);
      }
    });

    this.detectNaNCells(this.config.scenarios, res);
    this.createThereOfDrillRows(scenarios, attributesSQL, order, res);
    this.createPartOfDrillRows(scenarios, order, sumGroupQueries, res);

    this.createIntervalColumns(res);

    this.createThereOfDrillColumns(this.config.categoryThereOf, res);

    this.calculateColumnGroupRest(res, this.config.categoryThereOf);
    this.calculateRelativeVariances(res, relativeScenarios);

    return res;
  }

  /**
   * Marks aggregated cells as NaN when no source rows contributed to the sum.
   *
   * Without this step, SUM() over zero matching rows would produce 0, which is
   * misleading -- it would be indistinguishable from an actual zero value.
   * Each scenario column has a companion `_cnt` counter; when that counter is 0
   * the cell is overwritten with NaN. For variance scenarios, both base and delta
   * counters must be non-zero.
   */
  detectNaNCells(scenarios: string[], res: DataQueryResultRow[][]) {
    res.forEach((group) => {
      group.map((row: DataQueryResultRow) => {
        scenarios.forEach((scenario: string) => {
          const varianceScenario = new VarianceScenario(scenario);

          if (varianceScenario.isValid === true) {
            if (row[varianceScenario.base + "_cnt"] === 0 || row[varianceScenario.delta + "_cnt"] === 0) {
              row[scenario] = Number.NaN;
            }
          } else {
            if (row[scenario + "_cnt"] === 0) {
              row[scenario] = Number.NaN;
            }
          }
        });
        return row;
      });
    });
  }

  /**
   * Creates "part-of" drill rows that express each category's value as a fraction
   * of its row group sum. Queries the drill subset, then divides each scenario
   * value by the corresponding group sum to produce a percentage.
   */
  createPartOfDrillRows(
    scenarios: string,
    order: [string, string],
    sumGroupQueries: string[],
    res: DataQueryResultRow[][],
  ) {
    if (this.config.partOf == null || this.config.partOf.length === 0 || this.config.type === TableType.LIST) {
      return;
    }

    const drillQueries = this.createPartOfQuery(scenarios, order);
    let resDrill: DataQueryResultRow[] = []; // set of drill (subquery result injected into resultset)

    const db = this.db;
    drillQueries.forEach(function (query) {
      resDrill.push(...db.exec<DataQueryResultRow[]>(query));
    });

    const scenarioNames = this.exctractScenarioNames(scenarios);
    const rowGroupSumResultRows: DataQueryResultRow[] = [];

    sumGroupQueries.forEach(function (query) {
      rowGroupSumResultRows.push(...db.exec<DataQueryResultRow[]>(query));
    });

    const rowGroupSumResultMap = new Map<string, DataQueryResultRow>();

    rowGroupSumResultRows.forEach((row) => rowGroupSumResultMap.set(row[QueryColumnNames.ROWGROUP], row));

    resDrill = this.reduceResDrillByCategoryGroups(resDrill, scenarioNames);

    resDrill.forEach(function (drillItem) {
      scenarioNames.forEach((key) => {
        try {
          drillItem[key] =
            (drillItem[key] as number) /
            ((rowGroupSumResultMap.get(drillItem[QueryColumnNames.ROWGROUP] as string) as DataQueryResultRow)[
              key
            ] as number);
        } catch (err) {
          console.error("DataQuery: partOf drill row calculation failed", key, err);
          drillItem[key] = Number.NaN;
        }
      });
    });

    this.injectDrillRowsToResultRows(resDrill, res);
  }

  /**
   * Generates a REST row that aggregates all data rows beyond the configured limit.
   * Only emitted when a limit is set and the group has more rows than the limit.
   */
  private createRestRow(
    rowGroupEntry: DataQueryMetaRow,
    querys: string[],
    groups: QueryGroups,
    scenarios: string,
    queryWhereSection: string,
    order: [string, string],
  ) {
    // Generates REST Row; sumsup the Bottom (total number of rows - limit)
    if (rowGroupEntry.totalRowCnt - this.config.limit > 0 && this.config.limit !== 0) {
      // sums every column the inner subquery produces (scenario values, _cnt companions, dr_* denominators)
      const restScenarios = this.exctractScenarioNames(scenarios)
        .map((name) => `SUM(${name}) as ${name}`)
        .join(", ");
      querys.push(
        `SELECT ${QueryColumnNames.ROWNR}, 1 as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, 'NO_GROUP' as ${QueryColumnNames.ROWGROUP}, 'REST' as ${QueryColumnNames.CATEGORY} ${restScenarios.length > 0 ? ", " + restScenarios : ""} FROM` +
          ` (SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, ${querys.length} as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, '${rowGroupEntry.rowGroup || "NO_GROUP"}' as ${QueryColumnNames.ROWGROUP}, ${groups} ${scenarios.length > 0 ? ",".concat(scenarios) : ""} FROM ${this.fromExpr} ${queryWhereSection} GROUP BY ${groups} ORDER BY ${order[0]})` +
          ` t WHERE t.rowNr > ${this.config.limit}`,
      );
    }
  }

  /** Generates the main data rows for a single row group, applying GROUP BY, ORDER, and LIMIT. */
  private createDataRow(
    querys: string[],
    rowGroupEntry: DataQueryMetaRow,
    groups: QueryGroups,
    scenarios: string,
    attributes: string,
    queryWhereSection: string,
    order: [string, string],
    queryLimitSection: string,
  ) {
    // Generates DataRows
    querys.push(`SELECT ROWNUM()                                  AS ${QueryColumnNames.ROWNR},
                        ${querys.length}                          as ${QueryColumnNames.ROWGROUPINDEX},
                        'ENTRY'                                   as ${QueryColumnNames.TYPE},
                        '${rowGroupEntry.rowGroup || "NO_GROUP"}' as ${QueryColumnNames.ROWGROUP},
                        '${QueryColumnNames.CATEGORYINDEX}',
                        ${groups}                                    ${scenarios.length > 0 ? ",".concat(scenarios) : ""} ${attributes.length > 0 ? ",".concat(attributes) : ""}
                 FROM ${this.fromExpr} ${queryWhereSection}
                 GROUP BY ${groups}
                 ORDER BY ${order[0]} ${queryLimitSection}`);
  }

  /** Generates a GROUPHEAD row used as a visual header when row grouping is active. */
  private createGroupHeaderRow(rowGroupEntry: DataQueryMetaRow, querys: string[]) {
    // Generates GroupHeader Row
    if (true === this.config.grouped) {
      const groupTitle: string = this.config.showGroupTitle
        ? `,'${rowGroupEntry.rowGroup}' as ${QueryColumnNames.CATEGORY}`
        : "";
      querys.push(`SELECT ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          'GROUPHEAD'                 as ${QueryColumnNames.TYPE},
                          '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP} ${groupTitle}
                   FROM ${this.fromExpr}
                   GROUP BY '1'`);
    }
  }

  /** Generates a GROUP_SUM row that aggregates all entries within a single row group. */
  private createGroupSumRow(
    querys: string[],
    groupSumQuery: string[],
    rowGroupEntry: DataQueryMetaRow,
    scenariosSUMQuery: string,
    order: [string, string],
  ) {
    // Generates SUM Row; sumsup all rows of group
    if (
      true === this.config.grouped &&
      (TableType.SUM === this.config.type ||
        TableType.SUMNOTOTAL === this.config.type ||
        TableType.OPT === this.config.type ||
        TableType.OPTNOTOTAL === this.config.type)
    ) {
      querys.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          '='                         as ${QueryColumnNames.OPERATION},
                          '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP},
                          ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ${this.fromExpr}
                   WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                   ORDER BY ${order[0]} `);
      groupSumQuery.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                                 '='                         as ${QueryColumnNames.OPERATION},
                                 '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP},
                                 ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                                 'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ${this.fromExpr}
                          WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                          ORDER BY ${order[0]} `);
    }
  }

  /** Generates a total SUM row across all groups (only for SUM / OPT table types). */
  private createTotalSumRow(querys: string[], sumGroupQueries: string[], scenariosSUMQuery: string) {
    if (TableType.SUM === this.config.type || TableType.OPT === this.config.type) {
      const title = `${this.hasPartOf && this.config.grouped === false ? `${this.i18n.get("SUM_TOTAL") || "SUM_TOTAL"} ` : ""}${this.config.title}`;

      querys.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                          '${title}'       as ${QueryColumnNames.ROWGROUP},
                          '='              as ${QueryColumnNames.OPERATION},
                          'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ${this.fromExpr}  `);
    }
    sumGroupQueries.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                                 'SUM_TOTAL'      as ${QueryColumnNames.ROWGROUP},
                                 '='              as ${QueryColumnNames.OPERATION},
                                 'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ${this.fromExpr}  `);
  }

  /**
   * Manually merges drill rows that AlaSQL fails to aggregate correctly.
   * Groups by composite key (rowNr + rowGroup + type + category) and sums scenario values.
   */
  private reduceResDrillByCategoryGroups(resDrill: DataQueryResultRow[], scenarioNames: string[]) {
    // This is workarround because alasql is not merging the rows as expected.
    const tmpSumMap = new Map();
    resDrill.forEach(function (drillItem) {
      const key = drillItem.rowNr + drillItem.rowGroup + drillItem.type + drillItem.category;
      if (tmpSumMap.has(key)) {
        const element = tmpSumMap.get(key);
        scenarioNames.forEach((key) => {
          try {
            element[key] += drillItem[key];
          } catch (e) {
            console.error("DataQuery: drill row aggregation failed", key, e);
          }
        });
      } else {
        tmpSumMap.set(key, drillItem);
      }
    });

    return [...tmpSumMap.values()];
  }

  /**
   * Inserts drill (thereof/partof) rows into the result set directly after their
   * parent category row. Handles both grouped and ungrouped modes, disambiguating
   * duplicate subCategory names by appending the rowGroup in parentheses.
   */
  private injectDrillRowsToResultRows(resDrill: DataQueryResultRow[], res: DataQueryResultRow[][]) {
    // resDrill = resDrill.reverse();
    const numberOfElement = new Map<string, number>();
    if (this.config.grouped === true) {
      // finds ParentElement of Drill Element and injects into result arra
      resDrill.forEach(function (drillItem) {
        res.forEach(function (resSegment) {
          const index = resSegment.findIndex(
            (e: DataQueryResultRow) => e.category === drillItem.category && e.rowGroup === drillItem.rowGroup,
          );

          if (index >= 0) {
            if (numberOfElement.has(`${drillItem.category}_${drillItem.rowGroup}`)) {
              const num = numberOfElement.get(`${drillItem.category}_${drillItem.rowGroup}`) || 0;
              numberOfElement.set(`${drillItem.category}_${drillItem.rowGroup}`, num + 1);
            } else {
              numberOfElement.set(`${drillItem.category}_${drillItem.rowGroup}`, 1);
            }

            drillItem[QueryColumnNames.ROWNR] = numberOfElement.get(`${drillItem.category}_${drillItem.rowGroup}`);
            resSegment.splice(index + drillItem[QueryColumnNames.ROWNR], 0, drillItem);
          }
        });
      });
    } else {
      // if no grouped mode selected matching only searching for category not for groupname
      const duplicateSubCategoriesList = this.findDuplicateSubCategories(resDrill);

      resDrill.forEach(function (drillItem) {
        res.forEach(function (resSegment) {
          const index = resSegment.findIndex(
            (e: DataQueryResultRow) => e.category != null && e.category === drillItem.category,
          );

          if (index >= 0) {
            if (numberOfElement.has(`${drillItem.category}`)) {
              const num = numberOfElement.get(`${drillItem.category}`) || 0;
              numberOfElement.set(`${drillItem.category}`, num + 1);
            } else {
              numberOfElement.set(`${drillItem.category}`, 1);
            }

            if (drillItem[QueryColumnNames.ROWNR] === 1) {
              drillItem.subCategory = `${drillItem.subCategory} (${drillItem.rowGroup})`;
            } else if (duplicateSubCategoriesList.includes(drillItem.subCategory)) {
              drillItem.subCategory = `${drillItem.subCategory} (${drillItem.rowGroup})`;
            }

            resSegment.splice(index + drillItem[QueryColumnNames.ROWNR], 0, drillItem);
          }
        });
      });
    }
  }

  /**
   * Creates "thereof" drill rows -- sub-breakdowns shown with absolute values
   * beneath their parent category row. Each thereof config entry produces a
   * filtered/grouped SQL query whose results are spliced into the result set.
   */
  private createThereOfDrillRows(
    scenarios: string,
    attributes: string,
    order: [string, string],
    res: DataQueryResultRow[][],
  ) {
    // adds drill rows if setup in config
    // if there of is set drilldown row is displayed with absolute numbers,
    // if part of is also not null a relative percenatage based of the selected basis is displayed

    if (this.config.thereOf === undefined || this.config.thereOf.length === 0) {
      return;
    }

    const drillQueries: string[] = [];
    const resDrill: DataQueryResultRow[] = []; // set of drill (subquery result injected into resultset)
    // let rollgroups = ['category']; // frage wo kommt das her ?
    // create drill queryies based on config

    this.config.thereOf.forEach((element) => {
      let isFirst = true;
      let fromString = "1 <> 1 OR ( "; // helper for strin concat  1<>1 OR ... OR ...

      if (!(null == element.category || 0 === element.category.length || !element.category.trim())) {
        // if not empty
        fromString += ` ${QueryColumnNames.CATEGORY} = '${element.category}'`;
        isFirst = false;
      }

      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty

        fromString += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
        isFirst = false;
      }

      if (!(null == element.subCategory || 0 === element.subCategory.length || !element.subCategory.trim())) {
        // if not empty
        fromString += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.SUBCATEGORY} = '${element.subCategory}'`;
      }
      fromString += `)`;

      drillQueries.push(`SELECT ROWNUM()                     AS ${QueryColumnNames.ROWNR},
                                null                         as operation,
                                'DRILLELEMENT'               as ${QueryColumnNames.TYPE},
                                ${QueryColumnNames.CATEGORY},
                                ${QueryColumnNames.SUBCATEGORY},
                                ${QueryColumnNames.ROWGROUP} as ${QueryColumnNames.ROWGROUP},
                                ${scenarios} ${attributes.length > 0 ? ",".concat(attributes) : ""}
                         FROM ${this.fromExpr}
                         WHERE ${fromString}
                         GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}
                         ORDER BY ${order[1]}`);
    });

    const db = this.db;
    drillQueries.forEach(function (query) {
      resDrill.push(...db.exec<DataQueryResultRow[]>(query));
    });

    this.injectDrillRowsToResultRows(resDrill, res);
  }

  /**
   * Converts absolute variance columns into relative (percentage) variances by dividing
   * each `dr_*` cell by its denominator column (the delta scenario's aggregated value).
   */
  private calculateRelativeVariances(res: DataQueryResultRow[][], relativeScenarios: Map<string, string>) {
    res.forEach((group) => {
      group.forEach((row: DataQueryResultRow) => {
        if (row[QueryColumnNames.TYPE] !== "GROUPHEAD") {
          relativeScenarios.forEach((value: string, key: string) => {
            row[key] = (row[key] as number) / (row[value] as number);
          });
        }
      });
    });
  }

  /**
   * Calculates REST columns for column-level thereof drills.
   * REST = parent scenario value minus sum of all drilled child columns.
   * Columns where REST is zero across all rows are removed entirely.
   */
  private calculateColumnGroupRest(
    res: DataQueryResultRow[][],
    categoryThereOf: Map<string, Record<string, unknown>[]>,
  ) {
    if (categoryThereOf == null || categoryThereOf.size === 0) {
      return;
    }
    const scenarioRestMap: Map<string, string[]> = new Map();
    const scenarioRestHasValuesMap: Map<string, boolean> = new Map();

    categoryThereOf.forEach((value, key) => {
      const categoryDrills = value;
      const columnsList = [];
      for (const drillElement of categoryDrills) {
        columnsList.push(`${key}##${drillElement.name}`);
      }
      scenarioRestMap.set(key, columnsList);
      scenarioRestHasValuesMap.set(`${key}##REST`, false);
    });

    res.forEach((group) => {
      group.forEach((row: DataQueryResultRow) => {
        if (row[QueryColumnNames.TYPE] !== "GROUPHEAD") {
          scenarioRestMap.forEach((values, key) => {
            let minuent = 0;
            values.forEach((value: string) => {
              if (row[value] !== undefined) {
                minuent += row[value] as number;
              }
            });
            row[`${key}##REST`] = (row[key] as number) - minuent;

            if (row[`${key}##REST`] !== 0) {
              scenarioRestHasValuesMap.set(`${key}##REST`, true);
            }
          });
        }
      });
    });

    const emptyRestColumns: string[] = Array.from(scenarioRestHasValuesMap.entries())
      .filter(([_key, value]) => !value)
      .map(([key]) => key);

    res.forEach((group) => {
      group.forEach((row: DataQueryResultRow) => {
        for (const deleteColumn of emptyRestColumns) {
          delete row[deleteColumn];
        }
      });
    });
  }

  /**
   * Adds per-interval-bucket values to the result rows when the bn-table
   * `interval` attribute is active. Side queries aggregate the source rows per
   * bucket (`normalizeDate(date, …)` for date intervals, setname otherwise) at
   * every row level (ENTRY, GROUP_SUM, SUM, DRILLELEMENT, PARTELEMENT) and the
   * results are stored on the existing rows as composite keys
   * `<scenario>##<bucketKey>` — the same convention as the columnthereof drill
   * columns (which are mutually exclusive with interval).
   *
   * Row selection (ORDER BY / LIMIT) stays anchored on the un-bucketed base
   * queries, so every bucket shows the same category set. REST values are
   * computed in JS as the per-bucket sum of the categories that are not
   * displayed, matching the un-bucketed REST query semantics.
   */
  private createIntervalColumns(res: DataQueryResultRow[][]) {
    if (
      this.config.interval === INTERVAL_NONE ||
      this.config.categoryThereOf.size > 0 ||
      this.config.scenarios.length === 0
    ) {
      return;
    }

    const separator = "##";
    const bucketSource = `(SELECT *, ${intervalBucketSQL(this.config.interval)} as __interval FROM ${this.fromExpr}) as p`;
    const scenarios = this.config.scenarios
      .map((s) => this.translateScenarioSQL(s, false, this.config.type))
      .toString();
    const scenariosSUMQuery = this.config.scenarios
      .map((s) => this.translateScenarioSQL(s, true, this.config.type))
      .toString();
    const entryAliases = this.exctractScenarioNames(scenarios);
    const relativeScenarios = this.getRelativeScenarios();
    const groups = new QueryGroups(this.config);
    const isOpt = TableType.OPT === this.config.type || TableType.OPTNOTOTAL === this.config.type;
    const isSumTypeGrouped =
      this.config.grouped &&
      (TableType.SUM === this.config.type ||
        TableType.SUMNOTOTAL === this.config.type ||
        TableType.OPT === this.config.type ||
        TableType.OPTNOTOTAL === this.config.type);
    const hasPartOfActive = this.checkConfigForPartOf() && this.config.type !== TableType.LIST;

    const exec = (query: string): DataQueryResultRow[] => {
      try {
        return this.db.exec<DataQueryResultRow[]>(query);
      } catch (err) {
        console.error("DataQuery: interval query failed", query, err);
        return [];
      }
    };

    // mirrors detectNaNCells + calculateRelativeVariances for a single bucket row
    const finalizeBucketRow = (row: DataQueryResultRow): DataQueryResultRow => {
      this.config.scenarios.forEach((scenario) => {
        const varianceScenario = new VarianceScenario(scenario);
        if (varianceScenario.isValid === true) {
          if (row[varianceScenario.base + "_cnt"] === 0 || row[varianceScenario.delta + "_cnt"] === 0) {
            row[scenario] = Number.NaN;
          }
        } else if (row[scenario + "_cnt"] === 0) {
          row[scenario] = Number.NaN;
        }
      });
      relativeScenarios.forEach((value: string, key: string) => {
        row[key] = (row[key] as number) / (row[value] as number);
      });
      return row;
    };

    const writeBucketValues = (target: DataQueryResultRow, source: DataQueryResultRow, bucketKey: string) => {
      for (const scenario of this.config.scenarios) {
        target[scenario + separator + bucketKey] = source[scenario];
      }
    };

    const entryRowsRaw = exec(
      `SELECT ${groups}, __interval ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
       FROM ${bucketSource}
       GROUP BY ${groups}, __interval`,
    );

    // REST rows first: the math needs the raw (not yet finalized) entry aliases
    if (this.config.limit > 0) {
      for (let segmentIndex = 0; segmentIndex < res.length; segmentIndex++) {
        const restRow = res[segmentIndex].find((row) => row.type === "ENTRY" && row.category === "REST");
        if (!restRow) {
          continue;
        }

        // nearest preceding segment holding the displayed ENTRY rows
        let entrySegment: DataQueryResultRow[] | undefined;
        for (let i = segmentIndex - 1; i >= 0 && !entrySegment; i--) {
          const candidate = res[i].filter((row) => row.type === "ENTRY" && row.category !== "REST");
          if (candidate.length > 0) {
            entrySegment = candidate;
          }
        }
        if (!entrySegment) {
          continue;
        }

        const displayedCategories = new Set(entrySegment.map((row) => row.category));
        const restGroup = entrySegment[0].rowGroup;

        const restByBucket = new Map<string, DataQueryResultRow>();
        for (const entryRow of entryRowsRaw) {
          if (this.config.grouped && entryRow.rowGroup !== restGroup) {
            continue;
          }
          if (displayedCategories.has(entryRow.category as string)) {
            continue;
          }
          const bucketKey = coerceBucketKey(entryRow.__interval);
          let bucketSum = restByBucket.get(bucketKey);
          if (!bucketSum) {
            bucketSum = {};
            restByBucket.set(bucketKey, bucketSum);
          }
          for (const alias of entryAliases) {
            bucketSum[alias] = ((bucketSum[alias] as number) ?? 0) + ((entryRow[alias] as number) ?? 0);
          }
        }

        restByBucket.forEach((bucketSum, bucketKey) => {
          writeBucketValues(restRow, finalizeBucketRow(bucketSum), bucketKey);
        });
      }
    }

    for (const entryRow of entryRowsRaw) {
      const bucketKey = coerceBucketKey(entryRow.__interval);
      finalizeBucketRow(entryRow);
      for (const segment of res) {
        for (const row of segment) {
          if (row.type !== "ENTRY" || row.category === "REST" || row.category !== entryRow.category) {
            continue;
          }
          if (this.config.grouped && row.rowGroup !== entryRow.rowGroup) {
            continue;
          }
          if (isOpt && row.operation !== entryRow.operation) {
            continue;
          }
          writeBucketValues(row, entryRow, bucketKey);
        }
      }
    }

    const groupTotalRowsRaw =
      isSumTypeGrouped || (hasPartOfActive && this.config.grouped)
        ? exec(
            `SELECT ${QueryColumnNames.ROWGROUP}, __interval ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
             FROM ${bucketSource}
             GROUP BY ${QueryColumnNames.ROWGROUP}, __interval`,
          )
        : [];
    const groupTotalsByKey = new Map<string, DataQueryResultRow>();
    groupTotalRowsRaw.forEach((row) =>
      groupTotalsByKey.set(`${row.rowGroup}${separator}${coerceBucketKey(row.__interval)}`, row),
    );

    if (isSumTypeGrouped) {
      for (const totalRow of groupTotalRowsRaw) {
        const bucketKey = coerceBucketKey(totalRow.__interval);
        const finalized = finalizeBucketRow({ ...totalRow });
        for (const segment of res) {
          for (const row of segment) {
            if (row.type === "GROUP_SUM" && row.rowGroup === totalRow.rowGroup) {
              writeBucketValues(row, finalized, bucketKey);
            }
          }
        }
      }
    }

    const hasTotalSumRow = TableType.SUM === this.config.type || TableType.OPT === this.config.type;
    const sumTotalRowsRaw =
      hasTotalSumRow || (hasPartOfActive && !this.config.grouped)
        ? exec(
            `SELECT __interval ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
             FROM ${bucketSource}
             GROUP BY __interval`,
          )
        : [];
    const sumTotalsByBucket = new Map<string, DataQueryResultRow>();
    sumTotalRowsRaw.forEach((row) => sumTotalsByBucket.set(coerceBucketKey(row.__interval), row));

    if (hasTotalSumRow) {
      for (const totalRow of sumTotalRowsRaw) {
        const bucketKey = coerceBucketKey(totalRow.__interval);
        const finalized = finalizeBucketRow({ ...totalRow });
        for (const segment of res) {
          for (const row of segment) {
            if (row.type === "SUM") {
              writeBucketValues(row, finalized, bucketKey);
            }
          }
        }
      }
    }

    if (this.config.thereOf != null && this.config.thereOf.length > 0) {
      const drillRows: DataQueryResultRow[] = [];
      this.config.thereOf.forEach((element) => {
        drillRows.push(
          ...exec(
            `SELECT ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, __interval ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
             FROM ${bucketSource}
             WHERE ${this.createThereOfWhereClause(element)}
             GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, __interval`,
          ),
        );
      });

      for (const drillRow of drillRows) {
        const bucketKey = coerceBucketKey(drillRow.__interval);
        finalizeBucketRow(drillRow);
        for (const segment of res) {
          for (const row of segment) {
            if (row.type !== "DRILLELEMENT" || row.category !== drillRow.category) {
              continue;
            }
            if (
              row.subCategory !== drillRow.subCategory &&
              row.subCategory !== `${drillRow.subCategory} (${drillRow.rowGroup})`
            ) {
              continue;
            }
            writeBucketValues(row, drillRow, bucketKey);
          }
        }
      }
    }

    if (hasPartOfActive) {
      let partWhere = "1 <> 1 ";
      this.config.partOf?.forEach((element) => {
        partWhere += `OR (${QueryColumnNames.CATEGORY} = '${element.category}'`;
        if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
          partWhere += `and ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
        }
        partWhere += `)`;
      });

      const groupName = this.config.grouped
        ? `${QueryColumnNames.ROWGROUP}`
        : `'SUM_TOTAL' as ${QueryColumnNames.ROWGROUP}`;

      const partRowsRaw = exec(
        `SELECT ${QueryColumnNames.CATEGORY}, ${groupName}, __interval ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
         FROM ${bucketSource}
         WHERE ${partWhere}
         GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, __interval`,
      );

      // merge rows sharing (rowGroup, category, bucket) — mirrors reduceResDrillByCategoryGroups
      const partByKey = new Map<string, DataQueryResultRow>();
      for (const partRow of partRowsRaw) {
        const key = `${partRow.rowGroup}${separator}${partRow.category}${separator}${coerceBucketKey(partRow.__interval)}`;
        const existing = partByKey.get(key);
        if (existing) {
          for (const alias of entryAliases) {
            existing[alias] = ((existing[alias] as number) ?? 0) + ((partRow[alias] as number) ?? 0);
          }
        } else {
          partByKey.set(key, partRow);
        }
      }

      partByKey.forEach((partRow) => {
        const bucketKey = coerceBucketKey(partRow.__interval);
        const totals = this.config.grouped
          ? groupTotalsByKey.get(`${partRow.rowGroup}${separator}${bucketKey}`)
          : sumTotalsByBucket.get(bucketKey);

        for (const alias of entryAliases) {
          partRow[alias] = (partRow[alias] as number) / (totals ? (totals[alias] as number) : Number.NaN);
        }

        finalizeBucketRow(partRow);
        for (const segment of res) {
          for (const row of segment) {
            if (row.type === "PARTELEMENT" && row.category === partRow.category && row.rowGroup === partRow.rowGroup) {
              writeBucketValues(row, partRow, bucketKey);
            }
          }
        }
      });
    }
  }

  /** Builds the thereof filter for interval side queries (mirrors the WHERE construction in createThereOfDrillRows). */
  private createThereOfWhereClause(element: TableDrillGroup): string {
    let isFirst = true;
    let whereClause = "1 <> 1 OR ( ";

    if (!(null == element.category || 0 === element.category.length || !element.category.trim())) {
      whereClause += ` ${QueryColumnNames.CATEGORY} = '${element.category}'`;
      isFirst = false;
    }

    if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
      whereClause += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
      isFirst = false;
    }

    if (!(null == element.subCategory || 0 === element.subCategory.length || !element.subCategory.trim())) {
      whereClause += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.SUBCATEGORY} = '${element.subCategory}'`;
    }

    return whereClause + `)`;
  }

  /** Collects all relative variance scenarios and maps each to its denominator column name. */
  private getRelativeScenarios() {
    const relativeScenarios = new Map();

    this.config.scenarios.forEach((s) => {
      const tmp = this.createRelativeScenario(s);
      if (tmp != null) {
        relativeScenarios.set(tmp.key, tmp.value);
      }
    });

    return relativeScenarios;
  }

  /**
   * Translates a scenario identifier into a SQL aggregation expression.
   *
   * - **OPT/OPTNOTOTAL types**: Values are summed without `transformOperator` (the
   *   operation sign is already baked into the data). Variance scenarios produce
   *   `SUM(base - delta)`.
   * - **Other types**: Each value is multiplied by `transformOperator(operation)` which
   *   converts the `"+"` / `"-"` operation field into +1 / -1, so rows with negative
   *   operation are subtracted from the aggregate.
   * - **Relative variances** (`dr_*`): additionally select the delta denominator column
   *   so `calculateRelativeVariances` can divide later.
   * - A companion `_cnt` column (COUNT of non-null values) is emitted for NaN detection.
   */
  private translateScenarioSQL(scenario: string, isSumRow: boolean, type: TableType): string {
    const scenarios = new VarianceScenario(scenario);

    if (TableType.OPT === type || TableType.OPTNOTOTAL === type) {
      if (scenarios.isValid) {
        if (scenarios.type === "dr") {
          return `SUM(${scenarios.base} - ${scenarios.delta}) as ${scenario}, SUM(${scenarios.delta}) as dr_${scenarios.delta}`;
        } else {
          return `SUM(${scenarios.base} - ${scenarios.delta}) as ${scenario}`;
        }
      }

      if (isSumRow) {
        return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
      }

      return `SUM(${scenario}) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
    }

    if (scenarios.isValid) {
      if (scenarios.type === "dr") {
        return `SUM((${scenarios.base}  * transformOperator(operation)) - (${scenarios.delta}  * transformOperator(operation))) as ${scenario}, SUM(${scenarios.delta} * transformOperator(operation)) as dr_${scenarios.delta}`;
      } else {
        return `SUM((${scenarios.base}  * transformOperator(operation))- (${scenarios.delta} * transformOperator(operation))) as ${scenario}`;
      }
    }

    return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
  }

  /**
   * Translates an attribute definition into a SQL aggregate expression aliased
   * to the attribute's safe column alias (`attr_N`).
   *
   * `sum`/`avg` on scenario fields respect the row operation sign via
   * `transformOperator`, consistent with {@link translateScenarioSQL}; for
   * OPT/OPTNOTOTAL types the sign is already baked into the data.
   */
  private translateAttributeSQL(attribute: TableAttribute): string {
    const field = `[${attribute.arg}]`;
    const isScenarioField = /^(ac|pp|fc|pl)[1-4]$/.test(attribute.arg);
    const useOperator =
      isScenarioField && this.config.type !== TableType.OPT && this.config.type !== TableType.OPTNOTOTAL;

    switch (attribute.fn) {
      case "set":
        return `SETAGG(${field}) as ${attribute.alias}`;
      case "first":
        return `FIRST(${field}) as ${attribute.alias}`;
      case "last":
        return `LAST(${field}) as ${attribute.alias}`;
      case "min":
        return `MIN(${field}) as ${attribute.alias}`;
      case "max":
        return `MAX(${field}) as ${attribute.alias}`;
      case "avg":
        return useOperator
          ? `AVG(${field} * transformOperator(operation)) as ${attribute.alias}`
          : `AVG(${field}) as ${attribute.alias}`;
      case "sum":
        return useOperator
          ? `SUM(${field} * transformOperator(operation)) as ${attribute.alias}`
          : `SUM(${field}) as ${attribute.alias}`;
      case "lit":
        return `${this.sqlLiteral(attribute.arg)} as ${attribute.alias}`;
    }
  }

  /** Emits a raw lit() argument as a SQL literal: numeric when parseable, quoted string otherwise. */
  private sqlLiteral(raw: string): string {
    return raw !== "" && !Number.isNaN(Number(raw)) ? raw : `'${raw.replace(/'/g, "''")}'`;
  }

  /**
   * generates Tuple
   *  [0] orderby string example:   category asc
   *  [1] inverted order example:   category desc
   * @param orderComponent
   */
  private createOrderString(orderComponent: Order): [string, string] {
    const base = `${orderComponent.hierarchy.toString()} ${orderComponent.direction}`;
    const inverted = `${orderComponent.hierarchy.toString()} ${OrderDirection.ASC === orderComponent.direction ? OrderDirection.DESC : OrderDirection.ASC}`;
    return [base, inverted];
  }

  /** Returns a key/value pair mapping a relative variance column to its denominator, or null for non-relative scenarios. */
  private createRelativeScenario(scenario: string) {
    const scenarios = new VarianceScenario(scenario);

    if (scenarios.isValid && scenarios.type === "dr") {
      return { key: `${scenario}`, value: `dr_${scenarios.delta}` };
    }

    return null;
  }

  /** Parses the comma-separated SQL scenario fragment to extract the alias names (the part after `as`). */
  private exctractScenarioNames(scenarios: string): string[] {
    const scenarioNames: string[] = [];
    scenarios.split(",").forEach((item) => (item.length >= 2 ? scenarioNames.push(item.split("as")[1].trim()) : null));
    return scenarioNames;
  }

  /** Identifies subCategory values that appear more than once in the drill set, requiring disambiguation. */
  private findDuplicateSubCategories(resDrill: DataQueryResultRow[]): string[] {
    const uniq = resDrill
      .map((element) => {
        return {
          count: 1,
          subCategory: element.subCategory,
        };
      })
      .reduce((a: Record<string, number>, b: { subCategory: string; count: number }) => {
        a[b.subCategory] = (a[b.subCategory] || 0) + b.count;
        return a;
      }, {});

    return Object.keys(uniq).filter((a) => uniq[a] > 1);
  }

  /** Builds the SQL query for partof drill rows, filtering to configured partOf categories. */
  private createPartOfQuery(scenarios: string, order: [string, string]): string[] {
    const drillQueries = [];
    let fromString = "1 <> 1 "; // helper for strin concat  1<>1 OR ... OR ...
    let groupName = ` ${QueryColumnNames.ROWGROUP}`;
    let rowNum = "ROWNUM()";

    this.config.partOf?.forEach((element) => {
      fromString += `OR (${QueryColumnNames.CATEGORY} = '${element.category}'`;
      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty
        fromString += `and ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
      }

      if (this.config.grouped === false) {
        groupName = ` 'SUM_TOTAL'  as ${QueryColumnNames.ROWGROUP} `;
        rowNum = "1";
      }

      fromString += `)`;
    });

    // let dimensionGroups = `${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, ${QueryColumnNames.ROWGROUP}`;
    // invertet Sort directon because the later used insertion which results into expected order direction
    drillQueries.push(`SELECT ${rowNum}     AS ${QueryColumnNames.ROWNR},
                              'PARTELEMENT' as ${QueryColumnNames.TYPE},
                              ${QueryColumnNames.CATEGORY},
                              ${groupName},
                              ${scenarios}
                       FROM ${this.fromExpr}
                       WHERE ${fromString}
                       GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.TYPE}
                       ORDER BY ${order[1]}`);

    return drillQueries;
  }

  private checkConfigForPartOf() {
    if (this.config.partOf == null || this.config.partOf.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Creates column-level thereof drill breakdowns for the configured `categoryThereOf` map.
   *
   * For each scenario key, queries are generated at multiple aggregation levels
   * (ENTRY, DRILLELEMENT, GROUP_SUM, SUM) crossed with column dimensions
   * (COLUMNGROUP, SUBGROUP). Results are stored as new properties on existing
   * result rows using the `"##"` separator convention: `scenario##columnGroup` or
   * `scenario##columnGroup##columnSubGroup`.
   */
  private createThereOfDrillColumns(
    categoryThereOf: Map<string, Record<string, unknown>[]>,
    res: DataQueryResultRow[][],
  ) {
    if (categoryThereOf == null || categoryThereOf.size === 0) {
      return;
    }

    const drillQueries: string[] = [];
    const resDrill: DataQueryResultRow[] = [];
    const fromExpr = this.fromExpr;

    categoryThereOf.forEach((value, key) => {
      let whereClause = "1 <> 1 ";
      value.forEach((drillColumn: Record<string, unknown>) => {
        whereClause += ` or columnGroup = '${drillColumn.name}' `;
      });

      drillQueries.push(`SELECT 'ENTRY'                                    as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                category,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, columnGroup, scenario`);
      drillQueries.push(`SELECT 'ENTRY'                                    as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                category,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'DRILLELEMENT'                             as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                category,
                                subCategory,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, subCategory, columnGroup, scenario`);
      drillQueries.push(`SELECT 'DRILLELEMENT'                             as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                category,
                                subCategory,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, subCategory, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, scenario`);
      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, scenario`);
      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ${fromExpr}
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, columnSubGroup, scenario`);
    });

    for (const query of drillQueries) {
      resDrill.push(...this.db.exec<DataQueryResultRow[]>(query));
    }

    this.injectDrillColumnsToResultRows(resDrill, res);
  }

  /**
   * Merges column-drill query results into existing result rows by matching
   * row type, category, subCategory, and rowGroup. Uses the `"##"` separator
   * to form composite property keys for drill column values.
   */
  private injectDrillColumnsToResultRows(resDrill: DataQueryResultRow[], res: DataQueryResultRow[][]) {
    const separator = "##";
    for (const drillElement of resDrill) {
      for (const tableSegment of res) {
        for (const row of tableSegment) {
          if (row.type !== drillElement.rowlevel) {
            continue;
          }

          if ("ENTRY" === drillElement.rowlevel) {
            if (drillElement.columnlevel === "COLUMNGROUP" && row.category === drillElement.category) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (drillElement.columnlevel === "SUBGROUP" && row.category === drillElement.category) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("DRILLELEMENT" === drillElement.rowlevel) {
            if (
              drillElement.columnlevel === "COLUMNGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (
              drillElement.columnlevel === "SUBGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            } else if (
              drillElement.columnlevel === "COLUMNGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === `${drillElement.subCategory} (${drillElement.rowGroup})`
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (
              drillElement.columnlevel === "SUBGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === `${drillElement.subCategory} (${drillElement.rowGroup})`
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("SUM" === drillElement.rowlevel) {
            if (
              drillElement.columnlevel === "COLUMNGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (
              drillElement.columnlevel === "SUBGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("GROUP_SUM" === drillElement.rowlevel) {
            if (
              drillElement.columnlevel === "COLUMNGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (
              drillElement.columnlevel === "SUBGROUP" &&
              row.category === drillElement.category &&
              row.subCategory === drillElement.subCategory
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          }
        }
      }
    }
  }
}
