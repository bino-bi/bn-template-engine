import { TableRow } from "../elements";
import { ScenarioHeaderColumn, TableRowType, TableType, ThereofPosition, VisualisationRuleSet } from "../model";
import {
  BLANK_BUCKET_LABEL,
  computeWaterfall,
  DataQuery,
  hasGroupingStructure,
  INTERVAL_NONE,
  isDateInterval,
  WaterfallResult,
} from "../helper";

import { TableAttribute } from "../model/TableAttribute";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { Formatter } from "../../../../utils";
import { I18nMode, DataFormat, Scenarios, TableCategoryWidth } from "../../../../utils/constants";
import { QueryColumnNames, VarianceScenario } from "../../../../utils/model";
import { resolveSentiment } from "../../../../utils/model/VarianceScenario";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { ColumnStats } from "../elements/Cell";
import { DataQueryResultRow } from "../../../../utils/model/DataQueryResultRow";
import { AlaSQLDatabase } from "../../../../context/scopedDb";
import { NOT_AVAILABLE } from "../../../../utils/relativeVariance";
import { styleSlot } from "../../../../utils/ibcsRuleSet";
import { pointDate } from "../../../../utils/layoutState/dataPoint";
import { DataPointKey } from "../../../../utils/layoutState/types";

/**
 * Transforms raw query results into structured TableRow collections for header and body.
 *
 * Header normalization: adds the fixed columns (operation, category) to the configured
 * scenarios, then translates labels via i18n and adds separator rows for IBCS-style borders.
 *
 * Body row creation: iterates DataQuery results grouped by rowGroup, creates detail rows
 * with type-specific logic (GROUPHEAD, SUM, DRILLELEMENT, PARTELEMENT, ENTRY), and
 * translates cell values/prefixes via i18n. Supports inline bar chart columns via
 * columnStats calculation.
 */
export class TableDataSetFactory {
  private normalizedHeader: ScenarioHeaderColumn[] = [];
  private attributesByAlias: Map<string, TableAttribute> = new Map();
  /** Set by createBodyRows(): the grouped table has rows with a blank rowGroup. */
  public hasBlankRowGroup = false;
  /** The interval columns stand for dates, so a cell of one has a date. */
  private dateBuckets = false;
  /** opt/optnototal tables show entry values without their operation sign. */
  private unsignedEntries = false;

  constructor(private readonly ruleSet?: VisualisationRuleSet) {}

  /** The underline class of a scenario column: the one of the style slot its colorIndex selects. */
  private underlineClass(type: string): string | null {
    if (!this.ruleSet || !/^(ac|pp|fc|pl)[1-4]$/.test(type)) {
      return null;
    }
    return styleSlot(this.ruleSet.getScenarioColorIndex(type)) + type.slice(2);
  }

  /** Effective column list (category/operation + attributes + scenarios × buckets) in render order, set by createHeader(). */
  public getNormalizedHeader(): ScenarioHeaderColumn[] {
    return this.normalizedHeader;
  }

  /**
   * Creates Tableheader based on the configured scenarios (in config)
   * the created header is stored in the dataset json
   * the lables are translated based on the used i18n map
   * based on the structure of the scenarios 'spacer'coulumns are added, to
   * visualise grouping.
   * finally a seperator header row is created for the header underlining (border)
   */
  public createHeader(
    type: TableType,
    scenarios: readonly ScenarioHeaderColumn[],
    i18n: Map<string | number, string>,
    measureScale: SiPrefix,
    measureUnit: string,
    showMeasureScale: boolean,
    attributes: TableAttribute[] = [],
    leadingScenarioColumns: number = 0,
  ): TableRow[] {
    const header: TableRow[] = [];

    this.attributesByAlias = new Map(attributes.map((attribute) => [attribute.alias, attribute]));
    this.normalizedHeader = this.normalizeHeader(type, scenarios, attributes, leadingScenarioColumns);
    const hasIntervalColumns = this.normalizedHeader.some((column) => column.bucket !== undefined);

    if (hasIntervalColumns) {
      header.push(this.createIntervalBandRow());
    }

    const headerRow: TableRow = new TableRow(hasIntervalColumns ? 1 : 0, 0, TableRowType.HEADER);
    const separatorRow: TableRow = new TableRow(hasIntervalColumns ? 2 : 1, 0, TableRowType.SEPERATORLINE);

    for (const scenario of this.normalizedHeader) {
      const attribute = this.attributesByAlias.get(scenario.name);
      headerRow.createElement(
        attribute
          ? i18n.get(attribute.label) || attribute.label
          : Formatter.translateScenarioLabel(scenario.name, i18n),
        scenario.type,
        this.createColumnType(scenario),
        null,
        this.setHeaderPrefix(scenario, i18n, measureScale, measureUnit, showMeasureScale),
        null,
        null,
        null,
        null,
      );
      separatorRow.createElement(
        null,
        scenario.type,
        this.createColumnType(scenario),
        null,
        null,
        this.underlineClass(scenario.type),
        null,
        null,
        null,
      );
    }

    header.push(headerRow);
    header.push(separatorRow);

    return header;
  }

  /**
   * Creates the spanning interval band row (e.g. `2023 | 2024 | 2025`) rendered
   * above the scenario label row. Non-interval columns (category,
   * operation, attributes) receive borderless filler cells; each run of
   * consecutive columns of the same bucket is spanned by one label cell.
   */
  private createIntervalBandRow(): TableRow {
    const bandRow: TableRow = new TableRow(0, 0, TableRowType.HEADER);

    let index = 0;
    while (index < this.normalizedHeader.length) {
      const column = this.normalizedHeader[index];

      if (column.bucket === undefined) {
        bandRow.createElement(null, column.type, "filler", null, null, null, null, null, null);
        index += 1;
        continue;
      }

      let runLength = 1;
      while (
        index + runLength < this.normalizedHeader.length &&
        this.normalizedHeader[index + runLength].bucket === column.bucket
      ) {
        runLength += 1;
      }

      bandRow.createElement(
        column.bucketLabel,
        column.type,
        "intervalGroup",
        null,
        null,
        null,
        null,
        null,
        null,
        false,
        undefined,
        runLength,
      );
      index += runLength;
    }

    return bandRow;
  }

  private setHeaderPrefix(
    scenario: ScenarioHeaderColumn,
    i18n: Map<string | number, string>,
    measureScale: SiPrefix,
    measureUnit: string,
    showMeasureScale: boolean,
  ) {
    let prefix = "";

    if (scenario.name === "category" && showMeasureScale) {
      if (measureScale.prefix.length !== 0 || measureUnit.length !== 0) {
        prefix = Formatter.translateScenarioLabel("in", i18n) + " " + measureScale.prefix + measureUnit;
      }
    }

    if (scenario.order) {
      prefix += Formatter.translateScenarioLabel("ORDER_" + scenario.order, i18n);
    }

    return prefix;
  }

  /**
   * combines the default columnnames (operation and category) with the
   * configured scenarios.
   * depending of table type operation column is used (OPT) or not (SUM | LIST)
   * in addition the headers are sorted based on the ruleset and duplicates are removed
   *
   * operation, category and the attribute columns are the row header block. It moves
   * as one unit: `leadingScenarioColumns` scenario columns stand left of it.
   */
  private normalizeHeader(
    type: TableType,
    scenarios: readonly ScenarioHeaderColumn[],
    attributes: TableAttribute[],
    leadingScenarioColumns: number = 0,
  ): ScenarioHeaderColumn[] {
    let header: ScenarioHeaderColumn[] = [
      {
        name: QueryColumnNames.CATEGORY,
        group: QueryColumnNames.CATEGORY,
        type: QueryColumnNames.CATEGORY,
        order: undefined,
      },
    ];

    if (TableType.OPT === type || TableType.OPTNOTOTAL === type) {
      header = [
        {
          name: QueryColumnNames.OPERATION,
          group: QueryColumnNames.OPERATION,
          type: QueryColumnNames.OPERATION,
          order: undefined,
        },
        {
          name: QueryColumnNames.CATEGORY,
          group: QueryColumnNames.CATEGORY,
          type: QueryColumnNames.CATEGORY,
          order: undefined,
        },
      ];
    }

    // attribute columns sit between the category column and the scenario columns
    const attributeColumns = attributes.map((attribute) => ({
      name: attribute.alias,
      group: attribute.alias,
      type: attribute.alias,
      order: undefined,
    }));

    // NOTE: scenarios are already sorted in setConfig
    return [
      ...scenarios.slice(0, leadingScenarioColumns),
      ...header,
      ...attributeColumns,
      ...scenarios.slice(leadingScenarioColumns),
    ];
  }

  /**
   * Creates table data colelction,
   * eachh row consists of data columns and 'spacer' columns which are needed to seperate
   * the columns correctyl (IBCS style)
   */
  public createBodyRows(
    config: TableComponentConfig,
    i18n: Map<string | number, string>,
    db: AlaSQLDatabase,
    fromExpr: string,
  ): TableRow[] {
    const bodyRows: TableRow[] = [];

    let iGroupIndex: number = -1; // index used in detailRow JSON to count the current group
    const dataQuery = new DataQuery(config, i18n);
    this.dateBuckets = isDateInterval(config.interval);
    this.unsignedEntries = TableType.OPT === config.type || TableType.OPTNOTOTAL === config.type;
    const queryData = dataQuery.execute(db, fromExpr); // collection of all query results
    this.hasBlankRowGroup = dataQuery.hasBlankRowGroup;

    // Calculate column statistics for bar columns
    const columnStatsMap = this.calculateColumnStatistics(
      queryData,
      config.barColumns,
      config.interval !== INTERVAL_NONE,
    );

    // Scenario bar columns render as a waterfall when grouping structure is present,
    // absolute variance bar columns when varianceWaterfall is set;
    // interval/columnthereof composite columns are excluded and render as today
    const thereOfAbove = config.thereOfPosition === ThereofPosition.ABOVE;
    const barColumns = config.barColumns ?? [];
    const scenarioColumns = barColumns.filter((column) => column.toUpperCase().trim() in Scenarios);
    const waterfallColumns = [
      ...(scenarioColumns.length > 0 && hasGroupingStructure(queryData) ? scenarioColumns : []),
      ...(config.varianceWaterfall ? barColumns.filter((column) => new VarianceScenario(column).type === "d") : []),
    ];
    const waterfallResult =
      waterfallColumns.length > 0 && config.interval === INTERVAL_NONE && config.categoryThereOf.size === 0
        ? computeWaterfall(queryData, waterfallColumns, config.type, dataQuery.hasRunningSum(), thereOfAbove)
        : undefined;

    for (const groupData of queryData) {
      // groupData is a collection of dataRows, each group base on a query and represents a 'row' group
      iGroupIndex += 1;
      const iRowIndex: number = -1;
      bodyRows.push(
        ...this.createRow(
          config.i18n,
          i18n,
          config.scenariosUnitType,
          groupData,
          iGroupIndex,
          iRowIndex,
          config.categoryWidth,
          config.measureScale,
          config.barColumns,
          columnStatsMap,
          waterfallResult,
          thereOfAbove,
        ),
      );
    }

    return bodyRows;
  }

  /**
   * Calculate min/max statistics for bar chart columns across all query data.
   */
  private calculateColumnStatistics(
    queryData: DataQueryResultRow[][],
    barColumns: string[],
    intervalActive: boolean = false,
  ): Map<string, ColumnStats> {
    const statsMap = new Map<string, ColumnStats>();

    if (!barColumns || barColumns.length === 0) {
      return statsMap;
    }

    // Collect all values per column for median calculation
    const valuesMap = new Map<string, number[]>();
    for (const column of barColumns) {
      statsMap.set(column, { min: Infinity, max: -Infinity, absMax: 0, median: 0 });
      valuesMap.set(column, []);
    }

    // Iterate through all groups and rows
    for (const groupData of queryData) {
      for (const row of groupData) {
        // sum rows draw no bar (a waterfall takes its extent from WaterfallBarData), so they must not stretch the scale
        const type = row[QueryColumnNames.TYPE];
        if (type === TableRowType.SUM || type === TableRowType.GROUPSUM) continue;
        for (const column of barColumns) {
          // with an active interval the rendered values live under the
          // `column##bucket` keys; the plain column would hold the (larger)
          // un-bucketed aggregate and skew the bar scaling
          const values = intervalActive
            ? this.extractIntervalColumnValues(row, column)
            : [this.extractColumnValue(row, column)];
          for (const value of values) {
            if (value !== null && !isNaN(value)) {
              const stats = statsMap.get(column)!;
              stats.min = Math.min(stats.min, value);
              stats.max = Math.max(stats.max, value);
              valuesMap.get(column)!.push(Math.abs(value));
            }
          }
        }
      }
    }

    // Finalize absMax and median values
    for (const [column, stats] of statsMap) {
      if (stats.min === Infinity || stats.max === -Infinity) {
        stats.min = 0;
        stats.max = 0;
      }
      stats.absMax = Math.max(Math.abs(stats.min), Math.abs(stats.max));

      const absValues = valuesMap.get(column)!;
      if (absValues.length > 0) {
        absValues.sort((a, b) => a - b);
        const mid = Math.floor(absValues.length / 2);
        stats.median = absValues.length % 2 === 0 ? (absValues[mid - 1] + absValues[mid]) / 2 : absValues[mid];
      }

      statsMap.set(column, stats);
    }

    return statsMap;
  }

  /**
   * Extract all per-bucket values of an interval column (`column##<bucketKey>`).
   */
  private extractIntervalColumnValues(row: DataQueryResultRow, column: string): (number | null)[] {
    const prefix = column + "##";
    const values: (number | null)[] = [];
    for (const key of Object.keys(row)) {
      if (key.startsWith(prefix)) {
        const val = Number(row[key]);
        values.push(isNaN(val) ? null : val);
      }
    }
    return values;
  }

  /**
   * Extract a numeric value from a row for a given column name.
   * Handles the various naming conventions used in the table data.
   */
  private extractColumnValue(row: DataQueryResultRow, column: string): number | null {
    // Try direct access
    if (row[column] !== undefined) {
      const val = Number(row[column]);
      return isNaN(val) ? null : val;
    }

    // Search for keys that match the column (handles scenario## prefix patterns)
    for (const key of Object.keys(row)) {
      if (key === column || key.endsWith("##" + column) || key === column + "##" + column) {
        const val = Number(row[key]);
        if (!isNaN(val)) {
          return val;
        }
      }
    }

    return null;
  }

  /**
   * Helper funciton to generate a new Table Row,
   * it calls itsself recursive if a drilldown is set by the config file.
   * a drilldown is detected if there is a colection of rows in .drill
   *
   * @param i18nMode
   * @param i18n
   * @param scenariosUnitType
   * @param groupData
   * @param iGroupIndex
   * @param iRowIndex
   * @param categoryWidth
   * @param measureScale
   * @param barColumns
   * @param columnStatsMap
   */
  private createRow(
    i18nMode: I18nMode | undefined,
    i18n: Map<string | number, string>,
    scenariosUnitType: DataFormat,
    groupData: DataQueryResultRow[],
    iGroupIndex: number,
    iRowIndex: number,
    categoryWidth?: TableCategoryWidth,
    measureScale?: SiPrefix,
    barColumns?: string[],
    columnStatsMap?: Map<string, ColumnStats>,
    waterfallResult?: WaterfallResult,
    thereOfAbove: boolean = false,
  ): TableRow[] {
    const result: TableRow[] = [];
    // the last entry row and its index in result: the parent of the thereof rows that follow it
    let parentIndex = -1;
    let parent: DataQueryResultRow | undefined;
    // thereof and partof rows have no operation, they take the one of the row above
    let operation: string | null | undefined;

    for (const rawDataRow of groupData) {
      iRowIndex += 1;
      // create next table row
      const rowGroup = rawDataRow[QueryColumnNames.ROWGROUP];
      const groupName = rowGroup === "" ? BLANK_BUCKET_LABEL : rowGroup;
      const subCategory = rawDataRow[QueryColumnNames.SUBCATEGORY];
      const type = rawDataRow[QueryColumnNames.TYPE];
      const isSecondElement = rawDataRow[QueryColumnNames.ROWNR] >= 2;
      operation = (rawDataRow.operation ?? rawDataRow.restOperation ?? operation) as string | null | undefined;
      // a thereof row moves above the entry row before it only when that row is its parent
      const moved =
        thereOfAbove &&
        type === TableRowType.DRILLELEMENT &&
        parent !== undefined &&
        parent[QueryColumnNames.CATEGORY] === rawDataRow[QueryColumnNames.CATEGORY] &&
        (parent[QueryColumnNames.ROWGROUP] === "NO_GROUP" || parent[QueryColumnNames.ROWGROUP] === rowGroup);

      const detailsRow: TableRow = this.createDetailRow(type, iRowIndex, iGroupIndex, groupData.length);
      detailsRow.key = this.rowKey(rawDataRow);
      for (const scenario of this.normalizedHeader) {
        const value = this.getRawDataRowElement(rawDataRow, scenario);
        const isBarColumn = barColumns?.includes(scenario.type) ?? false;
        // waterfall geometry only exists for plain scenario columns (no ## composites)
        const waterfall =
          isBarColumn &&
          scenario.bucket === undefined &&
          scenario.name === scenario.group &&
          scenario.name === scenario.type
            ? waterfallResult?.get(rawDataRow, scenario.type)
            : undefined;
        const isShareChange = type === TableRowType.PARTELEMENT && new VarianceScenario(scenario.type).isValid;
        // the change of a share is in percentage points, it has no place on the axis of the column
        const isBarChart = isBarColumn && !isShareChange;
        const columnStats = isBarChart ? columnStatsMap?.get(scenario.type) : undefined;

        detailsRow.createElement(
          // percent values have no share, so there is no change of a share either
          isShareChange && scenariosUnitType === DataFormat.PERCENT
            ? "-"
            : this.translateSumCellLabel(i18nMode, i18n, value, groupName, subCategory, type, scenario.type),
          scenario.type,
          this.createColumnType(scenario),
          this.setCellType(scenario.type, scenariosUnitType),
          moved ? null : this.translateCellPrefix(i18n, type, scenario.type),
          this.translateScenarioCSS(scenario.type, value as number, operation),
          isSecondElement,
          categoryWidth,
          measureScale?.value,
          isBarChart,
          columnStats,
          1,
          waterfall,
        );
        const cell = detailsRow.elements[detailsRow.elements.length - 1];
        if (this.dateBuckets && scenario.bucket !== undefined) {
          cell.date = pointDate(scenario.bucket);
        }
        const varianceScenario = new VarianceScenario(scenario.type);
        if (varianceScenario.isValid) {
          cell.direction = this.resolveDirection(varianceScenario, operation);
        }
      }

      // moved only here: the operation above and the waterfall geometry both rely on the parent coming first
      if (moved) {
        detailsRow.cssStyle = "ofit-above";
        result[parentIndex].cssStyle = "ofit-sum";
        result.splice(parentIndex, 0, detailsRow);
        parentIndex += 1;
        continue;
      }
      if (type === TableRowType.ENTRY) {
        parentIndex = result.length;
        parent = rawDataRow;
      }
      result.push(detailsRow);
    }

    return result;
  }

  /** The raw dimensions of a row. `rowGroup` of the ungrouped rows and of the total is the engine's own label. */
  private rowKey(row: DataQueryResultRow): DataPointKey | undefined {
    const rowGroup =
      row.restRowGroup != null ? (row.restRowGroup as string) : row.rowGroup === "NO_GROUP" ? undefined : row.rowGroup;
    switch (row.type) {
      case TableRowType.ENTRY:
        return { rowGroup, category: row.category, subCategory: row.subCategory };
      case TableRowType.DRILLELEMENT:
        return { rowGroup, category: row.category, subCategory: (row.rawSubCategory as string) ?? row.subCategory };
      case TableRowType.GROUPSUM:
        return { rowGroup, row: "subtotal" };
      case TableRowType.SUM:
        return { row: "total" };
      default:
        return undefined;
    }
  }

  private getRawDataRowElement(rawDataRow: DataQueryResultRow, scenario: ScenarioHeaderColumn) {
    if (scenario.bucket !== undefined) {
      // interval column: value lives under the composite bucket key
      return rawDataRow[scenario.type + "##" + scenario.bucket];
    }

    if (scenario.name === scenario.group && scenario.name === scenario.type) {
      // Default Sum Scenario (e.g. AC)
      return rawDataRow[scenario.name];
    } else if (scenario.name === scenario.group && scenario.name !== scenario.type) {
      return rawDataRow[scenario.type + "##" + scenario.name];
    }

    return rawDataRow[scenario.type + "##" + scenario.group + "##" + scenario.name];
  }

  /**
   * Crates a detail row depending on the radDataRow Type
   * it switches between header, sum and standard,
   *
   * @param type      valid values GROUPHEADER, SUM   other values are interpreted as standard
   * @param rowIndex
   * @param groupIndex
   * @param maxIndex  total number of rows
   */
  private createDetailRow(type: string, rowIndex: number, groupIndex: number, maxIndex: number): TableRow {
    switch (type) {
      case TableRowType.GROUPHEAD:
        return new TableRow(rowIndex, groupIndex, TableRowType.HEADER);
      case TableRowType.SUM:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.SUM);
      case TableRowType.GROUPSUM:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.SUM);
      case TableRowType.DRILLELEMENT:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.DRILLELEMENT);
      case TableRowType.PARTELEMENT:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.PARTELEMENT);
      default:
        return new TableRow(rowIndex, groupIndex, TableRowType.STANDARD);
    }
  }

  /**
   * Translates Cell-Value (value) if possible,
   * Numbers are not translated, just category names,
   * if it is a SUM ROW  rowGroup is used
   * if it is a variance in OPT mode the absolute value is used
   *
   * @param value
   * @param rowGroup
   * @param type
   * @param scenario
   * @param subCategory
   */
  private translateSumCellLabel(
    i18nMode: I18nMode | undefined,
    i18n: Map<string | number, string>,
    value: string | number,
    rowGroup: string,
    subCategory: string,
    type: string,
    scenario: string,
  ): string | number {
    if (this.attributesByAlias.has(scenario)) {
      // attribute values render verbatim; rows without the column (e.g. SUM) stay blank
      return value;
    }

    if (Number.isNaN(Number(value)) === false) {
      return value;
    }

    if (this.isOperationColumn(scenario)) {
      return value;
    }

    if (this.isGroupHeadCategory(type, scenario)) {
      if (i18nMode === I18nMode.ALL) {
        return `${i18n.get(value) || value}`;
      }

      return value;
    }

    if (this.isEntryCategory(type, scenario)) {
      // "REST" is always translated, like SUM_TOTAL below: it is not a data
      // value but the engine's own label for the limit-overflow row.
      if (i18nMode === I18nMode.ALL || value === "REST") {
        return `${i18n.get(value) || value}`;
      }

      return value;
    }

    if (this.isDrillElementCategory(type, scenario)) {
      if (i18nMode === I18nMode.ALL) {
        return `${i18n.get(subCategory) || subCategory}`;
      }

      return `${subCategory}`;
    }

    if (this.isPartElementCategory(type, scenario)) {
      // translate allways because of default sum symbol.
      if (i18nMode === I18nMode.ALL || rowGroup === "SUM_TOTAL") {
        return `${i18n.get(rowGroup) || rowGroup}`;
      }
      return `${rowGroup}`;
    }

    if (this.isSumElementCategory(type, scenario)) {
      if (i18nMode === I18nMode.ALL || rowGroup === "SUM_TOTAL") {
        return `${i18n.get(rowGroup) || rowGroup}`;
      }

      return rowGroup;
    }

    if ("GROUPHEAD" === type && value == null) {
      return value;
    }

    if (value === NOT_AVAILABLE) {
      return value;
    }

    if (Number.isNaN(Number(value))) {
      return "-";
    } else {
      return Number(value);
    }
  }

  private isOperationColumn(scenario: string) {
    return scenario === "operation";
  }

  /**
   * converts Scenario to CSS class
   *
   * @param scenario
   * @param value
   */
  private translateScenarioCSS(scenario: string, value: number, operation: string | null | undefined): string {
    if (this.attributesByAlias.has(scenario)) {
      return "attribute";
    }

    const scenarios = new VarianceScenario(scenario);
    let prefix = "pos";

    if (value < 0) {
      prefix = "neg";
    }

    if (scenarios.isValid) {
      const direction = this.resolveDirection(scenarios, operation);
      return prefix + "_" + direction + (scenarios.type === "dr" ? " relative_variance" : "");
    }

    return scenario;
  }

  /** Sentiment of a variance on a row with the given operation: `op`/`opinv` become pos or neg. */
  private resolveDirection(scenarios: VarianceScenario, operation: string | null | undefined): string {
    return resolveSentiment(scenarios.direction, operation, !this.unsignedEntries);
  }

  private setCellType(scenario: string, scenariosUnitType: DataFormat) {
    if (scenario === "category") {
      return "";
    }

    const attribute = this.attributesByAlias.get(scenario);
    if (attribute) {
      return attribute.isNumeric ? "decimal" : "";
    }

    let unitType: string;
    const scenarios = new VarianceScenario(scenario);

    if (scenariosUnitType === DataFormat.PERCENT) {
      unitType = "percent";

      if (scenarios.isValid && scenarios.type === "d") {
        unitType = "percentpoint";
      }
    } else {
      unitType = "decimal";

      if (scenarios.isValid && scenarios.type === "dr") {
        unitType = "percent";
      }
    }

    return unitType;
  }

  private isDrillElementCategory(type: string, scenario: string) {
    return "DRILLELEMENT" === type && "category" === scenario;
  }

  private isPartElementCategory(type: string, scenario: string) {
    return "PARTELEMENT" === type && "category" === scenario;
  }

  private isSumElementCategory(type: string, scenario: string) {
    return ("GROUP_SUM" === type || "SUM" === type) && "category" === scenario;
  }

  private isEntryCategory(type: string, scenario: string) {
    return "ENTRY" === type && "category" === scenario;
  }

  private isGroupHeadCategory(type: string, scenario: string) {
    return "GROUPHEAD" === type && "category" === scenario;
  }

  private translateCellPrefix(i18n: Map<string | number, string>, type: string, scenario: string) {
    if (this.isOperationColumn(scenario)) {
      return null;
    }

    if (this.isGroupHeadCategory(type, scenario)) {
      return null;
    }

    if (this.isEntryCategory(type, scenario)) {
      return null;
    }

    if (this.isDrillElementCategory(type, scenario)) {
      return `${i18n.get("thereof")} `;
    }

    if (this.isPartElementCategory(type, scenario)) {
      // translate allways because of default sum symbol.
      return `${i18n.get("part_of")} `;
    }

    return null;
  }

  private createColumnType(scenario: ScenarioHeaderColumn) {
    if (scenario.name === scenario.group && scenario.name === scenario.type) {
      return "base";
    }

    if (scenario.name === scenario.group) {
      return "columnGroup";
    }

    return "columnSubGroup";
  }
}
