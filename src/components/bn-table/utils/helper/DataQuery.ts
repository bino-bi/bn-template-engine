import alasql from "alasql";
import { OrderDirection, TableType } from "../model";
import { QueryGroups } from "./QueryGroup";
// import {QueryColumnNames, VarianceScenario} from "../../../../utils/model";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { TableDataRow } from "../model/TableDataRow";
import { Order } from "../../../../components";
import { QueryColumnNames, VarianceScenario } from "../../../../utils/model";
// import {Order} from "../../../../utils/model/Order"; // FIXME IOrder
import { DataQueryResultRow, DataQueryMetaRow } from "../../../../utils/model/DataQueryResultRow";

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
   * @returns Array of row-group segments; each segment is an array of result rows.
   */
  public execute(data: TableDataRow[]): DataQueryResultRow[][] {
    if (data.length == 0) {
      return [];
    }

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

    const groups: QueryGroups = new QueryGroups(this.config);
    const groupsAggregated = this.config.grouped ? [QueryColumnNames.ROWGROUP, QueryColumnNames.ROWGROUPINDEX] : [];

    let order: [string, string] = ["", ""];
    if (this.config.order.hierarchy.length > 0) {
      order = this.createOrderString(this.config.order);
    }

    this.hasPartOf = this.checkConfigForPartOf();

    // meta defines groups and the number detail rows in each group
    // Bsp:  0: Object { totalrowcnt: 7, rowgroup: "Umsatz" }
    const meta = alasql<DataQueryResultRow[]>(
      `SELECT COUNT(DISTINCT ${QueryColumnNames.CATEGORY}) as ${QueryColumnNames.TOTALROWCOUNT} ${groupsAggregated.length > 0 ? "," + groupsAggregated : ""}
                       FROM ? ${groupsAggregated.length > 0 ? "GROUP BY " + groupsAggregated : ""}  
                       ORDER BY ${order[0]}`,
      [data],
    );

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
      this.createDataRow(queries, rowGroupEntry, groups, scenarios, queryWhereSection, order, queryLimitSection);
      this.createRestRow(rowGroupEntry, queries, groups, scenarios, queryWhereSection, order);
      this.createGroupSumRow(queries, sumGroupQueries, rowGroupEntry, scenariosSUMQuery, order);
    });

    this.createTotalSumRow(queries, sumGroupQueries, scenariosSUMQuery);

    // executes main queries
    queries.forEach((query) => {
      try {
        res.push(alasql(query, [data]));
      } catch (err) {
        console.error("DataQuery: SQL query execution failed", query, err);
      }
    });

    this.detectNaNCells(this.config.scenarios, res);
    this.createThereOfDrillRows(scenarios, order, data, res);
    this.createPartOfDrillRows(scenarios, order, sumGroupQueries, data, res);

    this.createThereOfDrillColumns(this.config.categoryThereOf, data, res);

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

          if (varianceScenario.isValid == true) {
            if (row[varianceScenario.base + "_cnt"] == 0 || row[varianceScenario.delta + "_cnt"] == 0) {
              row[scenario] = Number.NaN;
            }
          } else {
            if (row[scenario + "_cnt"] == 0) {
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
    data: TableDataRow[],
    res: DataQueryResultRow[][],
  ) {
    if (
      this.config.partOf == null ||
      this.config.partOf.length == 0 ||
      this.config.type == TableType.LIST ||
      data == null ||
      data.length == 0
    ) {
      return;
    }

    let drillQueries = [];
    let resDrill: DataQueryResultRow[] = []; // set of drill (subquery result injected into resultset)

    if (this.config.type == TableType.OPT || this.config.type == TableType.OPTNOTOTAL) {
      drillQueries = this.createPartOfQuery(scenarios, order);
    } else {
      drillQueries = this.createPartOfQuery(scenarios, order);
    }

    drillQueries.forEach(function (query) {
      resDrill.push(...alasql<DataQueryResultRow[]>(query, [data]));
    });

    const scenarioNames = this.exctractScenarioNames(scenarios);
    const rowGroupSumResultRows: DataQueryResultRow[] = [];

    sumGroupQueries.forEach(function (query) {
      rowGroupSumResultRows.push(...alasql<DataQueryResultRow[]>(query, [data]));
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
      const rest_scenarios =
        ", SUM(ac1) as ac1, SUM(pp1) as pp1, SUM(dpp1_ac1_pos) as dpp1_ac1_pos, SUM(drpp1_ac1_pos) as drpp1_ac1_pos, SUM(dr_pp1)";
      querys.push(
        `SELECT ${QueryColumnNames.ROWNR}, 1 as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, 'NO_GROUP' as ${QueryColumnNames.ROWGROUP}, 'REST' as ${QueryColumnNames.CATEGORY} ${rest_scenarios} as dr_pp1 FROM` +
          ` (SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, ${querys.length} as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, '${rowGroupEntry.rowGroup || "NO_GROUP"}' as ${QueryColumnNames.ROWGROUP}, ${groups} ${scenarios.length > 0 ? ",".concat(scenarios) : ""} FROM ? ${queryWhereSection} GROUP BY ${groups} ORDER BY ${order[0]})` +
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
                        ${groups}                                    ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
                 FROM ? ${queryWhereSection}
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
                   FROM ?
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
                   FROM ?
                   WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                   ORDER BY ${order[0]} `);
      groupSumQuery.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                                 '='                         as ${QueryColumnNames.OPERATION},
                                 '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP},
                                 ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                                 'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ?
                          WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                          ORDER BY ${order[0]} `);
    }
  }

  /** Generates a total SUM row across all groups (only for SUM / OPT table types). */
  private createTotalSumRow(querys: string[], sumGroupQueries: string[], scenariosSUMQuery: string) {
    if (TableType.SUM === this.config.type || TableType.OPT === this.config.type) {
      const title = `${this.hasPartOf && this.config.grouped == false ? `${this.i18n.get("SUM_TOTAL") || "SUM_TOTAL"} ` : ""}${this.config.title}`;

      querys.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                          '${title}'       as ${QueryColumnNames.ROWGROUP},
                          '='              as ${QueryColumnNames.OPERATION},
                          'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ?  `);
    }
    sumGroupQueries.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                                 'SUM_TOTAL'      as ${QueryColumnNames.ROWGROUP},
                                 '='              as ${QueryColumnNames.OPERATION},
                                 'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ?  `);
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

            if (drillItem[QueryColumnNames.ROWNR] == 1) {
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
    order: [string, string],
    data: TableDataRow[],
    res: DataQueryResultRow[][],
  ) {
    // adds drill rows if setup in config
    // if there of is set drilldown row is displayed with absolute numbers,
    // if part of is also not null a relative percenatage based of the selected basis is displayed

    if (this.config.thereOf == undefined || this.config.thereOf.length == 0) {
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
                                ${scenarios}
                         FROM ?
                         WHERE ${fromString}
                         GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}
                         ORDER BY ${order[1]}`);
    });

    // invertet Sort directon because the later used insertion which results into expected order direction
    //drillQueries.push(`SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, null as operation, 'DRILLELEMENT' as ${QueryColumnNames.TYPE}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, ${QueryColumnNames.ROWGROUP}  as ${QueryColumnNames.ROWGROUP} , ${scenarios} FROM ? WHERE ${fromString} GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}  ORDER BY ${order[1]}`);

    drillQueries.forEach(function (query) {
      resDrill.push(...alasql<DataQueryResultRow[]>(query, [data]));
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
    if (categoryThereOf == null || categoryThereOf.size == 0) {
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
              if (row[value] != undefined) {
                minuent += row[value] as number;
              }
            });
            row[`${key}##REST`] = (row[key] as number) - minuent;

            if (row[`${key}##REST`] != 0) {
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

    if (TableType.OPT == type || TableType.OPTNOTOTAL == type) {
      if (scenarios.isValid) {
        if (scenarios.type == "dr") {
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
      if (scenarios.type == "dr") {
        return `SUM((${scenarios.base}  * transformOperator(operation)) - (${scenarios.delta}  * transformOperator(operation))) as ${scenario}, SUM(${scenarios.delta} * transformOperator(operation)) as dr_${scenarios.delta}`;
      } else {
        return `SUM((${scenarios.base}  * transformOperator(operation))- (${scenarios.delta} * transformOperator(operation))) as ${scenario}`;
      }
    }

    return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
  }

  /**
   * generates Tuple
   *  [0] orderby string example:   category asc
   *  [1] inverted order example:   category desc
   * @param orderComponent
   */
  private createOrderString(orderComponent: Order): [string, string] {
    let base = "";
    let inverted = "";

    base = `${orderComponent.hierarchy.toString()} ${orderComponent.direction}`;
    inverted = `${orderComponent.hierarchy.toString()} ${OrderDirection.ASC === orderComponent.direction ? OrderDirection.DESC : OrderDirection.ASC}`;
    return [base, inverted];
  }

  /** Returns a key/value pair mapping a relative variance column to its denominator, or null for non-relative scenarios. */
  private createRelativeScenario(scenario: string) {
    const scenarios = new VarianceScenario(scenario);

    if (scenarios.isValid && scenarios.type == "dr") {
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

      if (this.config.grouped == false) {
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
                       FROM ?
                       WHERE ${fromString}
                       GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.TYPE}
                       ORDER BY ${order[1]}`);

    return drillQueries;
  }

  private checkConfigForPartOf() {
    if (this.config.partOf == null || this.config.partOf.length == 0) {
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
    data: TableDataRow[],
    res: DataQueryResultRow[][],
  ) {
    if (categoryThereOf == null || categoryThereOf.size == 0) {
      return;
    }

    const drillQueries: string[] = [];
    const resDrill: DataQueryResultRow[] = [];

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
                         FROM ?
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
                         FROM ?
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
                         FROM ?
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
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, subCategory, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, scenario`);
      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, scenario`);
      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, columnSubGroup, scenario`);
    });

    for (const query of drillQueries) {
      resDrill.push(...alasql<DataQueryResultRow[]>(query, [data]));
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
          if (row.type != drillElement.rowlevel) {
            continue;
          }

          if ("ENTRY" == drillElement.rowlevel) {
            if (drillElement.columnlevel == "COLUMNGROUP" && row.category == drillElement.category) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (drillElement.columnlevel == "SUBGROUP" && row.category == drillElement.category) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("DRILLELEMENT" == drillElement.rowlevel) {
            if (
              drillElement.columnlevel == "COLUMNGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (
              drillElement.columnlevel == "SUBGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            } else if (
              drillElement.columnlevel == "COLUMNGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == `${drillElement.subCategory} (${drillElement.rowGroup})`
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (
              drillElement.columnlevel == "SUBGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == `${drillElement.subCategory} (${drillElement.rowGroup})`
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("SUM" == drillElement.rowlevel) {
            if (
              drillElement.columnlevel == "COLUMNGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (
              drillElement.columnlevel == "SUBGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
            ) {
              row[
                drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup
              ] = drillElement.val;
            }
          } else if ("GROUP_SUM" == drillElement.rowlevel) {
            if (
              drillElement.columnlevel == "COLUMNGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
            ) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (
              drillElement.columnlevel == "SUBGROUP" &&
              row.category == drillElement.category &&
              row.subCategory == drillElement.subCategory
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
