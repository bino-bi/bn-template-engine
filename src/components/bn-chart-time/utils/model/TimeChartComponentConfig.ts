// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";
// import { StringAdapter } from "../../../../utils/helper/StringAdapter";
// import { Order, OrderAdapter } from "../../../../utils/model/Order";
// import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";

import { AxisLabelsMode, ChartMode, StackBy, StackMode, StackOrder } from "../../../../utils/constants";
import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
import { DateDistance } from "../../../../utils/DateStringFactory";
import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { TimeChartDataRow, TimeChartDataRowAdapter } from "./TimeChartDataRow";
import { AlaSQLDatabase } from "../../../../context/scopedDb";

/** Parsed stacking configuration for multi-scenario bar/area charts. */
export interface StackConfigParsed {
  by: StackBy;
  mode: StackMode;
  order: StackOrder;
  /** `scenario`: a segment takes the look of its scenario (FC hatched, PL outlined). */
  notation: "none" | "scenario";
  /** Where the series names stand: at the first column, at the last one, at both, or nowhere. */
  legend: "left" | "right" | "both" | "none";
  /** 100 % stack: shares as plain numbers and one `100%` mark on the legend side. */
  percentMark: boolean;
}

/**
 * Total columns of a time chart, at their own scale: one for all periods right
 * of the last one, or one behind the periods of each year, quarter, month or week.
 */
export interface TotalsConfig {
  /** What a total covers: all periods, or the periods of one year, quarter, month or week. */
  by: "all" | "year" | "quarter" | "month" | "week";
  /** How the periods become one value. Only `sum` stacks one part per scenario. */
  aggregation: "sum" | "average" | "last";
  /** Pixels for one unit in a total column. 0: the scale of the chart. */
  pixelPerUnit: number;
  /** Text under the column of `by: all`. The others take the name of their period. */
  label: string;
  /** Width of a column in widths of a period column. */
  width: number;
  /** Name of a dataset that holds the values. Empty: the chart computes them from its periods. */
  dataset: string;
  /** Scenarios that are drawn at the total only, not in the periods. */
  scenarios?: string[];
}

/**
 * Configuration for an IBCS time-series chart component.
 *
 * Controls the vertical scale, date interval detection, axis labelling,
 * and chart rendering mode (bar, line, etc.).
 */
export class TimeChartComponentConfig {
  /** Variance column identifiers (e.g. `["d_ac1_pl1_pos"]`) for delta visualizations. */
  public variances: string[] = [];
  public title: string = "";
  public hideAxisLabels: boolean = false;
  /** Vertical scale factor: pixels per one data unit. Controls bar/line height. */
  public pixelPerUnit: number = 10;
  /** Vertical scale factor for percentage variances: pixels per 1.0 (=100%). */
  public pixelPerPercentage: number = 50;
  /** Pixel offset from left edge for horizontal alignment across multiple charts. -1 disables sync. */
  public leftSideOffsetForHorizontalSync: number = -1;
  /** Date granularity (year, quarter, month, etc.). AUTO auto-detects from data. */
  public dateInterval: DateDistance = DateDistance.AUTO;
  /** Controls how axis labels are rendered; SMART suppresses overlapping labels. */
  public axisLabelsMode: AxisLabelsMode = AxisLabelsMode.SMART;
  /** Maximum number of periods the AUTO date interval may produce. Never cuts the series. */
  public intervalSpanLimit: number = 28;
  public filter: string = "";
  public measureScale: SiPrefix = new SiPrefix();
  public measureUnit: string = "";
  public showMeasureScale: boolean = true;
  public dataFormatDigits: DataFormatDigits = { decimal: 1, percent: 2 };
  public showOverlayMedian: boolean = true;
  public showOverlayAvg: boolean = true;
  public chartMode: ChartMode = ChartMode.BAR;
  /** Maximum number of bars to render before truncating; prevents visual overload. */
  public maxBars: number = 28;
  public stackConfig: StackConfigParsed | null = null;
  /** When true, line charts extend to the full width of the chart area. */
  public lineFullWidth: boolean = true;
  /** Print every n-th category label only. */
  public axisLabelsStep: number = 1;
  /** Value of the scaling indicator band, 0 for none. */
  public scalingIndicator: number = 0;
  /** The total columns, null for none. */
  public totals: TotalsConfig | null = null;
  /** One series that changes its scenario along the time axis, see `bn-chart-time`. */
  public scenarioSwitch: boolean = false;
  /** Side of the axis title: left, right or none. */
  public axisTitlePosition: string = "left";
  /** Absolute variances as a walk: each column starts where the one before ended. */
  public varianceWaterfall: boolean = false;
  /** The variances of the first absolute row: with totals at the scale of the chart the base chart draws them as a bridge. */
  public bridgeVariances: string[] = [];
  /** With `scenarioSwitch`: the reference is a column behind the series, not a marker. */
  public referenceColumn: boolean = false;
  /** The left space comes from `sync-space-left`: the chart adds no room of its own to it. */
  public syncedLeft: boolean = false;
  /** Locale used for date-axis labels and SQL date normalization; set from the bn-context locale. */
  public locale: string = "de";
  constructor(
    public data: TimeChartDataRow[],
    public scenarios: string[],
  ) {}
}

/**
 * Converts untyped JSON into a validated {@link TimeChartComponentConfig}.
 *
 * Reads from the shared alasql database for measure-scale auto-calculation.
 */
export class TimeChartComponentConfigAdapter implements IAdapter<TimeChartComponentConfig> {
  constructor(
    private dataRowAdapter: TimeChartDataRowAdapter,
    private stringAdapter: StringAdapter,
    private dataFormatDigitsAdapter: DataFormatDigitsAdapter,
    private db: AlaSQLDatabase,
    private fromExpr: string,
    private onQueryError?: (e: unknown) => void,
  ) {}

  adapt(data: Record<string, unknown>): TimeChartComponentConfig {
    const dataSet: TimeChartDataRow[] = AdapterUtils.adaptArray(data.data, this.dataRowAdapter);
    const scenarios: string[] = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);

    const config: TimeChartComponentConfig = new TimeChartComponentConfig(dataSet, scenarios);

    if (CompareUtil.isArray(data.variances)) {
      config.variances = AdapterUtils.adaptArray(data.variances, this.stringAdapter);
    }

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isBoolean(data.hideAxisLabels)) {
      config.hideAxisLabels = data.hideAxisLabels;
    }

    if (CompareUtil.isNumber(data.pixelPerUnit)) {
      config.pixelPerUnit = data.pixelPerUnit;
    }

    if (CompareUtil.isNumber(data.pixelPerPercentage)) {
      config.pixelPerPercentage = data.pixelPerPercentage;
    }

    if (CompareUtil.isExisting(data.dateInterval)) {
      config.dateInterval = data.dateInterval as DateDistance;
    }

    if (CompareUtil.isExisting(data.axisLabelsMode)) {
      config.axisLabelsMode = data.axisLabelsMode as AxisLabelsMode;
    }

    if (CompareUtil.isNumber(data.leftSideOffsetForHorizontalSync)) {
      config.leftSideOffsetForHorizontalSync = data.leftSideOffsetForHorizontalSync;
    }

    if (CompareUtil.isNumber(data.intervalSpanLimit)) {
      config.intervalSpanLimit = data.intervalSpanLimit;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter;
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

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale;
    }

    if (CompareUtil.isExisting(data.dataFormatDigits)) {
      config.dataFormatDigits = this.dataFormatDigitsAdapter.adapt(data.dataFormatDigits as Record<string, unknown>);
    }

    if (CompareUtil.isBoolean(data.showOverlayAvg)) {
      config.showOverlayAvg = data.showOverlayAvg;
    }

    if (CompareUtil.isBoolean(data.showOverlayMedian)) {
      config.showOverlayMedian = data.showOverlayMedian;
    }

    if (CompareUtil.isExisting(data.chartMode)) {
      config.chartMode = data.chartMode as ChartMode;
    }

    if (CompareUtil.isNumber(data.maxBars)) {
      config.maxBars = data.maxBars;
    }

    if (CompareUtil.isExisting(data.stackConfig)) {
      config.stackConfig = data.stackConfig as StackConfigParsed;
    }

    if (CompareUtil.isBoolean(data.lineFullWidth)) {
      config.lineFullWidth = data.lineFullWidth;
    }

    if (CompareUtil.isNumber(data.axisLabelsStep) && data.axisLabelsStep >= 1) {
      config.axisLabelsStep = data.axisLabelsStep;
    }

    if (CompareUtil.isNumber(data.scalingIndicator) && data.scalingIndicator > 0) {
      config.scalingIndicator = data.scalingIndicator;
    }

    const totals = data.totals as Partial<TotalsConfig> | null | undefined;
    if (totals != null && CompareUtil.isNumber(totals.pixelPerUnit) && totals.pixelPerUnit >= 0) {
      const by = ["all", "year", "quarter", "month", "week"].includes(totals.by as string) ? totals.by! : "all";
      const aggregation = ["sum", "average", "last"].includes(totals.aggregation as string)
        ? totals.aggregation!
        : "sum";
      config.totals = {
        by,
        aggregation,
        pixelPerUnit: totals.pixelPerUnit,
        label: typeof totals.label === "string" ? totals.label : "",
        width: CompareUtil.isNumber(totals.width) && totals.width > 0 ? totals.width : 1,
        dataset: typeof totals.dataset === "string" ? totals.dataset : "",
        scenarios: Array.isArray(totals.scenarios)
          ? totals.scenarios.filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    }

    if (CompareUtil.isBoolean(data.scenarioSwitch)) {
      config.scenarioSwitch = data.scenarioSwitch;
    }

    if (CompareUtil.isString(data.axisTitlePosition)) {
      config.axisTitlePosition = data.axisTitlePosition;
    }

    if (CompareUtil.isBoolean(data.varianceWaterfall)) {
      config.varianceWaterfall = data.varianceWaterfall;
    }

    if (CompareUtil.isArray(data.bridgeVariances)) {
      config.bridgeVariances = AdapterUtils.adaptArray(data.bridgeVariances, this.stringAdapter);
    }

    if (CompareUtil.isBoolean(data.referenceColumn)) {
      config.referenceColumn = data.referenceColumn;
    }

    if (CompareUtil.isBoolean(data.syncedLeft)) {
      config.syncedLeft = data.syncedLeft;
    }

    if (CompareUtil.isString(data.locale)) {
      config.locale = data.locale;
    }

    return config;
  }
  default() {
    return new TimeChartComponentConfig([], []);
  }
}
