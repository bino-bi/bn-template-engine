import { Order } from "../../../../components";
import { DataFormat, I18nMode, TableCategoryWidth, MeasureType } from "../../../../utils/constants";
import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { OrderAdapter } from "../../../../utils/model/Order";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { TableType } from "./index";
import { TableAttribute } from "./TableAttribute";
import { TableDrillGroup, TableDrillGroupAdapter } from "./TableDrillGroup";
import { AlaSQLDatabase } from "../../../../context/scopedDb";

/**
 * Configuration for an IBCS table component.
 *
 * Controls table behavior including drill-down groups, data formatting, and display modes.
 *
 * Drill-down concepts:
 * - **thereOf** -- Sub-rows that break down a parent row's total (e.g. "thereof: domestic / international").
 *   Configured as an array of {@link TableDrillGroup} filters.
 * - **partOf** -- Rows shown as a percentage share of a parent total.
 *   Also configured via {@link TableDrillGroup} filters.
 * - **categoryThereOf** -- Column-level drill-down using the `##` separator convention in category names
 *   (e.g. `"Revenue##Product A"`) to expand a single category column into detail sub-columns.
 *   The Map key is the parent category, values are the detail records.
 */
export class TableComponentConfig {
  public title: string = "";
  /** Active scenario column names (e.g. `["ac1", "pl1"]`). */
  public scenarios: string[] = [];
  /** Number format for scenario values (decimal, percent, etc.). */
  public scenariosUnitType: DataFormat = DataFormat.DECIMAL;
  /** When true, rows are visually grouped by rowGroup. */
  public grouped: boolean = false;
  public showGroupTitle: boolean = true;
  /** Drill-down sub-row definitions -- "thereof" breakdowns within a category. */
  public thereOf: TableDrillGroup[] = [];
  /** Column-level drill-down using `##` separator in category names. */
  public categoryThereOf: Map<string, Record<string, unknown>[]> = new Map();
  /** Percentage-of-total sub-row definitions. */
  public partOf: TableDrillGroup[] = [];
  /** Custom columns computed from dataset fields via aggregate expressions (see bn-table `attributes` prop). */
  public attributes: TableAttribute[] = [];
  public sortOrder: Order = new OrderAdapter(new StringAdapter()).default();
  /** Table aggregation mode: LIST (flat), SUM (with totals), OPT (with optional totals), etc. */
  public type: TableType = TableType.LIST;
  /** Maximum rows to display; 0 means unlimited. */
  public limit: number = 0;
  public i18n: I18nMode = I18nMode.ALL;
  /** Proportion of table width allocated to the category label column. */
  public categoryWidth: TableCategoryWidth = TableCategoryWidth.W25;
  /** SI prefix for measure scaling (e.g. "k" for thousands, "M" for millions). */
  public measureScale: SiPrefix = new SiPrefix();
  /** Unit label displayed in the table header (e.g. "EUR", "USD"). */
  public measureUnit: string = "";
  /** Whether the measure represents a volume or a ratio, affecting formatting. */
  public measureType: MeasureType = MeasureType.VOLUME;
  public showMeasureScale: boolean = true;
  /** AlaSQL WHERE clause for additional row filtering. */
  public filter: string = "";
  /** Scenario columns to render as inline bar charts instead of numbers. */
  public barColumns: string[] = [];
  /** Interval column grouping: "none", "setname" or a DateDistance value (see bn-table `interval` prop). */
  public interval: string = "none";
  /** Number of interval groups left of the row header block (see bn-table `categoryIntervalPosition` prop). */
  public categoryIntervalPosition: number = 0;
  /** Locale used for interval bucket labels. */
  public locale: string = "de";
  constructor() {}
}

/**
 * Converts untyped JSON into a validated {@link TableComponentConfig}.
 *
 * Reads from the shared alasql database for measure-scale auto-calculation when `measureScale` is set to "auto".
 */
export class TableComponentConfigAdapter implements IAdapter<TableComponentConfig> {
  constructor(
    private tableDrillGroupAdapter: TableDrillGroupAdapter,
    private stringAdapter: StringAdapter,
    private orderAdapter: OrderAdapter,
    private db: AlaSQLDatabase,
    private fromExpr: string,
    private onQueryError?: (e: unknown) => void,
  ) {}
  adapt(data: Record<string, unknown>): TableComponentConfig {
    const config = new TableComponentConfig();

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isArray(data.scenarios)) {
      config.scenarios = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);
    }

    if (CompareUtil.isExisting(data.scenariosUnitType)) {
      config.scenariosUnitType = data.scenariosUnitType as DataFormat;
    }

    if (CompareUtil.isBoolean(data.grouped)) {
      config.grouped = data.grouped;
    }

    if (CompareUtil.isBoolean(data.showGroupTitle)) {
      config.showGroupTitle = data.showGroupTitle;
    }

    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale;
    }

    if (CompareUtil.isArray(data.thereOf)) {
      config.thereOf = AdapterUtils.adaptArray(data.thereOf, this.tableDrillGroupAdapter);
    }

    if (CompareUtil.isExisting(data.categoryThereOf)) {
      config.categoryThereOf = data.categoryThereOf as Map<string, Record<string, unknown>[]>;
    }

    if (CompareUtil.isArray(data.partOf)) {
      config.partOf = AdapterUtils.adaptArray(data.partOf, this.tableDrillGroupAdapter);
    }

    if (CompareUtil.isArray(data.attributes)) {
      config.attributes = data.attributes as TableAttribute[];
    }

    if (CompareUtil.isExisting(data.order)) {
      config.sortOrder = this.orderAdapter.adapt(data.order as Record<string, unknown>);
    }

    if (CompareUtil.isExisting(data.type)) {
      config.type = data.type as TableType;
    }

    if (CompareUtil.isNumber(data.limit)) {
      config.limit = data.limit;
    }

    if (CompareUtil.isExisting(data.i18n)) {
      config.i18n = data.i18n as I18nMode;
    }

    if (CompareUtil.isExisting(data.categoryWidth)) {
      config.categoryWidth = data.categoryWidth as TableCategoryWidth;
    }

    if (CompareUtil.isExisting(data.measureScale)) {
      config.measureScale = DataAnalyzer.calculateMeasureScale(
        this.db,
        this.fromExpr,
        config.scenarios,
        data.measureScale as string,
        this.onQueryError,
      );
    }

    if (CompareUtil.isExisting(data.measureType)) {
      config.measureType = data.measureType as MeasureType;
    }

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter.trim();
    }

    if (CompareUtil.isArray(data.barColumns)) {
      config.barColumns = data.barColumns as string[];
    }

    if (CompareUtil.isString(data.interval)) {
      config.interval = data.interval;
    }

    if (CompareUtil.isNumber(data.categoryIntervalPosition)) {
      config.categoryIntervalPosition = data.categoryIntervalPosition;
    }

    if (CompareUtil.isString(data.locale)) {
      config.locale = data.locale;
    }

    return config;
  }

  default(): TableComponentConfig {
    return new TableComponentConfig();
  }
}
