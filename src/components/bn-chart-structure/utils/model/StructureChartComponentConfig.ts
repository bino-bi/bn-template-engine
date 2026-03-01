import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../../../utils/constants";
import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../../../utils/model/Order";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StructureChartDataRow, StructureChartDataRowAdapter } from "./StructureChartDataRow";

/** Parsed stacking configuration for multi-scenario bar charts. */
export interface StackConfigParsed {
  by: StackBy;
  mode: StackMode;
  order: StackOrder;
}

/**
 * Configuration for an IBCS structural (categorical) bar chart component.
 *
 * Controls the vertical scale, category visibility, and chart rendering parameters
 * for charts where the x-axis represents categories rather than time periods.
 */
export class StructureChartComponentConfig {
  /** Variance column identifiers (e.g. `["d_ac1_pl1_pos"]`) for delta visualizations. */
  public variances: string[] = [];
  public title: string = "";
  /** When true, category labels on the y-axis are hidden. */
  public hideCategories: boolean = false;
  /** Vertical scale factor: pixels per one data unit. Controls bar height. */
  public pixelPerUnit: number = 10;
  /** Vertical scale factor for percentage variances: pixels per 1.0 (=100%). */
  public pixelPerPercentage: number = 50;
  /** Maximum data points to display; 0 means unlimited. */
  public limit: number = 0;
  public sortOrder: Order = new OrderAdapter(new StringAdapter()).default();
  public level: AggregationLevel = AggregationLevel.CATEGORY;
  public filter: string = "";
  /** SI prefix for measure scaling (e.g. "k" for thousands, "M" for millions). */
  public measureScale: SiPrefix = new SiPrefix();
  /** Unit label displayed alongside the chart (e.g. "EUR", "USD"). */
  public measureUnit: string = "";
  public showMeasureScale: boolean = true;
  public dataFormatDigits: DataFormatDigits = { decimal: 1, percent: 2 };
  public stackConfig: StackConfigParsed | null = null;

  constructor(
    public data: StructureChartDataRow[],
    public scenarios: string[],
  ) {}
}

/**
 * Converts untyped JSON into a validated {@link StructureChartComponentConfig}.
 *
 * Requires the raw dataset for measure scale auto-calculation.
 */
export class StructureChartComponentConfigAdapter implements IAdapter<StructureChartComponentConfig> {
  constructor(
    private dataRowAdapter: StructureChartDataRowAdapter,
    private orderAdapter: OrderAdapter,
    private stringAdapter: StringAdapter,
    private dataFormatDigitsAdapter: DataFormatDigitsAdapter,
    private dataSet: Record<string, unknown>[],
  ) {}

  adapt(data: Record<string, unknown>): StructureChartComponentConfig {
    const dataSet: StructureChartDataRow[] = AdapterUtils.adaptArray(data.data, this.dataRowAdapter);
    const scenarios: string[] = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);

    const config: StructureChartComponentConfig = new StructureChartComponentConfig(dataSet, scenarios);

    if (CompareUtil.isArray(data.variances)) {
      config.variances = AdapterUtils.adaptArray(data.variances, this.stringAdapter);
    }

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isBoolean(data.hideCategories)) {
      config.hideCategories = data.hideCategories;
    }

    if (CompareUtil.isNumber(data.pixelPerUnit)) {
      config.pixelPerUnit = data.pixelPerUnit;
    }
    3;

    if (CompareUtil.isNumber(data.pixelPerPercentage)) {
      config.pixelPerPercentage = data.pixelPerPercentage;
    }

    if (CompareUtil.isNumber(data.limit)) {
      config.limit = data.limit;
    }

    if (CompareUtil.isExisting(data.sortOrder)) {
      config.sortOrder = this.orderAdapter.adapt(data.sortOrder as Record<string, unknown>);
    }

    if (CompareUtil.isExisting(data.level)) {
      config.level = data.level as AggregationLevel;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter.trim();
    }

    if (CompareUtil.isExisting(data.measureScale)) {
      config.measureScale = DataAnalyzer.calculateMeasureScale(
        this.dataSet,
        config.scenarios,
        data.measureScale as string,
      );
    }

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale;
    }

    if (CompareUtil.isExisting(data.dataFormatDigits)) {
      config.dataFormatDigits = this.dataFormatDigitsAdapter.adapt(data.dataFormatDigits as Record<string, unknown>);
    }

    if (CompareUtil.isExisting(data.stackConfig)) {
      config.stackConfig = data.stackConfig as StackConfigParsed;
    }

    return config;
  }
  default() {
    return new StructureChartComponentConfig([], []);
  }
}
