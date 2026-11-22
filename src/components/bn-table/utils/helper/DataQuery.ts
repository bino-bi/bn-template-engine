import { OrderDirection, TableType } from "../model";
import { BLANK_SAFE_ROWGROUP, QueryGroups } from "./QueryGroup";
import { restSignedAlias } from "./WaterfallCalculator";
import {
  BLANK_BUCKET_LABEL,
  coerceBucketKey,
  INTERVAL_NONE,
  INTERVAL_SETNAME,
  intervalBucketSQL,
} from "./IntervalColumns";
import { FIELD_IDENTIFIER_REGEX, TableAttribute } from "../model/TableAttribute";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { TableDrillGroup } from "../model/TableDrillGroup";
import { Order } from "../../../../components";
import { OrderToken, parseOrderToken } from "../../../../utils/model/Order";
import { Scenarios } from "../../../../utils/constants";
import { QueryColumnNames, VarianceScenario } from "../../../../utils/model";
import { DataQueryResultRow, DataQueryMetaRow } from "../../../../utils/model/DataQueryResultRow";
import { AlaSQLDatabase } from "../../../../context/scopedDb";
import { NOT_AVAILABLE, relativeVariance } from "../../../../utils/relativeVariance";

type MissingOrNumber = number | null | undefined;

/** Adds a group sum to a running result; it stays missing as long as no group had a value. */
function addGroupSum(running: MissingOrNumber, value: MissingOrNumber): MissingOrNumber {
  return running == null && value == null ? value : (running ?? 0) + (value ?? 0);
}

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
  /** Values bound as AlaSQL parameters ($0, $1, ...): row values and free-text config never become SQL text. */
  private readonly params: unknown[] = [];
  /** Select fragment (leading comma) of the sort keys for variance and bucketed order tokens. */
  private sortSelect: string = "";
  /** Set by execute: the grouped table has rows with a blank rowGroup (null, '' or missing). */
  public hasBlankRowGroup: boolean = false;

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

    // these names are written into the SQL text as column names
    for (const name of [
      ...this.config.scenarios,
      ...this.config.categoryThereOf.keys(),
      ...this.config.barColumnParts.values(),
    ]) {
      if (!FIELD_IDENTIFIER_REGEX.test(name)) {
        throw new Error(`invalid identifier "${name}"`);
      }
    }

    const queries: string[] = [];
    const sumGroupQueries: string[] = [];
    const res: DataQueryResultRow[][] = [];

    const scenarios = this.scenariosSQL(false);
    const scenariosSUMQuery = this.scenariosSQL(true);
    const relativeScenarios = this.getRelativeScenarios();

    const attributesSQL = this.config.attributes.map((attribute) => this.translateAttributeSQL(attribute)).toString();

    const groups: QueryGroups = new QueryGroups(this.config);

    // a bucket only applies under interval setname, else the token sorts like its bare column
    const sortOrder: Order =
      this.config.interval === INTERVAL_SETNAME
        ? this.config.sortOrder
        : {
            hierarchy: this.config.sortOrder.hierarchy.map((column) => parseOrderToken(column)?.column ?? column),
            direction: this.config.sortOrder.direction,
          };
    let order: [string, string] = ["", ""];
    if (sortOrder.hierarchy.length > 0) {
      order = this.createOrderString(sortOrder);
    }

    this.hasPartOf = this.checkConfigForPartOf();

    // meta defines groups and the number detail rows in each group
    // Bsp:  0: Object { totalrowcnt: 7, rowgroup: "Umsatz" }
    // groups follow the order entries that exist per group (rowGroup, rowGroupIndex, scenario sum), else rowGroupIndex
    const { hierarchy, direction } = sortOrder;
    const groupOrderColumns = hierarchy.filter(
      (column) =>
        column === QueryColumnNames.ROWGROUP ||
        column === QueryColumnNames.ROWGROUPINDEX ||
        column.toUpperCase() in Scenarios,
    );
    const groupSums = groupOrderColumns
      .filter((column) => column.toUpperCase() in Scenarios)
      .map((column) => `, SUM(${column} * transformOperator(operation)) as ${column}`)
      .join("");
    const groupOrder =
      groupOrderColumns.length > 0
        ? groupOrderColumns.map((column) => `${column} ${direction}`).toString()
        : `${QueryColumnNames.ROWGROUPINDEX} asc`;

    const meta = db.exec<DataQueryResultRow[]>(
      `SELECT COUNT(DISTINCT ${QueryColumnNames.CATEGORY}) as ${QueryColumnNames.TOTALROWCOUNT} ${this.config.grouped ? `, ${BLANK_SAFE_ROWGROUP} as ${QueryColumnNames.ROWGROUP}, FIRST(${QueryColumnNames.ROWGROUPINDEX}) as ${QueryColumnNames.ROWGROUPINDEX}${groupSums}` : ""}
                       FROM ${fromExpr} ${this.config.grouped ? `GROUP BY ${BLANK_SAFE_ROWGROUP} ORDER BY ${groupOrder}` : ""}`,
    );
    if (
      meta.length === 0 ||
      (meta.length === 1 && (meta[0][QueryColumnNames.TOTALROWCOUNT] ?? 0) === 0 && !this.config.grouped)
    ) {
      return [];
    }
    this.hasBlankRowGroup = this.config.grouped && meta.some((row) => row.rowGroup === "");

    // Creates DataSelection for LIST
    (meta as unknown as DataQueryMetaRow[]).forEach((rowGroupEntry: DataQueryMetaRow) => {
      // the following variables are 'helper sections' which are used to constuct dynamicly the sql statement depending of the given config
      // is grouping active?
      const queryWhereSection: string = !this.config.grouped
        ? ``
        : rowGroupEntry.rowGroup === ""
          ? `WHERE (${QueryColumnNames.ROWGROUP} IS NULL OR ${QueryColumnNames.ROWGROUP} = '')`
          : `WHERE ${QueryColumnNames.ROWGROUP} = ${this.bind(rowGroupEntry.rowGroup)}`;
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
      this.createGroupSumRow(queries, sumGroupQueries, rowGroupEntry, scenariosSUMQuery, queryWhereSection, order);
    });

    this.createTotalSumRow(queries, sumGroupQueries, scenariosSUMQuery);

    // executes main queries
    queries.forEach((query) => res.push(this.exec(query)));

    if (this.hasRunningSum()) {
      this.accumulateGroupSums(res, [...new Set(this.exctractScenarioNames(scenariosSUMQuery))]);
    }

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
    const params = this.params;
    drillQueries.forEach((query) => {
      resDrill.push(...this.exec(query));
    });

    // two relative variances on one reference name its dr_* alias twice
    const scenarioNames = [...new Set(this.exctractScenarioNames(scenarios))];
    const rowGroupSumResultRows: DataQueryResultRow[] = [];

    sumGroupQueries.forEach(function (query) {
      rowGroupSumResultRows.push(...db.exec<DataQueryResultRow[]>(query, params));
    });

    const rowGroupSumResultMap = new Map<string, DataQueryResultRow>();

    rowGroupSumResultRows.forEach((row) => rowGroupSumResultMap.set(row[QueryColumnNames.ROWGROUP], row));

    resDrill = this.reduceResDrillByCategoryGroups(resDrill, scenarioNames);

    resDrill.forEach((drillItem) => {
      this.toShares(drillItem, rowGroupSumResultMap.get(drillItem[QueryColumnNames.ROWGROUP] as string), scenarioNames);
    });

    this.injectDrillRowsToResultRows(resDrill, res);
  }

  /**
   * Turns the values of a partof row into shares of its total. A variance becomes the change of the
   * share (percentage points), not the share of the variance.
   */
  private toShares(part: DataQueryResultRow, totals: DataQueryResultRow | undefined, names: string[]) {
    const share = (key: string) => (part[key] as number) / (totals ? (totals[key] as number) : Number.NaN);
    const changes = new Map<string, number>();
    for (const name of names) {
      const variance = new VarianceScenario(name);
      if (variance.isValid) {
        changes.set(name, share(variance.base) - share(variance.delta));
      }
    }
    for (const name of names) {
      part[name] = changes.get(name) ?? share(name);
    }
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
      // a REST row of only "-" rows counts as "-" for the op sentiment; not named operation, so it stays hidden
      // the row prints the unsigned sum; the walk of a waterfall needs the signed sum of its bar columns
      const parts = [...this.config.barColumnParts.values()];
      const restSigned = this.exctractScenarioNames(scenarios)
        .filter((name) => this.config.barColumns?.includes(name) || parts.includes(name))
        .map((name) => `, SUM(${name} * transformOperator(operation)) as ${restSignedAlias(name)}`)
        .join("");
      const restOperation =
        TableType.OPT === this.config.type || TableType.OPTNOTOTAL === this.config.type
          ? `, CASE WHEN MAX(transformOperator(operation)) = -1 THEN '-' ELSE '+' END as restOperation${restSigned}`
          : "";
      // rowNr is not aggregated: alasql >= 4.18 returns the first rest row's number, which made the REST row a second element
      querys.push(
        `SELECT NULL as ${QueryColumnNames.ROWNR}, 1 as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, 'NO_GROUP' as ${QueryColumnNames.ROWGROUP}, ${this.bind(String(rowGroupEntry.rowGroup ?? ""))} as restRowGroup, 'REST' as ${QueryColumnNames.CATEGORY}${restOperation} ${restScenarios.length > 0 ? ", " + restScenarios : ""} FROM` +
          ` (SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, ${querys.length} as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, ${this.bind(String(rowGroupEntry.rowGroup || "NO_GROUP"))} as ${QueryColumnNames.ROWGROUP}, ${groups.select()} ${scenarios.length > 0 ? ",".concat(scenarios) : ""}${this.sortSelect} FROM ${this.fromExpr} ${queryWhereSection} GROUP BY ${groups} ORDER BY ${order[0]})` +
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
                        ${this.bind(String(rowGroupEntry.rowGroup || "NO_GROUP"))} as ${QueryColumnNames.ROWGROUP},
                        '${QueryColumnNames.CATEGORYINDEX}',
                        ${groups.select()}                           ${scenarios.length > 0 ? ",".concat(scenarios) : ""} ${attributes.length > 0 ? ",".concat(attributes) : ""}${this.sortSelect}
                 FROM ${this.fromExpr} ${queryWhereSection}
                 GROUP BY ${groups}
                 ORDER BY ${order[0]} ${queryLimitSection}`);
  }

  /** Generates a GROUPHEAD row used as a visual header when row grouping is active. */
  private createGroupHeaderRow(rowGroupEntry: DataQueryMetaRow, querys: string[]) {
    // Generates GroupHeader Row
    // Without a title the group sum row alone closes the group; only a list has no sum row and keeps the head as gap
    if (true === this.config.grouped && (this.config.showGroupTitle || !this.hasGroupSum())) {
      const rowGroup = this.bind(String(rowGroupEntry.rowGroup));
      const title = rowGroupEntry.rowGroup === "" ? this.bind(BLANK_BUCKET_LABEL) : rowGroup;
      const groupTitle: string = this.config.showGroupTitle ? `,${title} as ${QueryColumnNames.CATEGORY}` : "";
      querys.push(`SELECT ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          'GROUPHEAD'                 as ${QueryColumnNames.TYPE},
                          ${rowGroup} as ${QueryColumnNames.ROWGROUP} ${groupTitle}
                   FROM ${this.fromExpr}
                   GROUP BY '1'`);
    }
  }

  private hasGroupSum(): boolean {
    return (
      TableType.SUM === this.config.type ||
      TableType.SUMNOTOTAL === this.config.type ||
      TableType.OPT === this.config.type ||
      TableType.OPTNOTOTAL === this.config.type
    );
  }

  /**
   * True when the group sum rows are running results: only a grouped table with group sum
   * rows has them. Column drill values of the group sum rows are not accumulated, so
   * `runningSum` is off with columnthereof.
   */
  public hasRunningSum(): boolean {
    return (
      this.config.runningSum && this.config.grouped && this.hasGroupSum() && this.config.categoryThereOf.size === 0
    );
  }

  /**
   * Turns the GROUP_SUM rows into running results: each one gets the raw aliases of all
   * group sums before it added (scenarios, `_cnt`, variances and `dr_*` denominators).
   * Runs before the NaN step and the relative variance division, where all of them are sums.
   * A missing value stays missing until a group brings a real one.
   */
  private accumulateGroupSums(res: DataQueryResultRow[][], aliases: string[]) {
    const running: Record<string, MissingOrNumber> = {};
    for (const segment of res) {
      for (const row of segment) {
        if (row[QueryColumnNames.TYPE] !== "GROUP_SUM") {
          continue;
        }
        for (const alias of aliases) {
          running[alias] = addGroupSum(running[alias], row[alias] as MissingOrNumber);
          row[alias] = running[alias];
        }
      }
    }
  }

  /** Generates a GROUP_SUM row that aggregates all entries within a single row group. */
  private createGroupSumRow(
    querys: string[],
    groupSumQuery: string[],
    rowGroupEntry: DataQueryMetaRow,
    scenariosSUMQuery: string,
    queryWhereSection: string,
    order: [string, string],
  ) {
    // Generates SUM Row; sumsup all rows of group
    if (true === this.config.grouped && this.hasGroupSum()) {
      const rowGroup = this.bind(String(rowGroupEntry.rowGroup));
      querys.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          '='                         as ${QueryColumnNames.OPERATION},
                          ${rowGroup} as ${QueryColumnNames.ROWGROUP},
                          ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ${this.fromExpr} ${queryWhereSection}
                   ORDER BY ${order[0]} `);
      groupSumQuery.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                                 '='                         as ${QueryColumnNames.OPERATION},
                                 ${rowGroup} as ${QueryColumnNames.ROWGROUP},
                                 ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                                 'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ${this.fromExpr} ${queryWhereSection}
                          ORDER BY ${order[0]} `);
    }
  }

  /** Generates a total SUM row across all groups (only for SUM / OPT table types). */
  private createTotalSumRow(querys: string[], sumGroupQueries: string[], scenariosSUMQuery: string) {
    if (TableType.SUM === this.config.type || TableType.OPT === this.config.type) {
      // An empty label falls back to the SUM_TOTAL key, which tableDataSetFactory
      // resolves to the IBCS total symbol (❖).
      const label = this.config.title?.trim() || "SUM_TOTAL";
      // In an ungrouped partof table the total row is what the "in % of ❖" rows
      // refer to, so a custom label gets the symbol prepended. The default label
      // already IS that symbol - prefixing it would yield the literal
      // "❖ SUM_TOTAL", which no longer matches the key and stays untranslated.
      const prefixSymbol = this.hasPartOf && this.config.grouped === false && label !== "SUM_TOTAL";
      const title = prefixSymbol ? `${this.i18n.get("SUM_TOTAL") || "SUM_TOTAL"} ${label}` : label;

      querys.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                          ${this.bind(title)} as ${QueryColumnNames.ROWGROUP},
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

            // the rowGroup only tells duplicate names under one parent apart, and a blank rowGroup tells nothing
            if (
              drillItem.rowGroup != null &&
              drillItem.rowGroup !== "" &&
              duplicateSubCategoriesList.includes(`${drillItem.category}##${drillItem.subCategory}`)
            ) {
              drillItem.rawSubCategory = drillItem.subCategory;
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
        fromString += ` ${QueryColumnNames.CATEGORY} = ${this.bind(element.category)}`;
        isFirst = false;
      }

      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty

        fromString += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.ROWGROUP} = ${this.bind(element.rowGroup)}`;
        isFirst = false;
      }

      if (!(null == element.subCategory || 0 === element.subCategory.length || !element.subCategory.trim())) {
        // if not empty
        fromString += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.SUBCATEGORY} = ${this.bind(element.subCategory)}`;
      }
      fromString += `)`;

      drillQueries.push(`SELECT ROWNUM()                     AS ${QueryColumnNames.ROWNR},
                                null                         as operation,
                                'DRILLELEMENT'               as ${QueryColumnNames.TYPE},
                                ${QueryColumnNames.CATEGORY},
                                ${QueryColumnNames.SUBCATEGORY},
                                ${this.drillRowGroup} as ${QueryColumnNames.ROWGROUP},
                                ${scenarios} ${attributes.length > 0 ? ",".concat(attributes) : ""}${this.sortSelect}
                         FROM ${this.fromExpr}
                         WHERE ${fromString}
                         GROUP BY ${this.drillRowGroup}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}
                         ORDER BY ${order[1]}`);
    });

    drillQueries.forEach((query) => {
      resDrill.push(...this.exec(query));
    });

    this.injectDrillRowsToResultRows(resDrill, res);
  }

  /**
   * Converts absolute variance columns into relative (percentage) variances by dividing
   * each `dr_*` cell by the absolute value of its denominator column (the delta scenario's
   * aggregated value). A denominator of 0 gives NOT_AVAILABLE.
   */
  private calculateRelativeVariances(res: DataQueryResultRow[][], relativeScenarios: Map<string, string>) {
    res.forEach((group) => {
      group.forEach((row: DataQueryResultRow) => {
        if (row[QueryColumnNames.TYPE] !== "GROUPHEAD") {
          relativeScenarios.forEach((value: string, key: string) => {
            row[key] = relativeVariance(row[key] as number, row[value] as number) ?? NOT_AVAILABLE;
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
   * `<scenario>##<bucketKey>` - the same convention as the columnthereof drill
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
    const scenarios = this.scenariosSQL(false);
    const scenariosSUMQuery = this.scenariosSQL(true);
    // two relative variances on one reference name its dr_* alias twice, it must be summed once
    const entryAliases = [...new Set(this.exctractScenarioNames(scenarios))];
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

    const exec = (query: string): DataQueryResultRow[] => this.exec(query);

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
        row[key] = relativeVariance(row[key] as number, row[value] as number) ?? NOT_AVAILABLE;
      });
      return row;
    };

    const writeBucketValues = (target: DataQueryResultRow, source: DataQueryResultRow, bucketKey: string) => {
      for (const scenario of this.config.scenarios) {
        target[scenario + separator + bucketKey] = source[scenario];
      }
    };

    const entryRowsRaw = exec(
      `SELECT ${groups.select()}, __interval ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
       FROM ${bucketSource}
       GROUP BY ${groups}, __interval`,
    );

    // only the generated REST row has restRowGroup; a data row with the category REST keeps its own values
    const isGeneratedRest = (row: DataQueryResultRow) => row.type === "ENTRY" && row.restRowGroup != null;

    // REST rows first: the math needs the raw (not yet finalized) entry aliases
    if (this.config.limit > 0) {
      for (let segmentIndex = 0; segmentIndex < res.length; segmentIndex++) {
        const restRow = res[segmentIndex].find(isGeneratedRest);
        if (!restRow) {
          continue;
        }

        // nearest preceding segment holding the displayed ENTRY rows
        let entrySegment: DataQueryResultRow[] | undefined;
        for (let i = segmentIndex - 1; i >= 0 && !entrySegment; i--) {
          const candidate = res[i].filter((row) => row.type === "ENTRY" && !isGeneratedRest(row));
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
          if (row.type !== "ENTRY" || isGeneratedRest(row) || row.category !== entryRow.category) {
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
            `SELECT ${BLANK_SAFE_ROWGROUP} as ${QueryColumnNames.ROWGROUP}, __interval ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
             FROM ${bucketSource}
             GROUP BY ${BLANK_SAFE_ROWGROUP}, __interval`,
          )
        : [];
    const groupTotalsByKey = new Map<string, DataQueryResultRow>();
    groupTotalRowsRaw.forEach((row) =>
      groupTotalsByKey.set(`${row.rowGroup}${separator}${coerceBucketKey(row.__interval)}`, row),
    );

    if (isSumTypeGrouped && this.hasRunningSum()) {
      // per bucket, each group sum row gets the totals of all groups up to its own
      const sumAliases = [...new Set(this.exctractScenarioNames(scenariosSUMQuery))];
      const groupSumRows = res.flat().filter((row) => row.type === "GROUP_SUM");
      for (const bucketKey of new Set(groupTotalRowsRaw.map((row) => coerceBucketKey(row.__interval)))) {
        let running: DataQueryResultRow | undefined;
        for (const row of groupSumRows) {
          const totalRow = groupTotalsByKey.get(`${row.rowGroup}${separator}${bucketKey}`);
          if (totalRow) {
            running ??= {};
            for (const alias of sumAliases) {
              running[alias] = addGroupSum(running[alias] as MissingOrNumber, totalRow[alias] as MissingOrNumber);
            }
          }
          if (running) {
            writeBucketValues(row, finalizeBucketRow({ ...running }), bucketKey);
          }
        }
      }
    } else if (isSumTypeGrouped) {
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
            `SELECT ${this.drillRowGroup} as ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, __interval ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
             FROM ${bucketSource}
             WHERE ${this.createThereOfWhereClause(element)}
             GROUP BY ${this.drillRowGroup}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, __interval`,
          ),
        );
      });

      for (const drillRow of drillRows) {
        const bucketKey = coerceBucketKey(drillRow.__interval);
        finalizeBucketRow(drillRow);
        for (const segment of res) {
          for (const row of segment) {
            if (
              row.type !== "DRILLELEMENT" ||
              row.category !== drillRow.category ||
              row.rowGroup !== drillRow.rowGroup
            ) {
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
        partWhere += `OR (${QueryColumnNames.CATEGORY} = ${this.bind(element.category)}`;
        if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
          partWhere += `and ${QueryColumnNames.ROWGROUP} = ${this.bind(element.rowGroup)}`;
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

      // merge rows sharing (rowGroup, category, bucket) - mirrors reduceResDrillByCategoryGroups
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

        this.toShares(partRow, totals, entryAliases);

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
      whereClause += ` ${QueryColumnNames.CATEGORY} = ${this.bind(element.category)}`;
      isFirst = false;
    }

    if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
      whereClause += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.ROWGROUP} = ${this.bind(element.rowGroup)}`;
      isFirst = false;
    }

    if (!(null == element.subCategory || 0 === element.subCategory.length || !element.subCategory.trim())) {
      whereClause += ` ${isFirst ? "" : "AND"} ${QueryColumnNames.SUBCATEGORY} = ${this.bind(element.subCategory)}`;
    }

    return whereClause + `)`;
  }

  /**
   * The select list of the scenarios. A partof row needs both sides of every variance, also when they
   * are not shown, and a bar column needs the scenario of its `barColumnParts`. Those come without
   * their `_cnt`, so the NaN detection of the other rows does not change.
   */
  private scenariosSQL(isSumRow: boolean): string {
    const shown = this.config.scenarios;
    const sql = shown.map((s) => this.translateScenarioSQL(s, isSumRow, this.config.type));
    const hidden = new Set<string>();
    // the part drawn inside a bar is read like a scenario, without a column of its own
    for (const [column, part] of this.config.barColumnParts) {
      if (shown.includes(column)) hidden.add(part);
    }
    if (this.checkConfigForPartOf() && this.config.type !== TableType.LIST) {
      for (const scenario of shown) {
        const variance = new VarianceScenario(scenario);
        if (variance.isValid) {
          hidden.add(variance.base).add(variance.delta);
        }
      }
    }
    for (const scenario of hidden) {
      if (!shown.includes(scenario)) {
        sql.push(this.translateScenarioSQL(scenario, isSumRow, this.config.type).split(", COUNT(")[0]);
      }
    }
    return sql.toString();
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
   * - **OPT/OPTNOTOTAL types**: Entry rows are summed without `transformOperator`, they
   *   show unsigned values. Sum rows (`isSumRow`) apply the operation sign to scenarios,
   *   variances and the `dr_*` denominator alike.
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
        // sum rows show signed scenario values, so their variances must be signed too
        const sign = isSumRow ? " * transformOperator(operation)" : "";
        const variance = isSumRow
          ? `SUM((${scenarios.base} - ${scenarios.delta})${sign}) as ${scenario}`
          : `SUM(${scenarios.base} - ${scenarios.delta}) as ${scenario}`;
        if (scenarios.type === "dr") {
          return `${variance}, SUM(${scenarios.delta}${sign}) as dr_${scenarios.delta}`;
        } else {
          return variance;
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
      case "lit": {
        // numeric when parseable, string otherwise
        const arg = attribute.arg;
        return `${this.bind(arg !== "" && !Number.isNaN(Number(arg)) ? Number(arg) : arg)} as ${attribute.alias}`;
      }
    }
  }

  /** rowGroup of the drill queries: a grouped table merges the blank variants, an ungrouped one keeps them apart. */
  private get drillRowGroup(): string {
    return this.config.grouped ? BLANK_SAFE_ROWGROUP : QueryColumnNames.ROWGROUP;
  }

  /** Grouped result rows carry the rowGroup as text, like the GROUPHEAD and GROUP_SUM rows: '' for null and a missing one. */
  private exec(query: string): DataQueryResultRow[] {
    const rows = this.db.exec<DataQueryResultRow[]>(query, this.params);
    if (this.config.grouped) {
      rows.forEach((row) => (row.rowGroup = row.rowGroup == null ? "" : String(row.rowGroup)));
    }
    return rows;
  }

  /** Binds a value as an AlaSQL parameter and returns its placeholder. */
  private bind(value: unknown): string {
    // trailing space: "$4and" does not parse
    return `$${this.params.push(value) - 1} `;
  }

  /**
   * generates Tuple
   *  [0] orderby string example:   category asc
   *  [1] inverted order example:   category desc
   * @param orderComponent
   */
  private createOrderString(orderComponent: Order): [string, string] {
    const inverse = OrderDirection.ASC === orderComponent.direction ? OrderDirection.DESC : OrderDirection.ASC;
    const sortKeys = new Map<number, string>();
    orderComponent.hierarchy.forEach((column, i) => {
      const token = parseOrderToken(column);
      const bucket = token?.bucket;
      if (token?.kind === "variance" || (token?.kind === "scenario" && bucket !== undefined)) {
        sortKeys.set(i, this.translateSortKeySQL(token, bucket, i));
      }
    });
    this.sortSelect = [...sortKeys.values()].map((key) => `, ${key}`).join("");
    // a data row with the reserved category REST stays last in its group when the rows are sorted by value
    const sortsByValue = orderComponent.hierarchy.some((column) => {
      const kind = parseOrderToken(column)?.kind;
      return kind === "scenario" || kind === "variance";
    });
    if (sortsByValue) {
      this.sortSelect += `, CASE WHEN ${QueryColumnNames.CATEGORY} = 'REST' THEN 1 ELSE 0 END as __sortrest`;
    }

    // rows without a value sort last in both directions
    const orderBy = (column: string, i: number, direction: OrderDirection) =>
      sortKeys.has(i) ? `__sortnull${i} asc, __sort${i} ${direction}` : `${column} ${direction}`;
    const base = orderComponent.hierarchy.map((column, i) => orderBy(column, i, orderComponent.direction)).toString();
    const inverted = orderComponent.hierarchy.map((column, i) => orderBy(column, i, inverse)).toString();
    return sortsByValue ? [`__sortrest asc, ${base}`, `__sortrest desc, ${inverted}`] : [base, inverted];
  }

  /**
   * Sort key `__sort<i>` of a scenario or variance order token, as printed in an entry cell
   * (OPT entry rows unsigned), restricted to one setname bucket when given.
   * `__sortnull<i>` is 1 when the cell has no value: no data, or a relative variance with a zero reference.
   */
  private translateSortKeySQL(token: OrderToken, bucket: string | undefined, i: number): string {
    const isOpt = TableType.OPT === this.config.type || TableType.OPTNOTOTAL === this.config.type;
    const sign = isOpt ? "" : " * transformOperator(operation)";
    const inBucket =
      bucket === undefined ? "" : `TRIM(CAST(${intervalBucketSQL(INTERVAL_SETNAME)} AS STRING)) = ${this.bind(bucket)}`;
    const value = (x: string) => `SUM(${inBucket ? `(CASE WHEN ${inBucket} THEN ${x} ELSE 0 END)` : x}${sign})`;
    const missing = (x: string) =>
      `SUM(CASE WHEN ${inBucket ? `${inBucket} AND ` : ""}${x} IS NOT NULL THEN 1 ELSE 0 END) = 0`;

    if (token.kind === "scenario") {
      return `${value(token.column)} as __sort${i}, CASE WHEN ${missing(token.column)} THEN 1 ELSE 0 END as __sortnull${i}`;
    }

    const difference = `(${value(token.base)} - ${value(token.delta)})`;
    let key = difference;
    let noValue = `${missing(token.base)} OR ${missing(token.delta)}`;
    if (token.type === "dr") {
      const reference = value(token.delta);
      // same rule as relativeVariance(); a decimal literal, alasql reads 1e-9 as a column name
      const zeroReference = `ABS(${reference}) <= ABS(${difference}) * 0.000000001`;
      key = `CASE WHEN ${zeroReference} THEN 0 ELSE ${difference} / ABS(${reference}) END`;
      noValue += ` OR ${zeroReference}`;
    }
    return `${key} as __sort${i}, CASE WHEN ${noValue} THEN 1 ELSE 0 END as __sortnull${i}`;
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

  /** Returns the `category##subCategory` keys of subCategory values that appear more than once under one parent category. */
  private findDuplicateSubCategories(resDrill: DataQueryResultRow[]): string[] {
    const uniq = resDrill
      .map((element) => {
        return {
          count: 1,
          subCategory: `${element.category}##${element.subCategory}`,
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
    let groupName = ` ${this.drillRowGroup} as ${QueryColumnNames.ROWGROUP}`;
    let rowNum = "ROWNUM()";

    this.config.partOf?.forEach((element) => {
      fromString += `OR (${QueryColumnNames.CATEGORY} = ${this.bind(element.category)}`;
      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty
        fromString += `and ${QueryColumnNames.ROWGROUP} = ${this.bind(element.rowGroup)}`;
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
                              ${scenarios}${this.sortSelect}
                       FROM ${this.fromExpr}
                       WHERE ${fromString}
                       GROUP BY ${this.drillRowGroup}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.TYPE}
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
        whereClause += ` or columnGroup = ${this.bind(String(drillColumn.name))} `;
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
      resDrill.push(...this.db.exec<DataQueryResultRow[]>(query, this.params));
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
            // ungrouped thereof rows keep their rowGroup, the same name can exist in another one
            if (!this.config.grouped && row.rowGroup !== drillElement.rowGroup) {
              continue;
            }
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
