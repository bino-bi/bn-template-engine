import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, Padding } from "./helper";

import { DataPoint, Scenario, OverflowConfig } from "./model";

import {
  AreaFill,
  AreaPoint,
  Axis,
  HookLocation,
  Label,
  LineSeries,
  LineSeriesDataPoint,
  StackedColumn,
} from "./elements";
import { ScenarioFactory } from "./factories";
import { LabelCollisionManager, SCENARIO_PRIORITY } from "./helper";

import CalculateSize from "calculate-size";

import { StackConfigParsed, TimeChartComponentConfig, TotalsConfig } from "./model/TimeChartComponentConfig";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChart } from "./model/styles/ScaleFactorsTimeChart";
import { DateTime } from "luxon";
import { AlaSQLDatabase, sourceExpr } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { DateDistance, DateStringFactory } from "../../../utils/DateStringFactory";
import { dataPointAttributes, pointDate } from "../../../utils/layoutState/dataPoint";
import { DataPointKey } from "../../../utils/layoutState/types";
import { Column } from "./elements/Column";
import { Needle } from "./elements/Needle";
import { AxisLabelsMode, ChartMode, RELATIVE_STACK_UNITS, StackBy, StackMode } from "../../../utils/constants";
import { getScenarioPrefix, IBCS_LAYER_ORDER } from "../../../utils/stackColors";
import { layoutStack, stackExtent, stackLabelSide, StackLayout } from "../../../utils/stackLayout";
import { computePercentBarExtent, computeUnitBarExtent } from "../../../utils/autoFit";
import { drawAttached } from "../../../utils/measurementHost";
import { DataFormatDigits } from "../../../components";
import { Formatter } from "../../../utils";
import { IBCSRuleSet, styleSlot, stylesBySlot } from "../../../utils/ibcsRuleSet";
import { relativeVariance } from "../../../utils/relativeVariance";
import { DASH_ARRAY } from "../../../utils/notation";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";

/** Above this many periods between the first and the last date, gaps are not filled with empty periods. */
const MAX_GAP_FILLED_PERIODS = 10000;

/** Tracks whether the internal data model needs to be regenerated. */
enum FactoryState {
  UP_TO_DATE,
  DIRTY,
}

/** Classifies how a data model entry should be rendered: as an absolute or relative variance, or as a regular scenario. */
enum VarianceType {
  RELATIVE = "dr",
  ABSOLUTE = "d",
  NONE = "",
}

/** Row shape returned by AlaSQL after date normalization and scenario aggregation. */
type TimeChartResponseRow = {
  id: number;
  calcdate: DateTime;
  category: string | null;
  ac1: number | null;
  ac2: number | null;
  ac3: number | null;
  ac4: number | null;
  pp1: number | null;
  pp2: number | null;
  pp3: number | null;
  pp4: number | null;
  fc1: number | null;
  fc2: number | null;
  fc3: number | null;
  fc4: number | null;
  pl1: number | null;
  pl2: number | null;
  pl3: number | null;
  pl4: number | null;
  isEmpty: boolean;
};

/** One total column: the periods it covers, its name and its values. */
interface TotalColumn {
  from: number;
  to: number;
  /** Start of the group, null for one column over all periods. */
  start: DateTime | null;
  label: string;
  parts: { scenario: string; value: number }[];
  total: number;
  reference: { scenario: string; value: number } | null;
  /** The periods the computed value counts: the ones where the series has a value. Empty with a dataset. */
  counted: number[];
  /** The scenarios of the series that are in the value. */
  scenarios: string[];
}

/** Fill of the scaling indicator band, the light blue of the IBCS templates. */
const SCALING_INDICATOR_FILL = "#c5dbf2";
/** Line between the bands of the periods and of the total column. */
const SCALING_INDICATOR_LINE = "#5b9bd5";

/** Internal data model entry: one time period with up to 4 scenario DataPoints and a variance type. */
type TimeChartDataModelEntry = {
  id: number;
  category: string | null;
  type: VarianceType;
  date: DateTime;
  scenario1: DataPoint;
  scenario2: DataPoint;
  scenario3: DataPoint;
  scenario4: DataPoint;
  /** Stack by dimension: the series of the period, in the same order in every period. */
  series?: StackSeries[];
};

/** One series of a stack by dimension: its value per scenario slot in one period. */
type StackSeries = { key: string; points: Record<string, DataPoint> };

/**
 * One segment of a stack. A series of a stack by dimension has a `label` and a
 * `colorIndex` that stay the same in every period.
 */
type StackGroupSegment = {
  value: number;
  scenario: string;
  dataPoint: DataPoint;
  colorIndex?: number;
  label?: string;
};

/**
 * One stack of a period with its layout; `prefix` names the scenario family of an overlay stack.
 * `hasValue` is false when no segment has a value: such a stack keeps its place and draws nothing.
 */
type StackGroup = { prefix: string; segments: StackGroupSegment[]; layout: StackLayout; hasValue: boolean };

/**
 * Orchestrates the full rendering pipeline for an IBCS time series chart.
 *
 * Rendering pipeline (in draw()):
 * 1. Clears the SVG container
 * 2. Routes to the appropriate drawing method based on chart type:
 *    - Variance chart: drawVarianceScenario() for absolute/relative variance bars
 *    - Stacked chart: drawStackedScenarios() or drawStackedAreaScenarios() (line mode)
 *    - Standard chart: drawScenarios() (bar mode) or drawLineScenarios() (line mode)
 * 3. Draws axis baseline + date labels via drawAxisAndLabels()
 *
 * Data pipeline (in setConfig()):
 * 1. Raw data is filtered via AlaSQL (optional WHERE clause)
 * 2. Dates are normalized to the configured interval (day/week/month/quarter/year)
 * 3. Scenarios are aggregated per date bucket (SUM with operation sign)
 * 4. Missing date buckets are filled via leftOuterJoinDates()
 * 5. Variance model is computed from base/delta scenario pairs
 * 6. Min/max DataPoints are found for coordinate system sizing
 *
 * Auto chart mode: when dataModel.length exceeds maxBars, switches from bar to line.
 */
/** One step of a variance walk: the column of a period between two levels, in data units. */
interface WalkStep {
  index: number;
  from: number;
  to: number;
  point: DataPoint;
  /** Counts the total columns on the axis before the step: a walk starts again behind each of them. */
  run: number;
}

/** The bridge between two totals: the reference, the steps of the walk and the total they end at. */
interface Bridge {
  reference: { scenario: string; value: number };
  total: number;
  steps: WalkStep[];
}

const WALK_LINE = "#808080";

export class TimeChart {
  public styles: TimeChartStyle;
  readonly CSS_CATEGORIES: string = "categories";
  private dataModel: TimeChartDataModelEntry[] = [];
  private variancesDataModel: TimeChartDataModelEntry[] = [];
  private position: ElementPositions;
  private title: string = "";
  /** Raw config inputs the title derives from; kept so setI18n can recompute it. */
  private configTitle: string = "";
  private configVariances: string[] = [];
  private smallestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private smallestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private pixelPerUnit: number = 1;
  private pixelPerPercentage: number = 1;
  private hideAxisLabels: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  private db: AlaSQLDatabase;
  private tableName: string;
  private fromExpr: string = "";
  private rowCount: number = 0;
  /** Text of the first query that failed since the source was set. The component reports it as ERR_sql. */
  private queryError: string | undefined;

  private axisCategoryArea: { width: number; height: number } = { width: 0, height: 0 };
  private scenariosArea: { width: number; height: number } = { width: 0, height: 0 };
  private state: FactoryState = FactoryState.DIRTY;
  private i18n: Map<string | number, string> = new Map();
  private leftSideOffsetForHorizontalSync: number = -1;
  private dateInterval: DateDistance = DateDistance.DAY;

  private locale: string = "de";
  private axisLabelsMode: AxisLabelsMode = AxisLabelsMode.SMART;

  private intervalSpanLimit: number = 32;

  private ruleSet: VisualisationRuleSet;

  private measureScale: SiPrefix = new SiPrefix();
  private measureUnit: string = "";
  private dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };
  private showOverlayMedian: boolean = false;
  private showOverlayAvg: boolean = false;
  private chartMode: ChartMode = ChartMode.BAR;
  private maxBars: number = 28;
  private stackConfig: StackConfigParsed | null = null;
  private scenarioPropOrder: string[] = [];
  private lineFullWidth: boolean = true;
  private availableWidth: number = 0;
  private overflowConfig: OverflowConfig | null = null;
  private lastScenarios: string[] = [];
  private axisLabelsStep: number = 1;
  private scalingIndicator: number = 0;
  private totals: TotalsConfig | null = null;
  private totalColumns: TotalColumn[] = [];
  private totalVariances: (DataPoint | null)[] = [];
  private highestColumnDataPointValue: DataPoint = new DataPoint(0, "default", 0, Scenario.NEU);
  private highestPeriodVarianceDataPointValue: DataPoint = new DataPoint(0, "default", 0, Scenario.NEU);
  private scenarioSwitch: boolean = false;
  private axisTitlePosition: string = "left";
  private varianceWaterfall: boolean = false;
  private bridgeVariances: string[] = [];
  private referenceColumn: boolean = false;
  private bridge: Bridge | null = null;
  private bridgeFallback: string | null = null;
  /** The steps of a variance row that is a walk, empty for every other chart. */
  private walk: WalkStep[] = [];
  private syncedLeft: boolean = false;
  /** Periods in which more than one variance of a shared row has a value. */
  private varianceOverlaps: number = 0;

  constructor(
    ruleSet: VisualisationRuleSet,
    db: AlaSQLDatabase,
    tableName: string,
    config: TimeChartComponentConfig,
    styles: TimeChartStyle,
    availableWidth: number = 0,
  ) {
    this.db = db;
    this.tableName = tableName;
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.i18n = this.createI18n(new Map());
    this.styles = styles;
    this.availableWidth = availableWidth;
    this.setConfig(config);
    this.position = this.createElementPosition(this.lastScenarios);
  }

  public updatePosition(scenarios: string[]) {
    this.position = this.createElementPosition(scenarios);
  }

  public setStyles(newStyle: TimeChartStyle) {
    this.styles = newStyle;
  }

  public setRuleSet(ruleSet: VisualisationRuleSet) {
    this.ruleSet = ruleSet || new IBCSRuleSet();
  }

  public setAvailableWidth(w: number) {
    this.availableWidth = w;
  }

  public setAvailableHeight(availableHeight: number): void {
    // Only apply overdrive for manual scaling in bar mode
    if (this.pixelPerUnit <= 0 || availableHeight <= 0) {
      this.overflowConfig = null;
      return;
    }

    if (this.stackConfig != null) {
      this.overflowConfig = null;
      return;
    }
    // a walk has no break marks: a cut step would move every level behind it
    if (this.isWalkTier()) {
      const cut = this.overflowConfig != null;
      this.overflowConfig = null;
      if (cut) {
        // the positions were built for the cut columns of the chart before
        this.updatePosition(this.lastScenarios);
      }
      return;
    }

    const effectiveMode = this.determineEffectiveChartMode();
    if (effectiveMode !== ChartMode.BAR) {
      this.overflowConfig = null;
      return;
    }

    this.overflowConfig = this.calculateOverflowConfig(availableHeight);

    // Rebuild position with virtual max so the coordinate system fits the container
    if (this.overflowConfig) {
      this.updatePosition(this.lastScenarios);
    }
  }

  private calculateOverflowConfig(availableHeight: number): OverflowConfig | null {
    const highest = this.isVarianceChart()
      ? this.highestPeriodVarianceDataPointValue
      : this.highestColumnDataPointValue;
    const highestScaledUnit = highest.getScaledUnit();
    if (highestScaledUnit <= 0) return null;

    const fontSize = this.styles.fontStyles.size;

    // Non-bar overhead: everything except the bars themselves (labels, axis, padding)
    const nonBarOverhead =
      this.position.dataLabelHeight +
      this.position.spacings.labelToColumn +
      this.position.padding.top +
      this.position.padding.bottom +
      this.position.spacings.labelToAxis +
      fontSize + // axis labels approximate height
      this.switchNamesHeight();

    const overdriveZoneHeight = fontSize * 1.5;
    const breakGap = fontSize * 0.3;
    const cutHeight = availableHeight - nonBarOverhead - overdriveZoneHeight - breakGap;

    // Non-AC scenarios break lower than AC by this offset
    const scenarioCutOffset = fontSize * 0.8;

    if (cutHeight <= scenarioCutOffset) return null;

    // Use the lower (non-AC) cut height for overflow detection threshold
    const lowestCutHeight = cutHeight - scenarioCutOffset;

    // No bar exceeds even the lowest cut height → no overflow needed
    if (highestScaledUnit <= lowestCutHeight) return null;

    // maxOverflow based on lowest cut height so no bar exceeds overdriveZoneHeight
    const maxOverflow = highestScaledUnit - lowestCutHeight;

    return {
      cutHeight,
      overdriveZoneHeight,
      breakGap,
      maxOverflow,
      scenarioCutOffset,
    };
  }

  setConfig(config: TimeChartComponentConfig) {
    this.state = FactoryState.DIRTY;

    // Must precede setSource/populateModel: the locale is baked into the
    // normalizeDate() SQL as well as into the axis date labels.
    this.locale = config.locale;
    this.scenarioPropOrder = [...config.scenarios];
    const scenarios = this.sortScenariosbyVisualisationRules(config.scenarios);

    this.setSource(config.filter);
    this.hideAxisLabels = config.hideAxisLabels || false;
    this.pixelPerUnit = config.pixelPerUnit;
    this.pixelPerPercentage = config.pixelPerPercentage;
    this.axisLabelsMode = config.axisLabelsMode;
    this.intervalSpanLimit = config.intervalSpanLimit;
    this.axisLabelsStep = config.axisLabelsStep ?? 1;
    this.scalingIndicator = config.scalingIndicator ?? 0;
    this.totals = config.totals ?? null;
    this.scenarioSwitch = config.scenarioSwitch ?? false;
    this.varianceWaterfall = config.varianceWaterfall ?? false;
    this.bridgeVariances = config.bridgeVariances ?? [];
    this.referenceColumn = config.referenceColumn ?? false;
    this.syncedLeft = config.syncedLeft ?? false;
    this.axisTitlePosition = config.axisTitlePosition ?? "left";
    this.dateInterval = this.findDateInterval(config.dateInterval);
    // the model of a stack by dimension holds the series
    this.stackConfig = config.stackConfig;

    this.dataModel = this.populateModel(scenarios, this.dateInterval);
    this.variancesDataModel = this.populateVarianceModel(config.variances, this.dataModel);
    this.configTitle = config.title;
    this.configVariances = config?.variances ?? [];

    this.smallestDataPointValue = this.findSmallestDataPointValue(this.dataModel);
    this.smallestVarianceDataPointValue = this.findSmallestDataPointValue(this.variancesDataModel);

    this.highestDataPointValue = this.findHighestDataPointValue(this.dataModel);
    this.highestVarianceDataPointValue = this.findHighestDataPointValue(this.variancesDataModel);
    this.axisScenario = this.setAxisScenario(config.variances);
    this.leftSideOffsetForHorizontalSync = config.leftSideOffsetForHorizontalSync;

    this.measureScale = config.measureScale;

    this.measureUnit = config.measureUnit;
    this.dataFormatDigits = config.dataFormatDigits;

    this.showOverlayMedian = config.showOverlayMedian;
    this.showOverlayAvg = config.showOverlayAvg;
    this.chartMode = config.chartMode;
    this.maxBars = config.maxBars;
    this.stackConfig = config.stackConfig;
    this.lineFullWidth = config.lineFullWidth;
    this.lastScenarios = scenarios;

    if (this.stackConfig != null) {
      // a stack is as high as its two sides, not as its largest segment: virtual data points for the layout
      const layouts: StackLayout[] = [];
      for (const row of this.dataModel) {
        layouts.push(...this.stackGroups(row).map((group) => group.layout));
      }
      const sides = stackExtent(layouts);
      const { reference } = this.seriesSlots();
      if (reference) {
        // the column behind the stack can be the highest element
        for (const row of this.dataModel) {
          const value = row[reference]?.value;
          if (Number.isFinite(value)) {
            sides.positive = Math.max(sides.positive, value);
            sides.negative = Math.max(sides.negative, -value);
          }
        }
      }
      const { scenario, variance } = this.highestDataPointValue;
      this.highestDataPointValue = new DataPoint(sides.positive, scenario, this.pixelPerUnit, variance);
      this.smallestDataPointValue = new DataPoint(0 - sides.negative, scenario, this.pixelPerUnit, variance);
    }

    // the highest column: a break mark is for a column that does not fit, not for the band
    this.highestColumnDataPointValue = this.highestDataPointValue;

    // the highest period variance: a break mark is for a variance of a period, the total has its own cut
    this.highestPeriodVarianceDataPointValue = this.highestVarianceDataPointValue;
    this.totalColumns = this.computeTotalColumns();
    this.bridge = this.computeBridge();
    this.totalVariances = this.computeTotalVariances();
    const walk = this.isWalkTier() ? this.walkSteps(this.variancesDataModel) : [];
    this.walk = walk;
    if (walk.length > 0) {
      // a walk is as high as its levels, not as its largest step
      const levels = walk.flatMap((step) => [step.from, step.to]);
      const { scenario, variance } = this.highestVarianceDataPointValue;
      this.highestVarianceDataPointValue = new DataPoint(Math.max(0, ...levels), scenario, this.pixelPerUnit, variance);
      this.smallestVarianceDataPointValue = new DataPoint(
        Math.min(0, ...levels),
        scenario,
        this.pixelPerUnit,
        variance,
      );
      this.highestPeriodVarianceDataPointValue = this.highestVarianceDataPointValue;
    }
    for (const point of this.totalVariances) {
      if (point == null || !Number.isFinite(point.value)) continue;
      if (point.value > Number(this.highestVarianceDataPointValue.value)) {
        this.highestVarianceDataPointValue = point;
      }
      if (point.value < Number(this.smallestVarianceDataPointValue.value)) {
        this.smallestVarianceDataPointValue = point;
      }
    }

    if (this.hasScalingIndicator() && this.scalingIndicator > Number(this.highestDataPointValue.value)) {
      // the band is part of the chart: it can be higher than every column
      const { scenario, variance } = this.highestDataPointValue;
      this.highestDataPointValue = new DataPoint(this.scalingIndicator, scenario, this.pixelPerUnit, variance);
    }

    // the total column has its own scale: it counts for the height with the pixels it needs
    const totalHeight = this.isVarianceChart() ? 0 : this.totalsHeight();
    if (totalHeight > this.highestDataPointValue.getScaledUnit() && this.pixelPerUnit > 0) {
      const { scenario, variance } = this.highestDataPointValue;
      this.highestDataPointValue = new DataPoint(
        totalHeight / this.pixelPerUnit,
        scenario,
        this.pixelPerUnit,
        variance,
      );
    }

    // the name of a shared variance row needs the scenarios of the series
    this.updateTitle();
    this.updatePosition(scenarios);
  }

  public getFooter(): string {
    if (this.measureScale.value === 1 && this.measureUnit === "") {
      return " ";
    }
    return Formatter.translateScenarioLabel("in", this.i18n) + " " + this.measureScale.prefix + this.measureUnit;
  }

  /** Returns a new array; the input keeps the `scenarios` prop order (the config is reused across rebuilds). */
  private sortScenariosbyVisualisationRules(scenarios: string[]): string[] {
    const self = this;
    return [...scenarios]
      .sort((n1, n2) => {
        return self.ruleSet.getScenarioSorIndex(n1) - self.ruleSet.getScenarioSorIndex(n2);
      })
      .reverse();
  }

  /**
   * Init load of translation dictionary map
   * map is used to translate lables in the table
   *
   * example:
   * ```
   *   let i18n: Map<string, string> = new Map();
   *   [{key: 'ac',value: 'AC'}].forEach(function(entry){
   *         i18n.set(entry.key, entry.value);
   *   })
   * ```
   * @param i18n
   */
  public setI18n(i18n: Map<string, string>) {
    this.i18n = this.createI18n(i18n);
    // The variance title bakes translated scenario labels in, and setI18n
    // arrives after the constructor's setConfig - recompute it here so the
    // first render doesn't keep the built-in labels (e.g. ΔPY vs ΔVorjahr).
    this.updateTitle();
  }

  /** Derives the variance title from the stored config and the current i18n map. */
  private updateTitle() {
    // variances that share a row have the same reference: the first one names the row
    let variance = this.scenarioSwitch ? this.configVariances?.[0] : this.configVariances?.toString();
    if (this.scenarioSwitch && variance) {
      // the row holds the variances of every scenario of the series, so its name is the reference only
      // only for a variance of the series itself: of the first scenario or of one that follows it
      const parsed = new VarianceScenario(variance);
      const row = this.dataModel?.[0];
      const slot = ["scenario1", "scenario2", "scenario3", "scenario4"].find(
        (key) => row?.[key]?.scenario === parsed.base,
      );
      if (parsed.isValid && slot != null && (slot === "scenario1" || this.followerSlots().includes(slot))) {
        variance = `${parsed.type}ac1_${parsed.delta}_${parsed.direction}`;
      }
    }
    this.title = this.configTitle || Formatter.translateScenarioLabel(variance, this.i18n);
  }

  /**
   * Resolves the dataset (a table or view in the shared alasql database) and
   * caches its row count. Subsequent queries reference the source by name -
   * alasql doesn't have to ingest a fresh array per call.
   */
  public setSource(filter: string): void {
    this.state = FactoryState.DIRTY;
    this.queryError = undefined;
    // "" while the source is not registered yet: no data, and no error
    this.fromExpr = sourceExpr(this.db, this.tableName, filter);
    if (!this.fromExpr) {
      this.rowCount = 0;
      return;
    }
    try {
      const r = this.db.exec<{ cnt: number }[]>(`SELECT COUNT(*) AS cnt FROM ${this.fromExpr}`);
      this.rowCount = (r[0]?.cnt ?? 0) as number;
    } catch (e) {
      this.rowCount = 0;
      this.failQuery(e);
    }
  }

  public getQueryError(): string | undefined {
    return this.queryError;
  }

  private failQuery(e: unknown): void {
    this.queryError ??= errorText(e);
  }

  public getAllocatedCanvasWidth(): number {
    // Analytical calculation - doesn't rely on text bbox (unreliable in detached SVGs)
    const axisEnd = this.position.getAxisEndPositionX();
    // Buffer for the last date label extending beyond axis end
    const labelBuffer = this.styles.fontStyles.size * 3;

    // Also consider bbox-based measurement as a fallback (works for rects)
    const bboxWidth = Math.max(this.axisCategoryArea.width, this.scenariosArea.width);
    const bboxTotal = bboxWidth > 0 ? bboxWidth + this.position.leftSideLabelLength : 0;

    let titleEnd = 0;
    if (this.axisTitlePosition === "right" && this.title) {
      const titleWidth = CalculateSize(this.title, {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      }).width;
      titleEnd =
        (this.rightTitleX() ?? axisEnd + this.position.spacings.labelToColumn) + titleWidth + this.styles.padding.right;
    }

    const legendWidth = this.legendWidth("right");
    const legendEnd =
      legendWidth > 0 ? axisEnd + this.position.spacings.labelToColumn + legendWidth + this.styles.padding.right : 0;

    let indicatorEnd = 0;
    if (this.hasScalingIndicator()) {
      const textWidth = CalculateSize(this.scalingIndicatorText(), {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      }).width;
      indicatorEnd = this.scalingIndicatorLabelX() + textWidth + this.styles.padding.right;
    }

    const totalEnd = this.hasEndTotal()
      ? this.totalGeometry(0).right + this.endTotalTextWidth() + this.bridgeEndWidth() + this.styles.padding.right
      : 0;

    return Math.max(axisEnd + labelBuffer, bboxTotal, titleEnd, legendEnd, indicatorEnd, totalEnd);
  }

  public getAllocatedCanvasHeight(): number {
    if (
      this.smallestVarianceDataPointValue.value == null ||
      this.highestVarianceDataPointValue.value == null ||
      this.smallestDataPointValue.value == null ||
      this.highestDataPointValue.value == null
    ) {
      return 0;
    }

    // Analytical calculation - doesn't rely on text bbox
    const isRelative =
      this.isVarianceChart() &&
      this.variancesDataModel.some((e: TimeChartDataModelEntry) => e.type === VarianceType.RELATIVE);
    const axisY = this.position.getAxisPositionY(isRelative);
    // Space below axis: gap to date labels + date label height + bottom padding
    const belowAxis = this.position.spacings.labelToAxis + this.position.dataLabelHeight + this.styles.padding.bottom;

    let analyticalHeight: number;
    if (!this.isOnSameAxisSide()) {
      // Bars extend below axis - account for negative bar + its data label
      const min = this.isVarianceChart() ? this.smallestVarianceDataPointValue : this.smallestDataPointValue;
      const minScaled = Math.abs(min.getScaledUnit());
      analyticalHeight =
        axisY + minScaled + this.position.spacings.labelToColumn + this.position.dataLabelHeight + belowAxis;
    } else {
      analyticalHeight = axisY + belowAxis;
    }

    // Also consider bbox-based measurement as a fallback
    const isOnSameAxisSide = this.isOnSameAxisSide();
    const bboxHeight = isOnSameAxisSide
      ? this.axisCategoryArea.height + this.scenariosArea.height
      : this.scenariosArea.height;

    return Math.max(analyticalHeight, bboxHeight) + this.switchNamesHeight();
  }

  /**
   * Room for the second row under the category labels: the scenario names of a
   * `scenarioSwitch` chart, and in `two-row` mode the parent periods.
   */
  private switchNamesHeight(): number {
    return !this.hideAxisLabels && this.contextRow().length > 0 ? this.position.dataLabelHeight : 0;
  }

  /** The parent period of a period in `two-row` mode: the year of a month, quarter or week, the month of a day. */
  private parentPeriodLabel(date: DateTime): string {
    if (this.axisLabelsMode !== AxisLabelsMode.TWO_ROW || date == null || !date.isValid) {
      return "";
    }
    switch (this.dateInterval) {
      case DateDistance.MONTH:
      case DateDistance.QUARTER:
        return date.setLocale(this.locale).toFormat("yyyy");
      case DateDistance.WEEK:
        // week 1 can start in December: the week year, as the week labels use it
        return date.setLocale(this.locale).toFormat("kkkk");
      case DateDistance.DAY:
        return date.setLocale(this.locale).toFormat("LLL yyyy");
      default:
        return "";
    }
  }

  /**
   * The texts of the second row under the category labels. `two-row` mode: the
   * parent period under the first period and where it changes, joined with the
   * scenario name where a run starts, each under its period. Else the scenario
   * names alone, each under the middle of its run.
   */
  private contextRow(): { from: number; to: number; text: string; scenario: string }[] {
    const runs = this.switchRuns();
    if (this.axisLabelsMode !== AxisLabelsMode.TWO_ROW) {
      return runs.map((run) => ({
        from: run.from,
        to: run.to,
        text: Formatter.translateScenarioLabel(run.scenario, this.i18n),
        scenario: run.scenario,
      }));
    }

    // the line chart writes its own labels and has no second row
    if (!this.isVarianceChart() && this.determineEffectiveChartMode() !== ChartMode.BAR) {
      return [];
    }
    const model = this.isVarianceChart() ? this.variancesDataModel : this.dataModel;
    const entries: { from: number; to: number; text: string; scenario: string }[] = [];
    let lastParent = "";
    model.forEach((row, index) => {
      const run = runs.find((candidate) => candidate.from === index);
      const parent = this.parentPeriodLabel(row.date);
      const parts: string[] = [];
      if (parent !== "" && parent !== lastParent) {
        parts.push(parent);
      }
      lastParent = parent;
      if (run) {
        parts.push(Formatter.translateScenarioLabel(run.scenario, this.i18n));
      }
      if (parts.length > 0) {
        entries.push({ from: index, to: index, text: parts.join(" "), scenario: run?.scenario ?? "parent" });
      }
    });
    return entries;
  }

  /** True for a scenario slot that has a value in this period. */
  private static hasValue(dataPoint: DataPoint | undefined): boolean {
    return dataPoint != null && !dataPoint.isEmpty() && dataPoint.value != null && !Number.isNaN(dataPoint.value);
  }

  /** True for a point of a series with a value other than 0. A dataset often has 0 where a scenario has no value. */
  private static hasAmount(point: DataPoint | undefined): boolean {
    return point != null && Number.isFinite(point.value) && point.value !== 0;
  }

  /**
   * The slots that continue the first scenario: they have values, and only in
   * periods where the first scenario has none. Empty without `scenarioSwitch`.
   */
  private followerSlots(): string[] {
    // a stack by scenario draws its scenarios on top of each other: nothing follows there
    const stacksScenarios = this.stackConfig != null && this.stackConfig.by !== StackBy.DIMENSIONS;
    if (!this.scenarioSwitch || stacksScenarios || this.determineEffectiveChartMode() !== ChartMode.BAR) {
      return [];
    }
    return ["scenario2", "scenario3", "scenario4"].filter((slot) => {
      let values = 0;
      for (const row of this.dataModel) {
        if (TimeChart.hasValue(row[slot])) {
          if (TimeChart.hasValue(row.scenario1)) {
            return false;
          }
          values++;
        }
      }
      return values > 0;
    });
  }

  /** The slot drawn as the column of a period: the first scenario, else the first follower with a value. */
  private visibleSlot(row: TimeChartDataModelEntry, followers: string[]): string | null {
    if (TimeChart.hasValue(row.scenario1)) {
      return "scenario1";
    }
    return followers.find((slot) => TimeChart.hasValue(row[slot])) ?? null;
  }

  /** Runs of periods with the same visible scenario. A period without a value belongs to the run before it. */
  private switchRuns(): { scenario: string; from: number; to: number }[] {
    const stacksScenarios = this.stackConfig != null && this.stackConfig.by !== StackBy.DIMENSIONS;
    if (!this.scenarioSwitch || stacksScenarios || this.determineEffectiveChartMode() !== ChartMode.BAR) {
      return [];
    }
    const followers = this.followerSlots();
    // a chart with one scenario is one run: its scenario still gets its name under the axis
    if (followers.length === 0 && this.scenarioPropOrder.length !== 1) {
      return [];
    }
    const runs: { scenario: string; from: number; to: number }[] = [];
    this.dataModel.forEach((row, index) => {
      const slot = this.visibleSlot(row, followers);
      const scenario = slot ? (row[slot].scenario as string) : null;
      const last = runs[runs.length - 1];
      if (scenario == null || last?.scenario === scenario) {
        if (last) last.to = index;
        return;
      }
      runs.push({ scenario, from: index, to: index });
    });
    return runs;
  }

  /**
   * Stack by dimensions with `scenarioSwitch`: the roles of the scenarios that
   * have values in the periods of the first one. A `fill` scenario has values
   * only for series where the visible scenario has none, so it fills these
   * segments (the forecast part on top of the actual part). The first other
   * scenario is the `reference`: the column behind the stack, from the total
   * of its period.
   */
  private seriesSlots(): { fill: string[]; reference: string | null } {
    const none = { fill: [], reference: null };
    if (
      !this.scenarioSwitch ||
      this.stackConfig?.by !== StackBy.DIMENSIONS ||
      this.determineEffectiveChartMode() !== ChartMode.BAR
    ) {
      return none;
    }
    const followers = this.followerSlots();
    const finite = (point: DataPoint | undefined): boolean => TimeChart.hasAmount(point);
    const fill: string[] = [];
    let reference: string | null = null;
    for (const slot of ["scenario2", "scenario3", "scenario4"]) {
      if (followers.includes(slot)) continue;
      let values = 0;
      let shared = false;
      for (const row of this.dataModel) {
        const visible = this.visibleSlot(row, followers) ?? "scenario1";
        for (const entry of row.series ?? []) {
          if (finite(entry.points[slot])) {
            values++;
            shared = shared || finite(entry.points[visible]);
          }
        }
      }
      if (values === 0) continue;
      if (!shared) {
        fill.push(slot);
      } else if (reference == null && this.stackConfig.mode !== StackMode.RELATIVE) {
        reference = slot;
      }
    }
    return { fill, reference };
  }

  /**
   * Stack by dimensions with `scenarioSwitch`: the scenarios with values that
   * are not drawn, because they have values in periods of the first scenario
   * or because the chart is a stacked area. The component warns about them.
   */
  public getIgnoredSwitchScenarios(): string[] {
    if (!this.scenarioSwitch || this.stackConfig?.by !== StackBy.DIMENSIONS || this.isVarianceChart()) {
      return [];
    }
    const followers = this.followerSlots();
    const { fill, reference } = this.seriesSlots();
    const drawn = [...followers, ...fill, reference];
    return ["scenario2", "scenario3", "scenario4"]
      .filter((slot) => !drawn.includes(slot) && this.dataModel.some((row) => TimeChart.hasValue(row[slot])))
      .map((slot) => this.dataModel.find((row) => row[slot]?.scenario != null)?.[slot].scenario as string);
  }

  /** Number of periods where variances of one row overlap. The component warns about it. */
  public getVarianceOverlaps(): number {
    return this.varianceOverlaps;
  }

  /**
   * Lifts the 145 % cut of relative variances when the uncut pins fit into
   * `availableHeight`. Only for a fixed percentage scale: the author chose it,
   * so a long pin is cut for lack of room only.
   */
  public fitRelativeVariances(availableHeight: number): void {
    const points = this.variancesDataModel
      .filter((entry) => entry.type === VarianceType.RELATIVE)
      .map((entry) => entry.scenario1);
    if (points.length > 0) {
      // the pins of the total columns are pins of the row
      points.push(...this.totalVariances.filter((point): point is DataPoint => point != null));
    }
    if (points.length === 0 || !points.some((point) => point.isClipped())) {
      return;
    }
    const setClamp = (clamp: number) => {
      points.forEach((point) => (point.percentClamp = clamp));
      this.updatePosition(this.lastScenarios);
    };
    setClamp(Number.POSITIVE_INFINITY);
    this.layout();
    // an unknown height on either side keeps the cut
    if (!(availableHeight > 0) || !(this.getAllocatedCanvasHeight() <= availableHeight)) {
      setClamp(DataPoint.PERCENT_CLAMP);
    }
  }

  /**
   * Total column extent (data units) proportional to pixelPerUnit, covering
   * both sides of the axis (negative columns extend below it). Mirrors the
   * DataPoints getAllocatedCanvasHeight allocates with; used by autoFitScaling
   * to separate fixed from variable height components.
   */
  public getUnitBarExtent(): number {
    const isRelative =
      this.isVarianceChart() &&
      this.variancesDataModel.some((e: TimeChartDataModelEntry) => e.type === VarianceType.RELATIVE);
    const usesVariance = this.isVarianceChart();
    const highest = usesVariance ? this.highestVarianceDataPointValue : this.highestDataPointValue;
    const smallest = usesVariance ? this.smallestVarianceDataPointValue : this.smallestDataPointValue;

    return computeUnitBarExtent({
      relativeVariance: isRelative,
      maxPositive: highest?.value ?? 0,
      minNegative: this.isOnSameAxisSide() ? 0 : (smallest?.value ?? 0),
    });
  }

  /**
   * Total column extent (fraction units) proportional to pixelPerPercentage.
   * Only relative variances scale with it; each side clamps at +/-145%.
   */
  public getPercentBarExtent(): number {
    const isRelative =
      this.isVarianceChart() &&
      this.variancesDataModel.some((e: TimeChartDataModelEntry) => e.type === VarianceType.RELATIVE);

    return computePercentBarExtent({
      relativeVariance: isRelative,
      maxPositive: this.highestVarianceDataPointValue?.value ?? 0,
      minNegative: this.isOnSameAxisSide() ? 0 : (this.smallestVarianceDataPointValue?.value ?? 0),
    });
  }

  /**
   * Runs `draw()` purely for its side effects - it is what finalizes the
   * positions and the allocated-area fields that `getAllocatedCanvas*()` read.
   *
   * The auto-fit solver measures the chart once per iteration and only needs
   * those numbers, so it calls this instead of {@link toString}: the XML
   * serialization of a tree that is immediately discarded is pure overhead.
   */
  public layout(): void {
    const container = new Svg();
    drawAttached(container, () => this.draw(container));
  }

  public toString(): string {
    const container = new Svg();
    drawAttached(container, () => this.draw(container));
    container.id("drawCanvas");
    container.width(this.getAllocatedCanvasWidth());
    container.height(this.getAllocatedCanvasHeight());
    container.attr("overflow", "visible");
    return container.svg();
  }

  /**
   * Writes the chart's font onto the SVG root as presentation attributes.
   *
   * `font-size` and `font-family` are inherited, so a `<text>` with neither of
   * its own takes whatever its ancestor chain supplies. That chain is not stable
   * across the places this SVG gets measured: drawn detached, svg.js's `bbox()`
   * clones the element into a sandbox under `document.body`, where it inherits
   * the document default - 16px Times - instead of the chart's real font. Every
   * label was measured ~9% too wide as a result, which over-allocated label
   * space and pushed labels past the `maxWidth` threshold that drops them.
   *
   * Setting the font here makes a measurement independent of where it happens.
   * Stylesheet rules still win over presentation attributes, so this changes
   * nothing about how the chart renders in place - the CSS and this attribute
   * resolve to the same value, both being `fontSizePx * effectiveScaleFactor`.
   */
  private applyFontToContainer(svgContainer: Svg): void {
    svgContainer.attr({
      "font-size": this.styles.fontStyles.size,
      "font-family": this.styles.fontStyles.family,
    });
  }

  public draw(svgContainer: Svg): void {
    this.cleanSVGforRedraw(svgContainer);
    this.applyFontToContainer(svgContainer);

    if (this.state === FactoryState.DIRTY) {
      this.state = FactoryState.UP_TO_DATE;
    }

    if (this.isVarianceChart()) {
      if (this.isWalkTier()) {
        this.drawVarianceWalk(svgContainer);
      } else {
        this.drawVarianceScenario(this.variancesDataModel, svgContainer);
      }
      // before the axis: the line of a scenario switch runs over the full height of the row
      this.drawTotalVariances(svgContainer);
      this.drawAxisAndLabels(this.variancesDataModel, svgContainer);
    } else if (this.stackConfig != null) {
      const effectiveChartMode = this.determineEffectiveChartMode();
      if (effectiveChartMode === ChartMode.LINE) {
        this.drawStackedAreaScenarios(this.dataModel, svgContainer);
        this.drawAxisAndLabelsForLineChart(this.dataModel, svgContainer);
      } else {
        this.drawStackedScenarios(this.dataModel, svgContainer);
        this.drawStackedHeaders(this.dataModel, svgContainer);
        this.drawAxisAndLabels(this.dataModel, svgContainer);
        this.drawScalingIndicator(svgContainer);
      }
    } else {
      const effectiveChartMode = this.determineEffectiveChartMode();

      if (effectiveChartMode === ChartMode.LINE) {
        this.drawLineScenarios(this.dataModel, svgContainer);
        this.drawAxisAndLabelsForLineChart(this.dataModel, svgContainer);
      } else {
        this.drawScenarios(this.dataModel, svgContainer);
        this.drawOverlayLayer(this.dataModel, svgContainer);
        this.drawAxisAndLabels(this.dataModel, svgContainer);
        this.drawScalingIndicator(svgContainer);
        this.drawTotalColumns(svgContainer);
        this.drawBridge(svgContainer);
      }
    }
  }

  /** True for a chart that draws the scaling indicator: columns or an absolute stack, no variance chart. */
  private hasScalingIndicator(): boolean {
    return (
      this.scalingIndicator > 0 &&
      !this.isVarianceChart() &&
      // the segment of a variance that is not valid has no variance model, but it is no base chart
      (this.configVariances ?? []).every((variance) => !variance) &&
      this.determineEffectiveChartMode() === ChartMode.BAR &&
      this.stackConfig?.mode !== StackMode.RELATIVE
    );
  }

  /** The value of the scaling indicator, printed like a value label. */
  private scalingIndicatorText(): string {
    const digits = this.dataFormatDigits?.decimal ?? 1;
    return Formatter.number(
      this.scalingIndicator,
      "decimal",
      digits,
      digits,
      this.measureScale?.value || 1,
      this.styles.locale,
    );
  }

  private scalingIndicatorTextWidth(): number {
    return CalculateSize(this.scalingIndicatorText(), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;
  }

  /** Where the label of the scaling indicator starts: right of the last column, and of the series names there. */
  private scalingIndicatorLabelX(): number {
    const gap = this.position.spacings.labelToColumn;
    const half = this.position.getColumnWidth() / 2 + this.position.spacings.scenarioOffset;
    let right = this.position.getColumnCenterPositionX(Math.max(0, this.dataModel.length - 1)) + half;
    if (this.hasTotals() && !this.hasEndTotal()) {
      // a total stands behind the last period: the value goes behind it
      right = Math.max(right, this.totalGeometry(this.totalColumns.length - 1).right);
    }
    const legendWidth = this.legendWidth("right");
    return right + gap + (legendWidth > 0 ? legendWidth + gap : 0);
  }

  /** The band of the scaling indicator over the periods, null when it is not drawn. */
  private scalingIndicatorBand(): { left: number; right: number; height: number } | null {
    if (!this.hasScalingIndicator() || this.dataModel.length === 0) {
      return null;
    }
    const half = this.position.getColumnWidth() / 2 + this.position.spacings.scenarioOffset;
    const height = this.scalingIndicator * this.pixelPerUnit;
    // columns are cut below the band: a shorter band would show a wrong scale, so there is none
    if (this.overflowConfig && height > this.overflowConfig.cutHeight) {
      return null;
    }
    return {
      left: this.position.getColumnCenterPositionX(0) - half,
      right: this.position.getColumnCenterPositionX(this.dataModel.length - 1) + half,
      height,
    };
  }

  /**
   * The scaling indicator: a band behind the columns from the axis up to the
   * value, and the value at its right end.
   */
  private drawScalingIndicator(svgContainer: Svg): void {
    const band = this.scalingIndicatorBand();
    if (band == null) {
      return;
    }
    const { left, right, height } = band;
    const axisY = this.position.getColumnPositionY();

    const group = svgContainer.group().id("ScalingIndicator");
    // totals on the axis have their own band at their own scale: the band of the periods leaves their place free
    const half = this.position.getColumnWidth() / 2 + this.position.spacings.scenarioOffset;
    const runs =
      this.hasTotals() && !this.hasEndTotal()
        ? this.totalRuns().map((run) => ({
            left: this.position.getColumnCenterPositionX(run.from) - half,
            right: this.position.getColumnCenterPositionX(run.to) + half,
          }))
        : [{ left, right }];
    for (const run of runs) {
      group
        .rect(run.right - run.left, height)
        .x(run.left)
        .y(axisY - height)
        .fill(SCALING_INDICATOR_FILL);
    }
    group.back();
    new Label(
      svgContainer.group().id("ScalingIndicatorLabel"),
      this.scalingIndicatorLabelX(),
      axisY - height,
      "SCALING_INDICATOR",
      this.scalingIndicatorText(),
      this.styles,
      HookLocation.Center,
      HookLocation.Left,
    ).forceStringTypeDraw();
  }

  /** Where a title at the right starts when a total column stands at the end: behind the column and its texts. */
  private rightTitleX(): number | undefined {
    if (!this.hasEndTotal()) {
      return undefined;
    }
    return this.totalGeometry(0).right + this.endTotalTextWidth() + this.position.spacings.labelToColumn;
  }

  /** True for a chart with total columns. */
  private hasTotals(): boolean {
    return this.totalColumns.length > 0;
  }

  /** True for the one total column of `by: all`: it stands apart at the end, with its own axis and its names. */
  private hasEndTotal(): boolean {
    return this.hasTotals() && this.totals!.by === "all";
  }

  /** The index of a total column for the positions: the totals follow the periods. */
  private totalIndex(total: number): number {
    // the index behind the last period stays what it is without totals: the end of the overlay lines
    return this.dataModel.length + 1 + total;
  }

  /** Place of a total column. `left` and `right` are the ends of its band, and of its own axis at the end. */
  private totalGeometry(total: number): { center: number; width: number; left: number; right: number } {
    const width = this.position.getColumnWidth() * (this.totals?.width ?? 1);
    const center = this.position.getColumnCenterPositionX(this.totalIndex(total));
    const margin = this.position.spacings.scenarioOffset;
    return { center, width, left: center - width / 2 - 2 * margin, right: center + width / 2 + margin };
  }

  /**
   * The places of the periods and of the total columns on the axis, in category
   * widths, and the number of places the axis of the periods covers. A total of
   * `by: all` stands one period behind the last one, with its own axis. The
   * other totals stand right behind the last period of their group, and the
   * periods after them move on.
   */
  private totalSlots(columnWidth: number, categoryWidth: number, fontSize: number, scenarioOffset: number) {
    const count = this.dataModel.length;
    const extra = categoryWidth > 0 ? (((this.totals?.width ?? 1) - 1) * columnWidth) / categoryWidth : 0;
    const slots: number[] = [];
    const totals: number[] = [];
    if (this.totals!.by === "all") {
      for (let index = 0; index < count; index++) slots.push(index);
      // the value of the band of the periods stands in the gap: the column moves right by its width.
      // Every tier of the chart knows the indicator, so the column has the same place in all of them.
      const shift =
        this.scalingIndicator > 0 && categoryWidth > 0
          ? (this.scalingIndicatorTextWidth() + scenarioOffset * fontSize) / (categoryWidth * fontSize)
          : 0;
      totals.push(count + 1 + extra / 2 + shift);
      return { slots: [...slots, count, ...totals], axisColumns: count };
    }
    // the names of the scenarios stand right of the last period: its total keeps one place of room for them.
    // A series with a scenario switch has its names under the axis.
    const followers = this.followerSlots();
    const lastRow = this.dataModel[count - 1];
    const lastIsFollower = followers.includes(this.visibleSlot(lastRow, followers) ?? "scenario1");
    // the second marker prints its name there too
    const markerName =
      !followers.includes("scenario4") && this.dataModel.some((row) => TimeChart.hasValue(row.scenario4));
    const namesRoom = lastIsFollower && !markerName ? 0 : 1;
    let offset = 0;
    let next = 0;
    for (let index = 0; index < count; index++) {
      slots.push(index + offset);
      const group = this.totalColumns[next];
      if (group != null && group.to === index) {
        const room = index === count - 1 ? namesRoom : 0;
        totals.push(index + offset + room + 1 + extra / 2);
        offset += room + 1 + extra;
        next++;
      }
    }
    return { slots: [...slots, count + offset, ...totals], axisColumns: count + offset };
  }

  /** The runs of periods between the total columns on the axis: each ends with the last period of a total, or of the chart. */
  private totalRuns(): { from: number; to: number }[] {
    const runs: { from: number; to: number }[] = [];
    let from = 0;
    for (const column of this.totalColumns) {
      runs.push({ from, to: column.to });
      from = column.to + 1;
    }
    if (from < this.dataModel.length) {
      runs.push({ from, to: this.dataModel.length - 1 });
    }
    return runs;
  }

  /** The start of the group of a date, null for one group over all periods. */
  private totalGroupStart(date: DateTime, period: boolean = false): DateTime | null {
    const by = this.totals?.by ?? "all";
    if (by === "all" || date == null || !date.isValid) {
      return null;
    }
    // a week belongs to the year, quarter or month of its Thursday, as its number does
    const day = period && this.dateInterval === DateDistance.WEEK && by !== "week" ? date.plus({ days: 3 }) : date;
    return day.startOf(by);
  }

  /** The name of a total column under the axis: the text of the config at the end, else the name of its period. */
  private totalLabel(start: DateTime | null): string {
    if (start == null) {
      return this.totals?.label ?? "";
    }
    const interval = {
      year: DateDistance.YEAR,
      quarter: DateDistance.QUARTER,
      month: DateDistance.MONTH,
      week: DateDistance.WEEK,
    }[this.totals!.by as "year" | "quarter" | "month" | "week"];
    return this.createDateFactory().getShortDateString(start, interval);
  }

  /** The scenarios of the series: the first one, and the ones that follow it. */
  private seriesSlotKeys(): string[] {
    return ["scenario1", ...this.followerSlots()];
  }

  /** The slot of the reference of a total: the first scenario with values that is not part of the series. */
  private referenceSlot(): string | null {
    const followers = this.followerSlots();
    for (const slot of ["scenario2", "scenario3", "scenario4"]) {
      if (followers.includes(slot)) continue;
      if (this.dataModel.some((row) => Number.isFinite(row[slot]?.value))) {
        return slot;
      }
    }
    return null;
  }

  /** The look of one column for several scenarios: a forecast wins, then a plan, then the first one. */
  private mixedScenario(scenarios: string[]): string {
    return (
      scenarios.find((scenario) => getScenarioPrefix(scenario) === "fc") ??
      scenarios.find((scenario) => getScenarioPrefix(scenario) === "pl") ??
      scenarios[0]
    );
  }

  /** The rows of the totals dataset, one per group, with the scenario columns added up. */
  private totalDatasetRows(): Map<string, Record<string, number>> | null {
    const name = this.totals?.dataset;
    if (!name) {
      return null;
    }
    const from = sourceExpr(this.db, name, "");
    const rows = new Map<string, Record<string, number>>();
    if (!from) {
      return rows;
    }
    let result: Record<string, unknown>[];
    try {
      result = this.db.exec<Record<string, unknown>[]>(`SELECT * FROM ${from}`);
    } catch (e) {
      this.failQuery(e);
      return rows;
    }
    const periods = new Set(this.dataModel.map((row) => row.date?.toISODate?.() ?? ""));
    for (const row of result) {
      const date = TimeChart.parseDate(row.date);
      // a row with the date of a period of the chart belongs to the total of that period: a week can
      // count into another year than its first day
      const isPeriod = date != null && periods.has(date.toISODate() ?? "");
      const start = date ? this.totalGroupStart(date, isPeriod) : null;
      const key = start ? (start.toISODate() ?? "") : "";
      if (this.totals!.by !== "all" && key === "") continue;
      const sums = rows.get(key) ?? {};
      for (const [column, raw] of Object.entries(row)) {
        // a value can come as a text, like in the dataset of the chart
        const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
        if (column !== "date" && typeof value === "number" && Number.isFinite(value)) {
          sums[column] = (sums[column] ?? 0) + value;
        }
      }
      rows.set(key, sums);
    }
    return rows;
  }

  private static parseDate(value: unknown): DateTime | null {
    if (value instanceof Date) {
      return DateTime.fromJSDate(value, { zone: "utc" });
    }
    if (typeof value === "string") {
      const date = DateTime.fromISO(value, { zone: "utc" });
      return date.isValid ? date : null;
    }
    if (typeof value === "number") {
      return DateTime.fromMillis(value, { zone: "utc" });
    }
    return null;
  }

  /**
   * The total columns of the chart. A group is the run of periods of one year,
   * quarter, month or week, or all periods. With `sum` a column stacks one part
   * per scenario of the series, else it is one column in the look of the
   * scenarios in it. The first other scenario is the reference behind. The
   * variance rows read the same list, for the same answer to "are there
   * totals". Empty without the config, with a stack, in line mode, and when a
   * part is not positive: a column cannot show that, so the chart has none.
   */
  private computeTotalColumns(): TotalColumn[] {
    if (
      this.totals == null ||
      this.stackConfig != null ||
      this.dataModel.length === 0 ||
      this.determineEffectiveChartMode() !== ChartMode.BAR
    ) {
      return [];
    }
    const followers = this.followerSlots();
    const series = this.seriesSlotKeys();
    const referenceSlot = this.referenceSlot();
    const referenceScenario = referenceSlot
      ? (this.dataModel.find((row) => row[referenceSlot]?.scenario != null)?.[referenceSlot].scenario as string)
      : null;
    const fromData = this.totalDatasetRows();

    // the groups: runs of periods with the same start
    const groups: { from: number; to: number; start: DateTime | null }[] = [];
    this.dataModel.forEach((row, index) => {
      const start = this.totalGroupStart(row.date, true);
      const last = groups[groups.length - 1];
      if (last != null && (start == null || (last.start != null && +last.start === +start))) {
        last.to = index;
      } else {
        groups.push({ from: index, to: index, start });
      }
    });

    // a total per period would repeat every column: `by` is not coarser than the periods of the chart
    if (this.totals.by !== "all" && groups.length === this.dataModel.length && groups.length > 1) {
      return [];
    }

    const columns: TotalColumn[] = [];
    for (const group of groups) {
      const rows = this.dataModel.slice(group.from, group.to + 1);
      let parts: { scenario: string; value: number }[] = [];
      let reference: { scenario: string; value: number } | null = null;
      let counted: number[] = [];
      let scenarios: string[];

      if (fromData != null) {
        // the values as the dataset gives them: one part per scenario of the series
        const data = fromData.get(group.start ? (group.start.toISODate() ?? "") : "") ?? {};
        for (const slot of series) {
          const scenario = this.dataModel.find((row) => row[slot]?.scenario != null)?.[slot].scenario as string;
          // a 0 is a scenario without a value in this total
          if (scenario != null && Number.isFinite(data[scenario]) && data[scenario] !== 0) {
            parts.push({ scenario, value: data[scenario] });
          }
        }
        if (referenceScenario != null && Number.isFinite(data[referenceScenario])) {
          reference = { scenario: referenceScenario, value: data[referenceScenario] };
        }
        scenarios = parts.map((part) => part.scenario);
        if (this.totals.aggregation !== "sum" && parts.length > 1 && parts.every((part) => part.value > 0)) {
          // an average or a last value is one column: the dataset gives the value, not its parts
          parts = [
            { scenario: this.mixedScenario(scenarios), value: parts.reduce((sum, part) => sum + part.value, 0) },
          ];
        }
      } else {
        // the periods where the series has a value. The reference counts in the same periods only,
        // as the variance of the total does: else the two would not tell the same.
        const used = rows.filter((row) => {
          const slot = this.visibleSlot(row, followers);
          return slot != null && Number.isFinite(row[slot]?.value);
        });
        counted = used.map((row) => this.dataModel.indexOf(row));
        scenarios = [...new Set(used.map((row) => row[this.visibleSlot(row, followers)!].scenario as string))];
        const visible = used.map((row) => row[this.visibleSlot(row, followers)!]);
        // with `last` the one period that gives the value counts. A reference with a gap in
        // the counted periods is no reference: half a sum would stand against a full one.
        const referenceRows = this.totals.aggregation === "last" ? used.slice(-1) : used;
        const found = referenceSlot
          ? referenceRows.map((row) => row[referenceSlot]).filter((point) => Number.isFinite(point?.value))
          : [];
        const references = found.length === referenceRows.length ? found : [];
        const sum = (points: DataPoint[]): number => points.reduce((total, point) => total + point.value, 0);
        if (this.totals.aggregation === "sum") {
          const sums = new Map<string, number>();
          for (const point of visible) {
            sums.set(point.scenario as string, (sums.get(point.scenario as string) ?? 0) + point.value);
          }
          parts = [...sums.entries()].map(([scenario, value]) => ({ scenario, value }));
          if (references.length > 0) {
            reference = { scenario: referenceScenario!, value: sum(references) };
          }
        } else if (visible.length > 0) {
          const last = this.totals.aggregation === "last";
          parts = [
            {
              scenario: last
                ? (visible[visible.length - 1].scenario as string)
                : this.mixedScenario(visible.map((point) => point.scenario as string)),
              value: last ? visible[visible.length - 1].value : sum(visible) / visible.length,
            },
          ];
          if (references.length > 0) {
            reference = {
              scenario: referenceScenario!,
              value: last ? references[references.length - 1].value : sum(references) / references.length,
            };
          }
        }
      }

      if (parts.length === 0) {
        // a group without a value of the series has no total, the others keep theirs
        continue;
      }
      if (parts.some((part) => !(part.value > 0))) {
        return [];
      }
      const total = parts.reduce((sum, part) => sum + part.value, 0);
      columns.push({ ...group, label: this.totalLabel(group.start), parts, total, reference, counted, scenarios });
    }
    return columns;
  }

  /** Pixels for one unit in a total column: its own scale, else the scale of the chart. */
  private totalScale(): number {
    return this.totals != null && this.totals.pixelPerUnit > 0 ? this.totals.pixelPerUnit : this.pixelPerUnit;
  }

  /**
   * `referenceColumn`: the slot of the reference that is drawn as a column
   * behind the series. Only where the second slot continues the series, so the
   * place of the column behind is free. Null for the marker.
   */
  private referenceColumnSlot(): string | null {
    if (!this.referenceColumn || !this.followerSlots().includes("scenario2")) {
      return null;
    }
    const slot = this.referenceSlot();
    return slot === "scenario3" || slot === "scenario4" ? slot : null;
  }

  /** True for a row of absolute variances that is drawn as a walk. */
  private isWalkTier(): boolean {
    return (
      this.varianceWaterfall &&
      this.isVarianceChart() &&
      this.stackConfig == null &&
      this.determineEffectiveChartMode() === ChartMode.BAR &&
      this.variancesDataModel.every((entry) => entry.type === VarianceType.ABSOLUTE)
    );
  }

  /** True for the row of variances the base chart draws as a bridge: the row itself is not drawn. */
  public isBridgeTier(): boolean {
    return (
      this.bridge != null &&
      this.isVarianceChart() &&
      this.configVariances.length === this.bridgeVariances.length &&
      this.configVariances.every((name, index) => name === this.bridgeVariances[index])
    );
  }

  /** Why a chart with `varianceWaterfall` and totals draws no bridge, null when it does or when none is asked for. */
  public getBridgeFallback(): string | null {
    return this.bridgeFallback;
  }

  /**
   * The steps of a walk: each starts at the level where the step before ended.
   * A period without a value has no step. Behind a total column on the axis
   * (`by` other than `all`) the walk starts again, so the walk of a group ends
   * at the variance of its total.
   */
  private walkSteps(model: TimeChartDataModelEntry[], start: number = 0): WalkStep[] {
    const steps: WalkStep[] = [];
    const ends = new Set(this.hasTotals() && !this.hasEndTotal() ? this.totalColumns.map((column) => column.to) : []);
    let level = start;
    let run = 0;
    model.forEach((entry, index) => {
      const point = entry.scenario1;
      if (point != null && Number.isFinite(point.value)) {
        steps.push({ index, from: level, to: level + (point.value as number), point, run });
        level += point.value as number;
      }
      if (ends.has(index)) {
        level = start;
        run++;
      }
    });
    return steps;
  }

  /**
   * The bridge of a chart with `varianceWaterfall` and one total over all
   * periods at the scale of the chart: reference total, one step per period,
   * total of the series. Null when the walk does not lead from one total to
   * the other, with the reason in `bridgeFallback`.
   */
  private computeBridge(): Bridge | null {
    this.bridgeFallback = null;
    if (!this.varianceWaterfall || this.bridgeVariances.length === 0 || this.totals == null) {
      return null;
    }
    const fail = (reason: string): null => {
      this.bridgeFallback = reason;
      return null;
    };
    if (!this.hasTotals()) {
      // an empty chart has nothing to report
      return this.dataModel.length === 0 ? null : fail("the chart draws no total columns");
    }
    const totals = this.totals!;
    if (totals.by !== "all") return fail("totals.by is not all");
    if (totals.aggregation !== "sum") return fail("totals.aggregation is not sum");
    if (totals.pixelPerUnit > 0 && Math.abs(totals.pixelPerUnit - this.pixelPerUnit) > 1e-9) {
      return fail("the totals have their own unitScaling");
    }
    const column = this.totalColumns[0];
    if (column.reference == null || !(column.reference.value > 0)) return fail("the total has no reference");
    // the walk must tell the same as the totals: the series against the reference of the total
    const names = this.bridgeVariances.map((name) => new VarianceScenario(name)).filter((entry) => entry.isValid);
    const referenceScenario = column.reference.scenario;
    if (names.some((entry) => entry.delta !== referenceScenario || !column.scenarios.includes(entry.base))) {
      return fail("the variances are not the series against the reference of the total");
    }

    // the variance model of the row, as its own tier would build it
    const overlaps = this.varianceOverlaps;
    const model = this.populateVarianceModel(this.bridgeVariances, this.dataModel);
    this.varianceOverlaps = overlaps;
    const steps = this.walkSteps(model, column.reference.value);
    if (steps.length === 0) return fail("the variances have no value");
    const end = steps[steps.length - 1].to;
    const tolerance = Math.max(1e-6, Math.abs(column.total) * 1e-6);
    if (Math.abs(end - column.total) > tolerance) {
      return fail("the reference total plus the variances is not the total of the series");
    }
    // the walk hangs above the columns of the periods: a step needs room for its label
    const room = this.styles.fontStyles.size * 2.5;
    const followers = this.followerSlots();
    for (const step of steps) {
      const row = this.dataModel[step.index];
      const slot = this.visibleSlot(row, followers);
      const columnValue = Math.max(0, slot ? (row[slot]?.value as number) || 0 : 0);
      const referenceSlot = this.referenceSlot();
      const referenceValue = Math.max(0, referenceSlot ? (row[referenceSlot]?.value as number) || 0 : 0);
      const low = Math.min(step.from, step.to);
      if ((low - Math.max(columnValue, referenceValue)) * this.pixelPerUnit < room) {
        return fail("the walk would cross the columns of the periods");
      }
    }
    return { reference: column.reference, total: column.total, steps };
  }

  /** Width of the column of a total, in pixels, before the positions exist. */
  private totalColumnWidth(): number {
    return this.styles.fontStyles.size * this.styles.scaleFactors.columnWidth * (this.totals?.width ?? 1);
  }

  /** Room left of the names for the reference total of a bridge. */
  private leadRoom(): number {
    // `sync-space-left` is the room left of the axis for every chart that shares it: the reference total stands inside it
    if (this.bridge == null || this.syncedLeft) {
      return 0;
    }
    const fontSize = this.styles.fontStyles.size;
    const margin = fontSize * this.styles.scaleFactors.scenarioOffset;
    return this.totalColumnWidth() + 3 * margin + fontSize * this.styles.scaleFactors.categoryWidth * 0.5;
  }

  /** Place of the reference total of a bridge, left of the names of the chart. */
  private leadGeometry(): { center: number; width: number; left: number; right: number } {
    const width = this.totalColumnWidth();
    const margin = this.position.spacings.scenarioOffset;
    const left = this.styles.padding.left;
    const center = left + 2 * margin + width / 2;
    return { center, width, left, right: center + width / 2 + margin };
  }

  /** The variance of the total of a bridge: the series against the reference. */
  private bridgeVariance(): DataPoint | null {
    const first = this.bridge ? new VarianceScenario(this.bridgeVariances[0]) : null;
    if (this.bridge == null || first == null || !first.isValid) {
      return null;
    }
    const point = new DataPoint(
      this.bridge.total - this.bridge.reference.value,
      first.delta,
      this.pixelPerUnit,
      first.direction,
    );
    point.key = this.totalKey(this.totalColumns[0], this.bridgeVariances[0]);
    return point;
  }

  /** x of the bar of the total variance of a bridge, right of the total column and its names. */
  private bridgeVarianceX(): number {
    return this.totalGeometry(0).right + this.endTotalTextWidth() + this.position.spacings.labelToColumn;
  }

  private bridgeBarWidth(): number {
    return this.position.getColumnWidth() * 0.25;
  }

  /** Width of the bar of the total variance of a bridge and of its label. */
  private bridgeEndWidth(): number {
    const point = this.isVarianceChart() ? null : this.bridgeVariance();
    if (point == null) {
      return 0;
    }
    const gap = this.position.spacings.labelToColumn;
    const digits = this.dataFormatDigits?.decimal ?? 1;
    const text =
      "+" +
      Formatter.number(
        Math.abs(point.value as number),
        "decimal",
        digits,
        digits,
        this.measureScale?.value || 1,
        this.styles.locale,
      );
    const width = CalculateSize(text, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;
    return gap + this.bridgeBarWidth() + gap + width;
  }

  /** The steps of a walk as columns that hang at their level, and the thin lines between them. */
  private drawWalkSteps(steps: WalkStep[], scale: number, group: G, labelGroup: G, lineGroup: G): void {
    const axisY = this.position.getColumnPositionY();
    const half = this.position.getColumnWidth() / 2;
    steps.forEach((step, at) => {
      // named by the period, like the columns of a plain row
      const columnGroup = group.group().id("" + step.index);
      const labels = labelGroup.group().id("" + step.index);
      new Column(this.position, this.scenarioStyles(), step.point, step.index, true, columnGroup, null, null)
        .updateLabelGroup(labels)
        .setAsVariance()
        .draw(this.dataFormatDigits, this.measureScale);
      // the column is drawn from the axis: it moves to the level where the step before ended
      columnGroup.translate(0, -step.from * scale);
      labels.translate(0, -step.from * scale);
      const next = steps[at + 1];
      if (next != null && next.run === step.run) {
        const y = axisY - step.to * scale;
        lineGroup
          .line(
            this.position.getColumnCenterPositionX(step.index) + half,
            y,
            this.position.getColumnCenterPositionX(next.index) - half,
            y,
          )
          .stroke({ color: WALK_LINE, width: 1 });
      }
    });
  }

  /** A row of absolute variances as a walk from the axis of the row. */
  private drawVarianceWalk(svgContainer: Svg): void {
    const scenarios = svgContainer.group().id("Scenarios");
    const lineGroup = scenarios.group().id("WalkLines");
    const group = scenarios.group().id("Walk");
    const labelGroup = scenarios.group().id("WalkLabels");
    this.drawWalkSteps(this.walk, this.pixelPerUnit, group, labelGroup, lineGroup);

    const box = scenarios.bbox();
    this.scenariosArea = {
      height: box.height + this.styles.padding.top + this.styles.padding.bottom,
      width: box.width + this.position.spacings.columnWidth,
    };
  }

  /**
   * The bridge of the base chart: the reference total before the periods, the
   * walk of the variances at the level of its end, thin lines from the two
   * totals, and the variance of the total as a bar between the two levels.
   */
  private drawBridge(svgContainer: Svg): void {
    const bridge = this.bridge;
    if (bridge == null || this.isVarianceChart()) {
      return;
    }
    const scale = this.pixelPerUnit;
    const axisY = this.position.getColumnPositionY();
    const gap = this.position.spacings.labelToColumn;
    const column = this.totalColumns[0];
    const lineGroup = svgContainer.group().id("BridgeLines");
    const group = svgContainer.group().id("Bridge");
    const labelGroup = svgContainer.group().id("BridgeLabels");
    // behind the columns
    lineGroup.back();

    // the reference total, with its own piece of axis
    const lead = this.leadGeometry();
    const look = this.columnLook(bridge.reference.scenario);
    const referenceHeight = bridge.reference.value * scale;
    const referenceKey = this.totalKey(column, bridge.reference.scenario);
    group
      .rect(lead.width, referenceHeight)
      .cx(lead.center)
      .y(axisY - referenceHeight)
      .fill(look.fill)
      .stroke(look.stroke)
      .attr(dataPointAttributes(referenceKey, "element"))
      .attr("data-bn-value", bridge.reference.value);
    new Label(
      labelGroup,
      lead.center,
      axisY - referenceHeight - gap,
      "BRIDGE_REFERENCE",
      bridge.reference.value,
      this.styles,
      HookLocation.Bottom,
      HookLocation.Center,
    )
      .setPoint(referenceKey)
      .draw(true, this.dataFormatDigits, this.measureScale);
    const axisLineY = this.position.getAxisPositionY(false);
    const scenario = this.axisScenario == null ? "default" : `${this.axisScenario}`.slice(0, 2);
    group.line(lead.left, axisLineY, lead.right, axisLineY).addClass("axis-" + scenario);
    if (this.hideAxisLabels === false) {
      new Label(
        labelGroup,
        lead.center,
        axisLineY + this.position.spacings.labelToAxis,
        "BRIDGE_REFERENCE_LABEL",
        this.scenarioName(bridge.reference.scenario),
        this.styles,
        HookLocation.Top,
        HookLocation.Center,
      ).forceStringTypeDraw();
    }

    // the walk, and the lines of the two levels
    const steps = bridge.steps;
    const half = this.position.getColumnWidth() / 2;
    const barX = this.bridgeVarianceX();
    const referenceY = axisY - referenceHeight;
    const totalY = axisY - bridge.total * scale;
    const stroke = { color: WALK_LINE, width: 1 };
    lineGroup.line(lead.center + lead.width / 2, referenceY, barX, referenceY).stroke(stroke);
    lineGroup
      .line(this.position.getColumnCenterPositionX(steps[steps.length - 1].index) + half, totalY, barX, totalY)
      .stroke(stroke);
    this.drawWalkSteps(steps, scale, group, labelGroup, lineGroup);

    // the variance of the total: a thin bar between the two levels, with its value. It is a
    // difference marker, not a column of the row: it stays solid, also with a forecast in the total
    const point = this.bridgeVariance();
    if (point != null && point.value !== 0) {
      const style = this.styles.varianceStyles.getSVGStyle(point.getVarianceStyle());
      const width = this.bridgeBarWidth();
      group
        .rect(width, Math.abs(referenceY - totalY))
        .x(barX)
        .y(Math.min(referenceY, totalY))
        .fill(style?.fill || "#000000")
        .attr(dataPointAttributes(point.key, "element"))
        .attr("data-bn-value", point.value as number);
      new Label(
        labelGroup,
        barX + width + gap,
        (referenceY + totalY) / 2,
        "BRIDGE_VARIANCE",
        point.value,
        this.styles,
        HookLocation.Center,
        HookLocation.Left,
      )
        .setPoint(point.key)
        .setToVarianceLabel()
        .draw(true, this.dataFormatDigits, this.measureScale);
    }
  }

  /** Height of the highest total column in pixels: its parts, its reference and its band of the scaling indicator. */
  private totalsHeight(): number {
    if (!this.hasTotals()) {
      return 0;
    }
    const band = this.hasScalingIndicator() ? this.scalingIndicator : 0;
    const units = Math.max(...this.totalColumns.map((column) => Math.max(column.total, column.reference?.value ?? 0)));
    const levels = this.bridge ? this.bridge.steps.flatMap((step) => [step.from, step.to]) : [];
    return Math.max(units, band, ...levels) * this.totalScale();
  }

  /**
   * The variances of the total columns in a variance chart, one per column:
   * the series against the reference, put together the way the total is. With
   * a dataset the values come from its row. A total takes the notation of the
   * forecast when a forecast is part of it.
   */
  private computeTotalVariances(): (DataPoint | null)[] {
    if (!this.hasTotals() || !this.isVarianceChart()) {
      return [];
    }
    const firstRow = this.dataModel[0] ?? null;
    const candidates = (this.configVariances ?? [])
      .map((name) => ({ name, variance: new VarianceScenario(name) }))
      .filter((entry) => entry.variance.isValid);
    if (candidates.length === 0) {
      return [];
    }
    const first = candidates[0].variance;
    const relative = first.type === VarianceType.RELATIVE;
    const fromData = this.totalDatasetRows();
    const aggregation = this.totals!.aggregation;

    return this.totalColumns.map((column) => {
      let base: number;
      let delta: number;
      const notations = new Set<string>();
      if (fromData != null) {
        const data = fromData.get(column.start ? (column.start.toISODate() ?? "") : "") ?? {};
        // the scenarios of the series can stand on either side of a variance: that side is
        // added up, each scenario once, the other side is the one reference of the row
        const series = new Set(column.scenarios);
        const bases = [...new Set(candidates.map((entry) => entry.variance.base))];
        const deltas = [...new Set(candidates.map((entry) => entry.variance.delta))];
        // a total needs the whole series on one side and none of it on the other: a row for a part
        // of the series, or one that sets parts of the series against each other, has no total
        const inBases = bases.filter((name) => series.has(name)).length;
        const inDeltas = deltas.filter((name) => series.has(name)).length;
        if ((inBases > 0 && inDeltas > 0) || (inBases + inDeltas > 0 && inBases + inDeltas < series.size)) {
          return null;
        }
        // a 0 is a scenario without a value in this total, as for the parts
        const has = (name: string): boolean => Number.isFinite(data[name]) && data[name] !== 0;
        // of the side with the series only the series counts, of the other side the first name
        const used = (names: string[]): string[] => {
          const ofSeries = names.filter((name) => series.has(name));
          return (ofSeries.length > 0 ? ofSeries : names.slice(0, 1)).filter(has);
        };
        const side = (names: string[]): number | null =>
          used(names).length > 0 ? used(names).reduce((sum, name) => sum + data[name], 0) : null;
        const baseSide = side(bases);
        const deltaSide = side(deltas);
        if (baseSide == null || deltaSide == null) {
          return null;
        }
        base = baseSide;
        delta = deltaSide;
        // the notation of what is in the value, not of every name of the row
        used(bases).forEach((name) => notations.add(name.slice(0, 2)));
      } else {
        // the same periods as the column, so the two tell the same: with `last` the one
        // period of the value. Without both values in each of them there is no variance.
        const rows = (aggregation === "last" ? column.counted.slice(-1) : column.counted).map(
          (index) => this.dataModel[index],
        );
        const pairs: { base: number; delta: number; notation: string }[] = [];
        for (const row of rows) {
          for (const { variance } of candidates) {
            const slots = this.mapScenarios(variance, firstRow);
            const baseValue = row[slots.get(variance.base) ?? ""]?.value;
            const deltaValue = row[slots.get(variance.delta) ?? ""]?.value;
            if (Number.isFinite(baseValue) && Number.isFinite(deltaValue)) {
              pairs.push({ base: baseValue, delta: deltaValue, notation: variance.base.slice(0, 2) });
              break;
            }
          }
        }
        if (pairs.length === 0 || pairs.length !== rows.length) {
          return null;
        }
        const divisor = aggregation === "average" ? pairs.length : 1;
        base = pairs.reduce((sum, pair) => sum + pair.base, 0) / divisor;
        delta = pairs.reduce((sum, pair) => sum + pair.delta, 0) / divisor;
        pairs.forEach((pair) => notations.add(pair.notation));
      }
      const point = new DataPoint(
        relative ? relativeVariance(base - delta, delta) : base - delta,
        first.delta,
        relative ? this.pixelPerPercentage : this.pixelPerUnit,
        first.direction,
      );
      if (this.scenarioSwitch) {
        point.notation = notations.has("fc") ? "fc" : notations.size === 1 ? [...notations][0] : "ac";
      }
      point.key = this.totalKey(column, candidates[0].name);
      return point;
    });
  }

  /** The point key of an element of a total column: `row: total`, and the start of its group when there are several. */
  private totalKey(column: TotalColumn, scenario?: string): DataPointKey {
    const key: DataPointKey = { row: "total" };
    if (column.start != null) {
      key.date = TimeChart.pointDate(column.start);
    }
    if (scenario) {
      key.scenario = scenario;
    }
    return key;
  }

  /** Width of the texts right of the total column at the end: the names of its parts, and the value of its band. */
  private endTotalTextWidth(): number {
    if (!this.hasEndTotal()) {
      return 0;
    }
    const width = (text: string): number =>
      CalculateSize(text, { font: this.styles.fontStyles.font, fontSize: this.styles.fontStyles.size + "px" }).width;
    const gap = this.position.spacings.labelToColumn;
    const parts = this.totalColumns[0].parts;
    const names =
      !this.isVarianceChart() && parts.length > 1
        ? gap + Math.max(...parts.map((part) => width(this.scenarioName(part.scenario))))
        : 0;
    const indicator = this.hasScalingIndicator() ? gap + width(this.scalingIndicatorText()) : 0;
    return names + indicator;
  }

  private scenarioName(scenario: string): string {
    return (this.i18n.get(scenario) || scenario) as string;
  }

  /** Fill and stroke of a column of a scenario, with the hatching of a forecast. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private columnLook(scenario: string): { fill: any; stroke: { color: string; width: number }; solid: string | null } {
    // the styles are keyed by the family of the scenario: ac, fc, pp, pl
    const styles = this.scenarioStyles().barStyles as unknown as Record<string, Record<string, string>>;
    const style = styles[getScenarioPrefix(scenario)] ?? {};
    const pattern = style.fillpattern ? this.styles.pattern.get(style.fillpattern)?.pattern : undefined;
    const color = style.fill || "#404040";
    return {
      fill: pattern ?? color,
      stroke: { color: style.stroke || color, width: Number(style.width) || 0 },
      solid: pattern ? null : color,
    };
  }

  /** The axis of the total column at the end: its own piece of line, in the look of the axis of the chart. */
  private drawTotalAxis(group: G, y: number): void {
    const { left, right } = this.totalGeometry(0);
    const scenario = this.axisScenario == null ? "default" : `${this.axisScenario}`.slice(0, 2);
    group.line(left, y, right, y).addClass("axis-" + scenario);
  }

  /**
   * The total columns of the base chart, at their own scale: the parts, the
   * reference behind, the total above and the name under the axis. With a
   * scaling indicator a column has its own band. The column at the end has its
   * own axis and the names of its parts at the right, and a line links its band
   * to the band of the periods.
   */
  private drawTotalColumns(svgContainer: Svg): void {
    if (!this.hasTotals() || this.isVarianceChart()) {
      return;
    }
    const scale = this.totalScale();
    const axisY = this.position.getColumnPositionY();
    const gap = this.position.spacings.labelToColumn;
    const atEnd = this.hasEndTotal();
    const group = svgContainer.group().id("TotalColumn");
    const labelGroup = svgContainer.group().id("TotalColumnLabels");

    this.totalColumns.forEach((column, index) => {
      const { center, width, left, right } = this.totalGeometry(index);

      if (this.hasScalingIndicator()) {
        const height = this.scalingIndicator * scale;
        const periods = this.scalingIndicatorBand();
        const band = group
          .rect(right - left, height)
          .x(left)
          .y(axisY - height)
          .fill(SCALING_INDICATOR_FILL);
        // behind the columns of the periods that stand next to it
        band.back();
        if (atEnd && periods != null) {
          // the line starts behind the value of the band of the periods
          const from = this.scalingIndicatorLabelX() + this.scalingIndicatorTextWidth() + gap / 2;
          group
            .line(Math.min(from, left), axisY - periods.height, left, axisY - height)
            .stroke({ color: SCALING_INDICATOR_LINE, width: 1 })
            .id("ScalingIndicatorLink");
        }
      }

      // the reference of a bridge stands before the periods
      if (column.reference != null && column.reference.value > 0 && this.bridge == null) {
        const look = this.columnLook(column.reference.scenario);
        const height = column.reference.value * scale;
        group
          .rect(width, height)
          .cx(center - this.position.spacings.scenarioOffset)
          .y(axisY - height)
          .fill(look.fill)
          .stroke(look.stroke)
          .attr(dataPointAttributes(this.totalKey(column, column.reference.scenario), "element"))
          .attr("data-bn-value", column.reference.value);
      }

      let top = axisY;
      for (const part of column.parts) {
        const look = this.columnLook(part.scenario);
        const height = part.value * scale;
        top -= height;
        const key = this.totalKey(column, part.scenario);
        group
          .rect(width, height)
          .cx(center)
          .y(top)
          .fill(look.fill)
          .stroke(look.stroke)
          .attr(dataPointAttributes(key, "element"))
          .attr("data-bn-value", part.value);
        if (column.parts.length > 1) {
          if (height >= this.position.dataLabelHeight) {
            const label = new Label(
              labelGroup,
              center,
              top + height / 2,
              "TOTAL_PART",
              part.value,
              this.styles,
              HookLocation.Center,
              HookLocation.Center,
            ).setPoint(key);
            // a label on a hatching keeps the background of a plain label
            (look.solid ? label.setSegmentFill(look.solid) : label).draw(
              true,
              this.dataFormatDigits,
              this.measureScale,
            );
          }
          if (atEnd) {
            new Label(
              labelGroup,
              center + width / 2 + gap,
              // the name of a thin top part stays below the total above the column
              Math.max(top + height / 2, axisY - column.total * scale + this.position.dataLabelHeight / 2),
              "TOTAL_NAME",
              this.scenarioName(part.scenario),
              this.styles,
              HookLocation.Center,
              HookLocation.Left,
            ).forceStringTypeDraw();
          }
        }
      }

      new Label(
        labelGroup,
        center,
        top - gap,
        "TOTAL",
        column.total,
        this.styles,
        HookLocation.Bottom,
        HookLocation.Center,
      )
        .setPoint(this.totalKey(column), "total")
        .draw(true, this.dataFormatDigits, this.measureScale);

      if (this.hideAxisLabels === false && column.label) {
        new Label(
          labelGroup,
          center,
          this.position.getAxisPositionY(false) + this.position.spacings.labelToAxis,
          "TOTAL_LABEL",
          column.label,
          this.styles,
          HookLocation.Top,
          HookLocation.Center,
        ).forceStringTypeDraw();
      }
    });

    if (atEnd) {
      this.drawTotalAxis(group, this.position.getAxisPositionY(false));
      if (this.hasScalingIndicator()) {
        new Label(
          labelGroup,
          this.totalGeometry(0).right + this.endTotalTextWidth() - this.scalingIndicatorTextWidth(),
          axisY - this.scalingIndicator * scale,
          "SCALING_INDICATOR_TOTAL",
          this.scalingIndicatorText(),
          this.styles,
          HookLocation.Center,
          HookLocation.Left,
        ).forceStringTypeDraw();
      }
    }
  }

  /** The variances of the total columns, in the tier of their variance chart: columns or pins like the others. */
  private drawTotalVariances(svgContainer: Svg): void {
    if (!this.totalVariances.some((point) => point != null)) {
      return;
    }
    // inside the group of the variances: its box is the height of the row, also below the axis
    const scenarios = (svgContainer.findOne("#Scenarios") as G | null) ?? svgContainer.group().id("Scenarios");
    const group = scenarios.group().id("TotalColumn");
    const labelGroup = scenarios.group().id("TotalColumnLabels");
    const relative = this.variancesDataModel.some((entry) => entry.type === VarianceType.RELATIVE);

    this.totalVariances.forEach((point, total) => {
      if (point == null) {
        return;
      }
      const index = this.totalIndex(total);
      if (relative) {
        new Needle(this.position, this.scenarioStyles(), point, index, group.group())
          .updateLabelGroup(labelGroup.group())
          .draw(this.dataFormatDigits);
        return;
      }
      // a row whose period variances are cut cuts the total the same way. The part above the
      // break is scaled by the largest overflow: that can be the one of the total.
      const overflow = this.overflowConfig
        ? {
            ...this.overflowConfig,
            maxOverflow: Math.max(
              this.overflowConfig.maxOverflow,
              point.getScaledUnit() - (this.overflowConfig.cutHeight - this.overflowConfig.scenarioCutOffset),
            ),
          }
        : null;
      new Column(this.position, this.scenarioStyles(), point, index, true, group.group(), null, overflow)
        .updateLabelGroup(labelGroup.group())
        .setAsVariance()
        .draw(this.dataFormatDigits, this.measureScale);
    });
    if (this.hasEndTotal()) {
      this.drawTotalAxis(group, this.position.getAxisPositionY(relative));
    }

    const box = scenarios.bbox();
    this.scenariosArea = {
      height: box.height + this.styles.padding.top + this.styles.padding.bottom,
      width: box.width + this.position.spacings.columnWidth,
    };
  }

  private determineEffectiveChartMode(): ChartMode {
    if (this.chartMode === ChartMode.LINE) {
      return ChartMode.LINE;
    }

    if (this.chartMode === ChartMode.AUTO) {
      // Auto-switch to line mode when data points exceed maxBars threshold
      if (this.dataModel.length > this.maxBars) {
        return ChartMode.LINE;
      }
    }

    return ChartMode.BAR;
  }

  setPattern(fc: string, fcPolygonPattern: SVGPolgonPattern) {
    this.styles.pattern.set(fc, fcPolygonPattern);
  }

  hasNoData() {
    return this.dataModel.length === 0;
  }

  private isOnSameAxisSide(): boolean {
    if (
      this.smallestVarianceDataPointValue.value == null ||
      this.highestVarianceDataPointValue.value == null ||
      this.smallestDataPointValue.value == null ||
      this.highestDataPointValue.value == null
    ) {
      return false;
    }

    if (this.isVarianceChart()) {
      return (
        Math.sign(this.smallestVarianceDataPointValue.value) === Math.sign(this.highestVarianceDataPointValue.value) ||
        (this.smallestDataPointValue.value === 0 && Math.sign(this.highestDataPointValue.value) === 1)
      );
    } else {
      return (
        Math.sign(this.smallestDataPointValue.value) === Math.sign(this.highestDataPointValue.value) ||
        (this.smallestDataPointValue.value === 0 && Math.sign(this.highestDataPointValue.value) === 1)
      );
    }
  }

  private createI18n(i18n: Map<string, string>): Map<string, string> {
    this.state = FactoryState.DIRTY;

    const defaultI18n: Map<string, string> = new Map<string, string>([
      ["SEPARATOR_WS", ", "],
      ["in", "in"],
      ["ORDER_asc", "↑"],
      ["ORDER_desc", "↓"],
      ["ac1", "AC"],
      ["pp1", "PY"],
      ["fc1", "FC"],
      ["pl1", "PL"],
      ["ac2", "AC2"],
      ["pp2", "PY2"],
      ["fc2", "FC2"],
      ["pl2", "PL2"],
      ["ac3", "AC3"],
      ["pp3", "PY3"],
      ["fc3", "FC3"],
      ["pl3", "PL3"],
      ["ac4", "AC4"],
      ["pp4", "PY4"],
      ["fc4", "FC4"],
      ["pl4", "PL4"],
      ["category", " "],
      ["operation", " "],
      ["thereof", "davon"],
      ["part_of", "in % von"],
      ["ibcssymbol_delta_ac", "Δ{%}"],
      ["ibcssymbol_delta_generic", "Δ({%})"],
      ["ibcssymbol_delta_ac_relative", "Δ{%}%"],
      ["ibcssymbol_delta_generic_relative", "Δ({%})%"],
      ["SUM_TOTAL", "❖"],
    ]);

    return new Map([...defaultI18n, ...i18n]);
  }

  private createElementPosition(scenarios: string[]): ElementPositions {
    let maxLabelLengthLeft: number;

    // only need scenarios written on the leftside of bar/ marker
    const scenarioLabelLeft = CalculateSize(
      scenarios
        .filter((_value, index) => index === 1 || index === 2)
        .map((scenario) => Formatter.translateScenarioLabel(scenario, this.i18n))
        .reduce((a, b) => (a.length < b.length ? b : a), ""),
      {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      },
    ).width;

    const titleLength = this.calculateTitleLength(this.leftSideOffsetForHorizontalSync);

    if (scenarioLabelLeft > titleLength) {
      maxLabelLengthLeft = scenarioLabelLeft;
    } else {
      maxLabelLengthLeft = titleLength;
    }

    if (this.position != null) {
      maxLabelLengthLeft = maxLabelLengthLeft + this.position.spacings.labelToColumn;
    }

    //if (maxLabelLengthLeft < this.leftSideOffsetForHorizontalSync) {
    //  maxLabelLengthLeft = this.leftSideOffsetForHorizontalSync;
    //}

    if (this.leftSideOffsetForHorizontalSync > -1) {
      maxLabelLengthLeft = this.leftSideOffsetForHorizontalSync;
    }
    // the series names of a stack by dimension are not known to the component that hands in the offset
    maxLabelLengthLeft = Math.max(maxLabelLengthLeft, this.legendWidth("left"));
    // the reference total of a bridge stands left of the names, in every tier of the chart
    maxLabelLengthLeft += this.leadRoom();

    let min: DataPoint;
    let max: DataPoint;

    if (this.isVarianceChart()) {
      min = this.smallestVarianceDataPointValue;
      max = this.highestVarianceDataPointValue;
    } else {
      min = this.smallestDataPointValue;
      max = this.highestDataPointValue;
    }

    // When overflow config is active, create a virtual max so the coordinate system
    // allocates exactly cutHeight + breakGap + overdriveZoneHeight instead of the
    // full (clipped) bar height.
    if (this.overflowConfig) {
      const { cutHeight, overdriveZoneHeight, breakGap } = this.overflowConfig;
      // the total column is not cut: it keeps its room above the cut columns
      const virtualHeight = Math.max(
        cutHeight + overdriveZoneHeight + breakGap,
        this.isVarianceChart() ? 0 : this.totalsHeight(),
      );
      // Create a virtual DataPoint with pixelPerUnit=1 so getScaledUnit() returns virtualHeight directly
      max = new DataPoint(virtualHeight, max.scenario, 1, max.variance);
    }

    // In line mode with lineFullWidth enabled, override categoryWidth so data points
    // are evenly distributed across the available container width.
    let effectiveScaleFactors = this.styles.scaleFactors;
    const effectiveMode = this.determineEffectiveChartMode();

    if (
      this.lineFullWidth &&
      this.availableWidth > 0 &&
      this.dataModel.length > 0 &&
      !this.isVarianceChart() &&
      effectiveMode === ChartMode.LINE
    ) {
      const fontSize = this.styles.fontStyles.size;
      const padding = this.styles.padding;
      const sf = this.styles.scaleFactors;

      // Fixed overhead: padding + scenarioOffset + leftSideLabels + half columnWidth (right margin)
      const fixedOverhead =
        padding.left + padding.right + fontSize * sf.scenarioOffset + maxLabelLengthLeft + fontSize * sf.columnWidth;

      const availableDataWidth = this.availableWidth - fixedOverhead;

      if (availableDataWidth > 0) {
        const customCategoryWidthFactor = availableDataWidth / this.dataModel.length / fontSize;
        // Enforce minimum to prevent label overlap
        const minFactor = sf.columnWidth * 1.2;
        const finalFactor = Math.max(customCategoryWidthFactor, minFactor);

        // Clone scaleFactors with overridden categoryWidth
        const cloned = new ScaleFactorsTimeChart();
        Object.assign(cloned, sf);
        cloned.categoryWidth = finalFactor;
        effectiveScaleFactors = cloned;
      }
    }

    // total columns take places on the axis: the periods behind them move on
    const places = this.hasTotals()
      ? this.totalSlots(
          effectiveScaleFactors.columnWidth,
          effectiveScaleFactors.categoryWidth,
          this.styles.fontStyles.size,
          effectiveScaleFactors.scenarioOffset,
        )
      : null;
    const position = new ElementPositions(
      new Padding(this.styles.padding),
      effectiveScaleFactors,
      this.styles.fontStyles,
      min,
      max,
      places?.axisColumns ?? this.dataModel.length,
      maxLabelLengthLeft,
    );
    position.setSlots(places?.slots ?? null);
    return position;
  }

  private calculateTitleLength(minWidth: number): number {
    let tmpTitle = "_______"; // default width if this.title  is sorther

    if (tmpTitle.length < this.title.length) {
      tmpTitle = this.title;
    }

    const width = CalculateSize(tmpTitle, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;

    if (width < minWidth) {
      return minWidth;
    }
    return width;
  }

  /**
   * The styles with each scenario on the bar style slot its colorIndex selects.
   * `this.styles` stays the theme: the hatch pattern is built from its `fc` slot.
   */
  private scenarioStyles(): TimeChartStyle {
    const barStyles = stylesBySlot(this.styles.barStyles, this.ruleSet);
    if (barStyles === this.styles.barStyles) {
      return this.styles;
    }
    return Object.assign(Object.create(Object.getPrototypeOf(this.styles)), this.styles, { barStyles });
  }

  private setAxisScenario(scenarios: string[]): Scenario {
    let result: Scenario = Scenario.AC1;

    if (scenarios != null && scenarios.length > 0) {
      const axis: VarianceScenario = new VarianceScenario(scenarios.toString());
      if (axis.isValid) {
        // the axis is drawn in the look of the slot the reference scenario has
        result = <Scenario>(styleSlot(this.ruleSet.getScenarioColorIndex(axis.delta)) + axis.delta.slice(2));
      }
    }

    if (result === null) {
      // arrays with invalid scenarios are set to Senario.AC Fallback
      result = Scenario.AC1;
    }

    return result;
  }

  private populateModel(selectedScenarios: string[], dateInterval: DateDistance): TimeChartDataModelEntry[] {
    if (this.rowCount === 0 || !this.fromExpr) {
      return [];
    }

    const select = ``;
    const order = "";

    let result = this.queryDataSet(dateInterval, select, order);
    this.detectNaNCells(selectedScenarios, result);

    result = this.leftOuterJoinDates(result, dateInterval);

    const dataModel: TimeChartDataModelEntry[] = this.createDataRows(result, selectedScenarios);

    if (this.stackConfig?.by === StackBy.DIMENSIONS) {
      this.populateSeries(dataModel, selectedScenarios, dateInterval);
    }

    return dataModel;
  }

  /**
   * Stack by dimension: one series per `category`, ordered by `categoryIndex`, else by first appearance.
   * Every period gets every series, so a series keeps its place and colour when a value is missing.
   */
  private populateSeries(
    dataModel: TimeChartDataModelEntry[],
    selectedScenarios: string[],
    dateInterval: DateDistance,
  ): void {
    const rows = this.queryDataSet(dateInterval, ", [category]", ", [category]");
    this.detectNaNCells(selectedScenarios, rows);

    const keyOf = (row: TimeChartResponseRow): string => (row.category == null ? "" : String(row.category));
    const timeOf = (date: DateTime): number => date?.toMillis?.() ?? Number.NaN;

    const order: string[] = [];
    const byPeriod = new Map<number, Map<string, TimeChartResponseRow>>();
    for (const row of rows) {
      const key = keyOf(row);
      if (!order.includes(key)) order.push(key);
      const time = timeOf(row.calcdate);
      if (!byPeriod.has(time)) byPeriod.set(time, new Map());
      byPeriod.get(time)!.set(key, row);
    }

    // `categoryIndex` gives the order when the dataset has it, as for the rows of a structure chart
    try {
      const indexRows = this.db.exec<{ category: string | null; idx: number | null }[]>(
        `SELECT [category], MIN(categoryIndex) AS idx FROM ${this.fromExpr} GROUP BY [category]`,
      );
      const indexOf = new Map(indexRows.map((row) => [row.category == null ? "" : String(row.category), row.idx]));
      if (order.every((key) => Number.isFinite(indexOf.get(key)))) {
        order.sort((a, b) => (indexOf.get(a) as number) - (indexOf.get(b) as number));
      }
    } catch {
      // no usable index: the order of first appearance stays
    }

    const slots = ["scenario1", "scenario2", "scenario3", "scenario4"];
    for (const entry of dataModel) {
      const period = byPeriod.get(timeOf(entry.date));
      entry.series = order.map((key) => {
        const row = period?.get(key);
        const points: Record<string, DataPoint> = {};
        slots.forEach((slot, index) => {
          const scenario = selectedScenarios[index];
          if (scenario == null) return;
          const raw = row?.[scenario];
          const value = typeof raw === "number" ? raw : Number.NaN;
          const point = new DataPoint(value, scenario, this.pixelPerUnit, Scenario.NEU);
          if (Number.isFinite(value)) {
            point.key = { date: TimeChart.pointDate(entry.date), scenario, category: key };
          }
          points[slot] = point;
        });
        return { key, points };
      });
    }
  }

  private detectNaNCells(scenarios: string[], res: TimeChartResponseRow[]) {
    res.forEach((row) => {
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
  }

  private findDateInterval(dateInterval: DateDistance): DateDistance {
    if (dateInterval !== DateDistance.AUTO) {
      return dateInterval;
    }

    const dates = this.queryDates();
    if (dates.length === 0) {
      return DateDistance.DAY;
    }

    // a loop, not DateTime.min(...dates): a spread of some 100000 dates exceeds the argument limit
    let first = dates[0];
    let last = dates[0];
    for (const date of dates) {
      if (date < first) first = date;
      if (date > last) last = date;
    }

    return new DateStringFactory().calculateDistanceType(first, last, this.intervalSpanLimit);
  }

  /** Distinct dates of the filtered rows. Min and max are taken in JS: alasql MIN/MAX skip ISO strings. */
  private queryDates(): DateTime[] {
    // no source, no rows, or the count query has failed already
    if (this.rowCount === 0) {
      return [];
    }

    let result: { date?: unknown }[];
    try {
      result = this.db.exec<{ date?: unknown }[]>(`SELECT DISTINCT [date] FROM ${this.fromExpr}`);
    } catch (e) {
      this.failQuery(e);
      return [];
    }

    // `date` rows in the shared db are typically ISO strings (raw JSON) or millis;
    // accept both so existing fixtures and live JSON data both work.
    return result.map((row) => TimeChart.coerceDateTime(row.date)).filter((date): date is DateTime => date != null);
  }

  private static coerceDateTime(v: unknown): DateTime | undefined {
    if (v == null) return undefined;
    if (typeof v === "string") {
      const dt = DateTime.fromISO(v, { zone: "utc" });
      return dt.isValid ? dt : undefined;
    }
    if (typeof v === "number") {
      const dt = DateTime.fromMillis(v, { zone: "utc" });
      return dt.isValid ? dt : undefined;
    }
    if (typeof (v as { isValid?: boolean }).isValid === "boolean") {
      return v as DateTime;
    }
    return undefined;
  }

  private queryDataSet(dateInterval: DateDistance, select: string, order: string) {
    const scenarios = [
      "ac1",
      "ac2",
      "ac3",
      "ac4",
      "pp1",
      "pp2",
      "pp3",
      "pp4",
      "fc1",
      "fc2",
      "fc3",
      "fc4",
      "pl1",
      "pl2",
      "pl3",
      "pl4",
    ];
    const dateSelect = `normalizeDate([date], '${dateInterval}' , '${this.locale}') as  calcdate`;
    let result: TimeChartResponseRow[];
    try {
      result = this.db.exec<TimeChartResponseRow[]>(
        `SELECT ${"p.calcdate"}                                ${select},
                          ${scenarios
                            .map((scenario: string) => {
                              return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
                            })
                            .join(",")}

                           FROM (SELECT ${dateSelect} ${select},
                                        ac1,
                                        ac2,
                                        ac3,
                                        ac4,
                                        pp1,
                                        pp2,
                                        pp3,
                                        pp4,
                                        fc1,
                                        fc2,
                                        fc3,
                                        fc4,
                                        pl1,
                                        pl2,
                                        pl3,
                                        pl4
                                 FROM ${this.fromExpr}) as p
                           GROUP BY ${"calcdate"} ${order}
                           ORDER BY ${"calcdate asc"}`,
      );
    } catch (e) {
      this.failQuery(e);
      return [];
    }

    return result;
  }

  private createDataRows(result: TimeChartResponseRow[], selectedScenarios: string[]): TimeChartDataModelEntry[] {
    const dataModel: TimeChartDataModelEntry[] = [];

    result.forEach((element: TimeChartResponseRow, index: number) => {
      dataModel.push({
        id: index,
        category: element.category,
        type: VarianceType.NONE,
        date: element["calcdate"],
        scenario1: new DataPoint(element[selectedScenarios[0]], selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(element[selectedScenarios[1]], selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(element[selectedScenarios[2]], selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(element[selectedScenarios[3]], selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
      });
      //}
    });

    for (const entry of dataModel) {
      for (const dataPoint of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        // a bucket without a value has a bar of height 0: nothing an annotation can point at
        if (dataPoint.value != null && !Number.isNaN(dataPoint.value)) {
          dataPoint.key = { date: TimeChart.pointDate(entry.date), scenario: dataPoint.scenario ?? undefined };
        }
      }
    }

    return dataModel;
  }

  /** The bucket a point belongs to. */
  private static pointDate(date: DateTime): string | undefined {
    return pointDate(date?.toISO?.());
  }

  private findSmallestDataPointValue(dataModel: TimeChartDataModelEntry[]): DataPoint {
    const pixel = this.isVarianceChart() ? this.pixelPerPercentage : this.pixelPerUnit;
    let smallestDataPoint: DataPoint = new DataPoint(0, "default", pixel, Scenario.NEU);

    for (const entry of dataModel) {
      for (const current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current && current.value != null) {
          if (current.value < Number(smallestDataPoint.value)) {
            smallestDataPoint = current;
          }
        }
      }
    }

    return smallestDataPoint;
  }

  private findHighestDataPointValue(dataModel: TimeChartDataModelEntry[]): DataPoint {
    const pixel = this.isVarianceChart() ? this.pixelPerPercentage : this.pixelPerUnit;
    let highestDataPoint: DataPoint = new DataPoint(0, "default", pixel, Scenario.NEU);

    for (const entry of dataModel) {
      for (const current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null) {
          if (current.value > Number(highestDataPoint.value)) {
            highestDataPoint = current;
          }
        }
      }
    }
    return highestDataPoint;
  }

  private populateVarianceModel(
    variancesConfig: string[],
    dataModel: TimeChartDataModelEntry[],
  ): TimeChartDataModelEntry[] {
    const varianceModel: TimeChartDataModelEntry[] = [];

    if (variancesConfig == null || variancesConfig.length === 0) {
      return varianceModel;
    }

    let firstRow = null;

    if (dataModel != null && dataModel.length > 0) {
      firstRow = dataModel[0];
    }

    this.varianceOverlaps = 0;
    const parsed = variancesConfig.map((variance) => new VarianceScenario(variance));
    if (this.scenarioSwitch && parsed.filter((variance) => variance.isValid).length > 1) {
      return this.populateSharedVarianceRow(variancesConfig, parsed, dataModel, firstRow);
    }

    for (const varianceScenario in variancesConfig) {
      const scenarios: VarianceScenario = new VarianceScenario(variancesConfig[varianceScenario]);

      if (scenarios.isValid) {
        const scenariomap: Map<string, string> = this.mapScenarios(scenarios, firstRow);
        const directon: string = scenarios.direction;

        const pixelPerUnit = scenarios.type === "dr" ? this.pixelPerPercentage : this.pixelPerUnit;

        for (const index in dataModel) {
          const point = new DataPoint(
            this.calculateVariance(scenarios, dataModel[index], scenariomap),
            scenarios.delta,
            pixelPerUnit,
            directon,
          );
          if (this.scenarioSwitch) {
            // as in a shared row: the variance takes the notation of its scenario
            point.notation = scenarios.base.slice(0, 2);
          }
          if (point.value !== null && !Number.isNaN(point.value)) {
            point.key = {
              date: TimeChart.pointDate(dataModel[index].date),
              scenario: variancesConfig[varianceScenario],
            };
          }
          varianceModel.push({
            id: Number(index),
            category: dataModel[index].category,
            type: scenarios.type === "dr" ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            date: dataModel[index].date,
            scenario1: point,
            scenario2: new DataPoint(null, null, null, null),
            scenario3: new DataPoint(null, null, null, null),
            scenario4: new DataPoint(null, null, null, null),
          });
        }
      }
    }
    return varianceModel;
  }

  /**
   * One row for several variances over the same reference: each period shows
   * the first variance that has a value there, in the notation of its scenario.
   */
  private populateSharedVarianceRow(
    variancesConfig: string[],
    parsed: VarianceScenario[],
    dataModel: TimeChartDataModelEntry[],
    firstRow: TimeChartDataModelEntry | null,
  ): TimeChartDataModelEntry[] {
    const varianceModel: TimeChartDataModelEntry[] = [];
    const valid = parsed.map((variance, index) => ({ variance, name: variancesConfig[index] }));
    const candidates = valid.filter((entry) => entry.variance.isValid);
    const isRelative = candidates[0].variance.type === "dr";
    const pixelPerUnit = isRelative ? this.pixelPerPercentage : this.pixelPerUnit;

    dataModel.forEach((row, index) => {
      let point: DataPoint | null = null;
      let values = 0;
      for (const { variance, name } of candidates) {
        const value = this.calculateVariance(variance, row, this.mapScenarios(variance, firstRow));
        if (value === null || Number.isNaN(value)) {
          continue;
        }
        values++;
        if (point == null) {
          point = new DataPoint(value, variance.delta, pixelPerUnit, variance.direction);
          point.notation = variance.base.slice(0, 2);
          point.key = { date: TimeChart.pointDate(row.date), scenario: name };
        }
      }
      if (values > 1) {
        this.varianceOverlaps++;
      }
      varianceModel.push({
        id: index,
        category: row.category,
        type: isRelative ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
        date: row.date,
        scenario1:
          point ?? new DataPoint(null, candidates[0].variance.delta, pixelPerUnit, candidates[0].variance.direction),
        scenario2: new DataPoint(null, null, null, null),
        scenario3: new DataPoint(null, null, null, null),
        scenario4: new DataPoint(null, null, null, null),
      });
    });
    return varianceModel;
  }

  private calculateVariance(
    scenarios: VarianceScenario,
    element: TimeChartDataModelEntry,
    scenarioMap: Map<string, string>,
  ): number | null | undefined {
    const scenarioBase = scenarioMap.get(scenarios.base);
    const scenarioDelta = scenarioMap.get(scenarios.delta);

    if (scenarioBase == null || scenarioDelta == null) {
      return null;
    }

    if (element[scenarioBase].value == null || element[scenarioDelta].value == null) {
      return null;
    }

    const isRelativeVariance = scenarios.type === VarianceType.RELATIVE;

    if (isRelativeVariance) {
      // NaN marks a bucket without data and stays empty; undefined is a reference of 0 and is shown as "n/a"
      return relativeVariance(element[scenarioBase].value - element[scenarioDelta].value, element[scenarioDelta].value);
    } else {
      return element[scenarioBase].value - element[scenarioDelta].value;
    }
  }

  private mapScenarios(scenarios: VarianceScenario, firstRow: TimeChartDataModelEntry | null): Map<string, string> {
    const varianceMap: Map<string, string> = new Map();

    if (firstRow == null) {
      return varianceMap;
    }

    ["scenario1", "scenario2", "scenario3", "scenario4"].forEach((scenarioKey) => {
      if (firstRow[scenarioKey].scenario === scenarios.delta) {
        varianceMap.set(scenarios.delta, scenarioKey);
      } else if (firstRow[scenarioKey].scenario === scenarios.base) {
        varianceMap.set(scenarios.base, scenarioKey);
      }
    });

    return varianceMap;
  }

  private cleanSVGforRedraw(svgContainer: Svg) {
    svgContainer.clear();
  }

  private isVarianceChart() {
    return this.variancesDataModel && this.variancesDataModel.length > 0;
  }

  private createDateFactory(): DateStringFactory {
    const factory: DateStringFactory = new DateStringFactory();
    factory.setLocale(this.locale);
    // a Luxon pattern from the translations, for example ’yy
    const shortYear = this.i18n.get("date-format-short-year");
    if (typeof shortYear === "string" && /y/.test(shortYear) && !shortYear.includes("date-format")) {
      factory.patchDateFormatShort({ year: shortYear });
    }
    return factory;
  }

  /**
   * Side of the axis and distance from it for the date label of one period: opposite the
   * value, and for a stack opposite its total and behind the segments on that side.
   */
  private dateLabelPlace(elements: TimeChartDataModelEntry): { hookLocation: HookLocation; offset: number } {
    let flipped = elements["scenario1"]["value"] < 0;
    let offset = this.position.spacings.labelToAxis;
    const step = this.walk.find((entry) => entry.index === elements.id);
    if (step != null) {
      // a step hangs at its level: the label stands opposite the side the column is on
      const low = Math.min(step.from, step.to);
      const high = Math.max(step.from, step.to);
      flipped = high <= 0 ? low < 0 : low < 0 && flipped;
    }

    if (this.stackConfig != null && !this.isVarianceChart()) {
      // a column stack prints its total behind its segments, a 100 % stack and the area print none
      const printsTotal =
        this.stackConfig.mode !== StackMode.RELATIVE && this.determineEffectiveChartMode() !== ChartMode.LINE;
      const totalLabelRoom = printsTotal
        ? (this.position.spacings.labelToColumn + this.position.dataLabelHeight) / this.pixelPerUnit
        : 0;
      const layouts = this.stackGroups(elements)
        .filter((group) => group.hasValue)
        .map((group) => group.layout);
      let side = stackLabelSide(layouts, () => totalLabelRoom);

      // Above the columns the layout has room for one label, below for two. A date label that
      // would go above the total label of a back stack goes below instead, under everything there.
      if (side.flipped && totalLabelRoom > 0 && layouts.some((layout) => layout.total >= 0)) {
        side = {
          flipped: false,
          clearance: Math.max(...layouts.map((layout) => layout.negative + (layout.total < 0 ? totalLabelRoom : 0))),
        };
      }

      flipped = side.flipped;
      offset += side.clearance * this.pixelPerUnit;
    }

    return flipped
      ? { hookLocation: HookLocation.Bottom, offset: -offset }
      : { hookLocation: HookLocation.Top, offset };
  }

  private drawAxisAndLabels(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    const dateStringFactory: DateStringFactory = this.createDateFactory();

    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLables");

    let isRelative: boolean = false;

    if (this.hideAxisLabels === false) {
      dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
        const { hookLocation, offset } = this.dateLabelPlace(elements);
        if (elements["type"] === VarianceType.RELATIVE) {
          isRelative = true;
        }
        // in smart mode a period that starts a year or month carries that part alone, so it is never skipped
        const carriesBoundary =
          this.axisLabelsMode === AxisLabelsMode.SMART &&
          dateStringFactory.isSmartBoundary(elements.date, this.dateInterval);
        if (index % this.axisLabelsStep !== 0 && !carriesBoundary) {
          return;
        }

        let datelabel = dateStringFactory.getDateString(elements.date, this.dateInterval);

        if (this.axisLabelsMode === AxisLabelsMode.SMART) {
          datelabel = dateStringFactory.getSmartDateString(elements.date, this.dateInterval);

          if (index === 0 && this.dateInterval !== DateDistance.YEAR) {
            datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
          }
        } else if (this.axisLabelsMode === AxisLabelsMode.SHORT) {
          datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
        } else if (this.axisLabelsMode === AxisLabelsMode.TWO_ROW && this.dateInterval !== DateDistance.YEAR) {
          // the parent period stands in the second row
          datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
        }

        new Label(
          axisLabelGroup,
          this.position.getColumnCenterPositionX(index),
          this.position.getAxisPositionY(isRelative) + offset,
          "",
          datelabel,
          this.styles,
          hookLocation,
          HookLocation.Center,
        ).forceStringTypeDraw();
      });
    } else {
      const element = dataModel?.[0];
      if (element && element["type"] === VarianceType.RELATIVE) {
        isRelative = true;
      }
    }

    new Axis(
      {
        scenarioType: this.axisScenario,
        labelText: this.title,
        isRelative: isRelative,
        titlePosition: this.axisTitlePosition,
        titleX: this.rightTitleX(),
      },
      this.position,
      axisLabelGroup,
    ).draw();
    // svg.js's width()/height() getters each default to their own bbox() call,
    // so reading both measures the group twice. Measure once.
    const axisBox = axisLabelGroup.bbox();
    this.axisCategoryArea = {
      height: axisBox.height,
      width: axisBox.width,
    };

    this.drawScenarioSwitch(svgContainer);
  }

  /**
   * A vertical line where the visible scenario of the series changes, and the
   * scenario names under the category labels. Drawn after the axis is
   * measured, so it does not change the allocated size by itself.
   */
  private drawScenarioSwitch(svgContainer: Svg) {
    const runs = this.switchRuns();
    const entries = this.contextRow();
    if (runs.length < 2 && entries.length === 0) {
      return;
    }
    const group: G = svgContainer.group().id("ScenarioSwitch");
    const namesHeight = this.switchNamesHeight();
    const height = this.getAllocatedCanvasHeight();
    const bottom = namesHeight > 0 ? height - this.styles.padding.bottom : height;
    const lineWidth = Math.max(1, this.position.spacings.auxiliaryLineWidth);

    runs.slice(1).forEach((run) => {
      // half a period before the first period of the run: a total column can stand between the two runs
      const x = this.position.getColumnCenterPositionX(run.from) - this.position.spacings.categoryWidth / 2;
      group
        .line(x, 0, x, bottom)
        .stroke({ color: this.styles.fontStyles.color || "#000000", width: lineWidth })
        .addClass("scenario-switch");
    });

    if (namesHeight === 0) {
      return;
    }
    // in two-row mode a text starts at the left edge of its period, like the parent period it carries
    const leftAligned = this.axisLabelsMode === AxisLabelsMode.TWO_ROW;
    entries.forEach((entry) => {
      const x = leftAligned
        ? this.position.getColumnCenterPositionX(entry.from) - this.position.getColumnWidth() / 2
        : (this.position.getColumnCenterPositionX(entry.from) + this.position.getColumnCenterPositionX(entry.to)) / 2;
      new Label(
        group,
        x,
        bottom - namesHeight,
        "SWITCH_" + entry.scenario + "_" + entry.from,
        entry.text,
        this.styles,
        HookLocation.Top,
        leftAligned ? HookLocation.Left : HookLocation.Center,
      ).forceStringTypeDraw();
    });
  }

  private drawScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    const columnGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(
      this.position,
      columnGroup,
      this.scenarioStyles(),
      dataModel.length,
      this.i18n,
    );
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    let hasValidPrim: boolean = false;
    const followers = this.followerSlots();
    const referenceColumn = this.referenceColumnSlot();

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      // a follower takes the place of the first scenario: full column with value label, named under the axis
      const visible = followers.length > 0 ? this.visibleSlot(elements, followers) : "scenario1";
      if (visible != null && visible !== "scenario1") {
        scenarioFactory
          .createPrimaryBar(elements[visible], index, false)
          .draw(this.dataFormatDigits, this.measureScale);
        hasValidPrim = true;
      } else {
        scenarioFactory.createPrimaryBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
      if (visible !== "scenario2") {
        scenarioFactory.createSecondaryBar(elements["scenario2"], index).draw();
      }
      if (referenceColumn === "scenario3") {
        scenarioFactory.createSecondaryBar(elements["scenario3"], index).draw();
      } else if (visible !== "scenario3") {
        scenarioFactory.createPrimaryMarker(elements["scenario3"], index).draw();
      }
      if (referenceColumn === "scenario4") {
        scenarioFactory.createSecondaryBar(elements["scenario4"], index).draw();
      } else if (visible !== "scenario4") {
        scenarioFactory.createSecondaryMarker(elements["scenario4"], index).draw();
      }

      if (elements["scenario1"].isEmpty() === false) {
        hasValidPrim = true;
      }
    });

    let heightOffset = 0;
    if (hasValidPrim === false) {
      if (this.isOnSameAxisSide()) {
        heightOffset = this.position.dataLabelHeight;
      } else {
        heightOffset = this.position.dataLabelHeight * 2;
      }
    }

    const columnBox = columnGroup.bbox();
    this.scenariosArea = {
      height: columnBox.height + this.styles.padding.top + this.styles.padding.bottom + heightOffset,
      width: columnBox.width + this.position.spacings.columnWidth,
    };
  }

  private drawLineScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    const lineGroup: G = svgContainer.group().id("LineScenarios");
    // Create collision manager for label overlap detection across all line series
    const collisionManager = new LabelCollisionManager();

    const scenarioFactory = new ScenarioFactory(
      this.position,
      lineGroup,
      this.scenarioStyles(),
      dataModel.length,
      this.i18n,
    );
    scenarioFactory.setCollisionManager(collisionManager);

    // Collect data points for each scenario
    const slotDefaults = ["ac1", "pp1", "fc1", "pl1"];
    const slotPoints: LineSeriesDataPoint[][] = [[], [], [], []];

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      const keys = ["scenario1", "scenario2", "scenario3", "scenario4"];
      keys.forEach((key, slotIdx) => {
        if (elements[key]) {
          slotPoints[slotIdx].push({ dataPoint: elements[key], index });
        }
      });
    });

    // Build scenario info (only non-empty scenarios)
    const scenarios: { points: LineSeriesDataPoint[]; scenarioName: string; scenarioType: string }[] = [];
    for (let i = 0; i < slotPoints.length; i++) {
      const points = slotPoints[i];
      if (points.length > 0 && points.some((p) => !p.dataPoint.isEmpty())) {
        const scenarioName = (points[0]?.dataPoint?.scenario as string) || slotDefaults[i];
        const scenarioType = scenarioName.slice(0, 2).toLowerCase();
        scenarios.push({ points, scenarioName, scenarioType });
      }
    }

    // Sort by z-order: lowest priority first so SVG groups are created in correct render order
    // PL(4) → FC(3) → PP(2) → AC(1) - AC geometry on top of PP geometry
    scenarios.sort((a, b) => {
      const pa = SCENARIO_PRIORITY[a.scenarioType] || 99;
      const pb = SCENARIO_PRIORITY[b.scenarioType] || 99;
      return pb - pa;
    });

    // Create LineSeries in z-order (SVG group creation order = render order)
    const seriesList: { series: LineSeries; scenarioType: string }[] = [];
    for (const scenario of scenarios) {
      const series = scenarioFactory.createLineSeries(
        scenario.points,
        scenario.scenarioName,
        styleSlot(this.ruleSet.getScenarioColorIndex(scenario.scenarioName)),
      );
      seriesList.push({ series, scenarioType: scenario.scenarioType });
    }

    // Phase 1: Draw geometry (groups already in correct z-order from creation)
    for (const entry of seriesList) {
      entry.series.drawGeometry();
    }

    // Move label group to front so labels render on top of all lines/markers
    scenarioFactory.moveLabelsToFront();

    // Phase 2: Draw labels in priority order (highest priority first)
    // AC(1) → PP(2) → FC(3) → PL(4) so AC claims best label positions first
    const labelOrder = [...seriesList].sort((a, b) => {
      const pa = SCENARIO_PRIORITY[a.scenarioType] || 99;
      const pb = SCENARIO_PRIORITY[b.scenarioType] || 99;
      return pa - pb; // lowest priority number first (AC first)
    });

    for (const entry of labelOrder) {
      entry.series.drawLabels(this.dataFormatDigits, this.measureScale);
    }

    // In line mode the lines only span between data points (all above the axis),
    // so lineGroup.height() does not extend to the axis like bar rects do.
    // Use getColumnPositionY() (the axis baseline) as the minimum height
    // so that axis date labels drawn below are not cut off.
    const axisY = this.position.getColumnPositionY();
    const lineBox = lineGroup.bbox();
    this.scenariosArea = {
      height: Math.max(lineBox.height + this.styles.padding.top, axisY) + this.styles.padding.bottom,
      width: lineBox.width + this.position.spacings.columnWidth,
    };
  }

  private drawAxisAndLabelsForLineChart(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    const dateStringFactory: DateStringFactory = this.createDateFactory();
    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLabelsLine");
    const isRelative: boolean = false;
    const lastIndex = dataModel.length - 1;

    if (this.hideAxisLabels === false) {
      dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
        // Only show labels for first, last, and year change points
        if (!this.shouldShowLineChartAxisLabel(dataModel, index)) {
          return;
        }

        const { hookLocation, offset } = this.dateLabelPlace(elements);

        // Get the date label - use smart/short logic when full-width shows all labels
        let datelabel: string;
        if (this.lineFullWidth && this.availableWidth > 0) {
          if (this.axisLabelsMode === AxisLabelsMode.SMART) {
            datelabel = dateStringFactory.getSmartDateString(elements.date, this.dateInterval);
            if (index === 0 && this.dateInterval !== DateDistance.YEAR) {
              datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
            }
          } else if (this.axisLabelsMode === AxisLabelsMode.SHORT) {
            datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
          } else {
            datelabel = dateStringFactory.getDateString(elements.date, this.dateInterval);
          }
        } else {
          datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
        }

        new Label(
          axisLabelGroup,
          this.position.getColumnCenterPositionX(index),
          this.position.getAxisPositionY(isRelative) + offset,
          "",
          datelabel,
          this.styles,
          hookLocation,
          HookLocation.Center,
        ).forceStringTypeDraw();

        // Draw vertical dashed separator line at year transitions (except for first and last)
        if (index > 0 && index < lastIndex && this.isYearChange(dataModel, index)) {
          this.drawYearSeparatorLine(axisLabelGroup, index, isRelative);
        }
      });
    }

    new Axis(
      {
        scenarioType: this.axisScenario,
        labelText: this.title,
        isRelative: isRelative,
      },
      this.position,
      axisLabelGroup,
    ).draw();

    // svg.js's width()/height() getters each default to their own bbox() call,
    // so reading both measures the group twice. Measure once.
    const axisBox = axisLabelGroup.bbox();
    this.axisCategoryArea = {
      height: axisBox.height,
      width: axisBox.width,
    };
  }

  private shouldShowLineChartAxisLabel(dataModel: TimeChartDataModelEntry[], index: number): boolean {
    // In full-width mode, every data point gets a label (enough horizontal space)
    if (this.lineFullWidth && this.availableWidth > 0) {
      return true;
    }

    const lastIndex = dataModel.length - 1;

    // Always show first and last labels
    if (index === 0 || index === lastIndex) {
      return true;
    }

    // Show label if year changed from previous data point
    return this.isYearChange(dataModel, index);
  }

  private isYearChange(dataModel: TimeChartDataModelEntry[], index: number): boolean {
    if (index === 0) {
      return false;
    }

    const currentDate = dataModel[index]?.date;
    const previousDate = dataModel[index - 1]?.date;

    if (!currentDate || !previousDate) {
      return false;
    }

    // a week belongs to its ISO week year, which is also what its label shows
    if (this.dateInterval === DateDistance.WEEK) {
      return currentDate.weekYear !== previousDate.weekYear;
    }

    return currentDate.year !== previousDate.year;
  }

  private drawYearSeparatorLine(group: G, index: number, isRelative: boolean): void {
    const xPos = this.position.getColumnCenterPositionX(index) - this.position.spacings.columnWidth / 2;
    // Calculate chart height from the max data point
    const chartHeight = this.position.columnValue.max.getScaledUnit() + this.position.dataLabelHeight;
    const topY = this.position.getAxisPositionY(isRelative) - chartHeight;
    const bottomY = this.position.getAxisPositionY(isRelative);

    group
      .line([
        [xPos, topY],
        [xPos, bottomY],
      ])
      .stroke({
        color: "#999999",
        width: 1,
        dasharray: DASH_ARRAY,
      })
      .attr("stroke-dasharray", DASH_ARRAY);
  }

  private drawVarianceScenario(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): G {
    const columnGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(
      this.position,
      columnGroup,
      this.scenarioStyles(),
      dataModel.length,
      this.i18n,
    );
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      if (elements["type"] === VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits);
      } else {
        scenarioFactory.createVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
    });

    const varianceBox = columnGroup.bbox();
    this.scenariosArea = {
      height: varianceBox.height + this.styles.padding.top + this.styles.padding.bottom,
      width: varianceBox.width + this.position.spacings.columnWidth,
    };

    return columnGroup;
  }

  /** Restore the original `scenarios` prop order for stacked segments (IBCS sort reorders the slots). */
  private sortSegmentsByPropOrder(segments: { value: number; scenario: string; dataPoint: DataPoint }[]): void {
    if (this.scenarioPropOrder.length === 0) return;
    const order = this.scenarioPropOrder;
    segments.sort((a, b) => {
      const ia = order.indexOf(a.scenario);
      const ib = order.indexOf(b.scenario);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });
  }

  /**
   * The stacks of one period as they are drawn. Columns: one stack per scenario family
   * when the period mixes several (overlay, back to front per IBCS layer order), else a
   * single one. Line mode: the area stacks every scenario in one stack.
   */
  private stackGroups(row: TimeChartDataModelEntry): StackGroup[] {
    if (!this.stackConfig) return [];

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    const isArea = this.determineEffectiveChartMode() === ChartMode.LINE;
    const relativeSpan = this.stackConfig.mode === StackMode.RELATIVE ? RELATIVE_STACK_UNITS : 0;
    // a segment without a value sorts like 0: NaN in the comparison would leave the stack unsorted
    const sortValue = (segment: StackGroupSegment): number => (Number.isFinite(segment.value) ? segment.value : 0);
    const sortByValue = (list: StackGroupSegment[]): void => {
      if (this.stackConfig!.order === "asc") {
        list.sort((a, b) => sortValue(a) - sortValue(b));
      } else if (this.stackConfig!.order === "desc") {
        list.sort((a, b) => sortValue(b) - sortValue(a));
      }
    };

    if (!isScenarioStack && !isArea && row.series) {
      // one stack of the scenario that is visible in this period
      const slot = this.visibleSlot(row, this.followerSlots()) ?? "scenario1";
      const { fill } = this.seriesSlots();
      const series: StackGroupSegment[] = [];
      row.series.forEach((entry, index) => {
        // a series without a value in the visible scenario takes the scenario that fills it
        const filling = TimeChart.hasAmount(entry.points[slot])
          ? undefined
          : fill.find((other) => TimeChart.hasAmount(entry.points[other]));
        const dataPoint = entry.points[filling ?? slot];
        if (dataPoint) {
          series.push({
            value: dataPoint.value as number,
            scenario: dataPoint.scenario as string,
            dataPoint,
            colorIndex: index,
            label: entry.key,
          });
        }
      });
      if (!series.some((segment) => Number.isFinite(segment.value))) return [];
      sortByValue(series);
      return [
        {
          prefix: "",
          segments: series,
          layout: layoutStack(
            series.map((segment) => segment.value),
            relativeSpan,
          ),
          hasValue: true,
        },
      ];
    }

    const segments: StackGroupSegment[] = [];

    for (const key of isScenarioStack ? ["scenario1", "scenario2", "scenario3", "scenario4"] : ["scenario1"]) {
      const dp: DataPoint = row[key];
      if (dp && !dp.isEmpty() && dp.value != null) {
        segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
      }
    }

    if (segments.length === 0) return [];

    const toGroup = (prefix: string, groupSegments: StackGroupSegment[]): StackGroup => ({
      prefix,
      segments: groupSegments,
      layout: layoutStack(
        groupSegments.map((segment) => segment.value),
        relativeSpan,
      ),
      hasValue: groupSegments.some((segment) => Number.isFinite(segment.value)),
    });

    if (isScenarioStack) {
      this.sortSegmentsByPropOrder(segments);
    }

    if (isArea) {
      return [toGroup("", segments)];
    }

    if (isScenarioStack) {
      const groupMap = new Map<string, StackGroupSegment[]>();
      for (const seg of segments) {
        const prefix = getScenarioPrefix(seg.scenario);
        if (!groupMap.has(prefix)) groupMap.set(prefix, []);
        groupMap.get(prefix)!.push(seg);
      }

      if (groupMap.size > 1) {
        // Sort groups by IBCS layer order (back-to-front: pl, fc, pp, ac)
        const groups: StackGroup[] = [];
        for (const prefix of IBCS_LAYER_ORDER) {
          if (groupMap.has(prefix)) {
            groups.push(toGroup(prefix, groupMap.get(prefix)!));
            groupMap.delete(prefix);
          }
        }
        for (const [prefix, segs] of groupMap) {
          groups.push(toGroup(prefix, segs));
        }
        return groups;
      }
    }

    sortByValue(segments);

    return [toGroup("", segments)];
  }

  /**
   * Draw stacked bar columns. Supports stacking by scenario or by data dimension.
   * When stacking by scenario with multiple scenario types (e.g. ac+pl),
   * uses overlay mode: each type group is drawn from the same baseline,
   * back-to-front per IBCS convention (PL behind, AC on top).
   * Positive segments stack above the axis, negative segments below it.
   */
  private drawStackedScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const { reference } = this.seriesSlots();
    if (reference) {
      // the reference of each period as a column behind its stack
      const factory = new ScenarioFactory(
        this.position,
        svgContainer.group().id("StackReference"),
        this.scenarioStyles(),
        dataModel.length,
        this.i18n,
      );
      // the name of the reference stands left of the first column, where the names of the series stand too
      const legend = this.stackConfig.legend ?? "left";
      const named = legend !== "left" && legend !== "both";
      dataModel.forEach((elements, index) => factory.createSecondaryBar(elements[reference], index, named).draw());
    }

    const stackGroup: G = svgContainer.group().id("StackedScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      const groups = this.stackGroups(elements);

      groups.forEach((group, groupIdx) => {
        let lastColumn: StackedColumn | null = null;

        group.segments.forEach((seg, segIdx) => {
          const column = new StackedColumn(
            this.position,
            this.styles,
            seg.dataPoint,
            index,
            group.layout.segments[segIdx],
            seg.scenario,
            // overlay: one colour per group, back=lighter, front=darker
            groups.length > 1 ? groups.length - 1 - groupIdx : (seg.colorIndex ?? segIdx),
            this.stackConfig!.mode,
            group.layout,
            isScenarioStack,
            stackGroup,
            this.stackConfig!.notation === "scenario",
            this.hasPercentMark(),
          );
          column.draw(this.dataFormatDigits, this.measureScale);
          lastColumn = column;
        });

        if (lastColumn && group.hasValue) {
          // an overlay has one total per scenario family: the family tells them apart
          (lastColumn as StackedColumn).drawTotalLabel(this.dataFormatDigits, this.measureScale, {
            date: TimeChart.pointDate(elements.date),
            scenario: groups.length > 1 ? group.prefix : undefined,
          });
        }
      });
    });

    const stackBox = stackGroup.bbox();
    this.scenariosArea = {
      height: stackBox.height + this.styles.padding.top + this.styles.padding.bottom,
      width: stackBox.width + this.position.spacings.columnWidth,
    };
  }

  /** True for a 100 % stack that prints plain shares and one `100%` mark. */
  private hasPercentMark(): boolean {
    return this.stackConfig?.mode === StackMode.RELATIVE && this.stackConfig.percentMark === true;
  }

  /** The side of the `100%` mark: with the series names, at the left when they stand on both sides or nowhere. */
  private percentMarkSide(): "left" | "right" {
    return this.stackConfig?.legend === "right" ? "right" : "left";
  }

  /** The name of a series of a stack by dimension. A translation of the category wins. */
  private seriesName(key: string): string {
    return (this.i18n.get(key) || key) as string;
  }

  /**
   * Width of the widest text the stack writes on one side of the columns, 0 when
   * there is none. The names of a stack by scenario at the left are part of the
   * left offset the component hands in, so they do not count here.
   */
  private legendWidth(side: "left" | "right"): number {
    // the stacked area draws no names and no mark
    if (!this.stackConfig || this.determineEffectiveChartMode() !== ChartMode.BAR) return 0;
    const legend = this.stackConfig.legend ?? "left";
    const texts: string[] = [];
    if (legend === side || legend === "both") {
      const series = this.dataModel.find((row) => row.series != null)?.series;
      if (series) {
        texts.push(...series.map((entry) => this.seriesName(entry.key)));
      } else if (side === "right" && this.stackConfig.by === StackBy.SCENARIOS) {
        texts.push(...this.lastScenarios.map((scenario) => (this.i18n.get(scenario) || scenario) as string));
      }
    }
    if (this.hasPercentMark() && this.percentMarkSide() === side) {
      texts.push("100%");
    }
    let width = 0;
    for (const text of texts) {
      width = Math.max(
        width,
        CalculateSize(text, { font: this.styles.fontStyles.font, fontSize: this.styles.fontStyles.size + "px" }).width,
      );
    }
    return width;
  }

  /**
   * Draw column headers next to stacked columns showing what each group/segment represents.
   * For overlay mode (multiple scenario types): shows one header per group.
   * For single-group: shows individual segment headers.
   * The headers at the left take their place from the first period, the ones at
   * the right from the last period with a value.
   */
  private drawStackedHeaders(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig || dataModel.length === 0) return;

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    const hasSeries = dataModel.some((row) => row.series != null);
    if (!isScenarioStack && !hasSeries) return;

    const headerGroup: G = svgContainer.group().id("StackedHeaders");
    const axisY = this.position.getColumnPositionY();
    const halfColumn = this.position.getColumnWidth() / 2;
    const gap = this.position.spacings.labelToColumn;

    const withValue = dataModel.map((row, index) => (this.stackGroups(row).length > 0 ? index : -1));
    const filled = withValue.filter((index) => index >= 0);
    // a stack by scenario keeps the first period, also when it is empty
    const firstIndex = hasSeries ? (filled[0] ?? 0) : 0;
    const lastIndex = filled[filled.length - 1] ?? dataModel.length - 1;

    const drawSide = (side: "left" | "right"): void => {
      const index = side === "left" ? firstIndex : lastIndex;
      const groups = this.stackGroups(dataModel[index]);
      if (groups.length === 0) return;

      const center = this.position.getColumnCenterPositionX(index);
      const labelX = side === "left" ? center - halfColumn - gap : center + halfColumn + gap;

      const drawHeader = (centerY: number, labelText: string): void => {
        new Label(
          headerGroup,
          labelX,
          centerY,
          "STACK_HEADER",
          labelText,
          this.styles,
          HookLocation.Center,
          side === "left" ? HookLocation.Right : HookLocation.Left,
        ).forceStringTypeDraw();
      };

      if (groups.length > 1) {
        // Overlay mode: one header per group
        groups.forEach((group, groupIdx) => {
          const { positive, negative, total } = group.layout;
          const pixelPerUnit = group.segments[0].dataPoint.pixelPerUnit;
          // The front-most group (drawn last, e.g. AC) is fully visible, so its
          // label is centered on the bar. Back groups are mostly hidden behind it
          // and only peek out at their outer end, so their labels align with that edge.
          const isFrontGroup = groupIdx === groups.length - 1;
          const outerEnd = total < 0 ? 0 - negative : positive;
          const centerY = axisY - (isFrontGroup ? (positive - negative) / 2 : outerEnd) * pixelPerUnit;

          drawHeader(centerY, (this.i18n.get(group.prefix + "1") || group.prefix.toUpperCase()) as string);
        });
        return;
      }

      // Single group: one header per segment, centered on the segment
      const [group] = groups;
      group.segments.forEach((seg, segIdx) => {
        // a series without a value in this period has no segment to stand next to
        if (seg.label != null && !Number.isFinite(seg.value)) return;
        const { start, end } = group.layout.segments[segIdx];

        drawHeader(
          axisY - ((start + end) / 2) * seg.dataPoint.pixelPerUnit,
          seg.label != null ? this.seriesName(seg.label) : ((this.i18n.get(seg.scenario) || seg.scenario) as string),
        );
      });
    };

    const legend = this.stackConfig.legend ?? "left";
    if (legend === "left" || legend === "both") drawSide("left");
    if (legend === "right" || legend === "both") drawSide("right");

    if (this.hasPercentMark() && filled.length > 0) {
      this.drawPercentMark(headerGroup, this.percentMarkSide() === "left" ? firstIndex : lastIndex);
    }
  }

  /** The `100%` label with a pointer at the upper end of a 100 % stack, on the side of the series names. */
  private drawPercentMark(group: G, index: number): void {
    const side = this.percentMarkSide();
    const direction = side === "left" ? -1 : 1;
    const top = this.position.getColumnPositionY() - RELATIVE_STACK_UNITS * this.pixelPerUnit;
    const edge = this.position.getColumnCenterPositionX(index) + direction * (this.position.getColumnWidth() / 2);
    const size = this.styles.fontStyles.size * 0.45;
    const tip = edge + direction * 1;
    const base = tip + direction * size;

    group
      .polygon([
        [tip, top],
        [base, top - size / 2],
        [base, top + size / 2],
      ])
      .fill(this.styles.fontStyles.color || "#000000")
      .addClass("percent-mark");

    // above the pointer, so the name of the uppermost series keeps its place next to its segment
    new Label(
      group,
      base,
      top - size / 2,
      "STACK_PERCENT_MARK",
      "100%",
      this.styles,
      HookLocation.Bottom,
      side === "left" ? HookLocation.Right : HookLocation.Left,
    ).forceStringTypeDraw();
  }

  /**
   * Draw stacked area chart (line mode with stack).
   * Computes cumulative y-values and draws AreaFill paths between layers.
   */
  private drawStackedAreaScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const areaGroup: G = svgContainer.group().id("StackedAreaScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    const stackMode = this.stackConfig.mode;
    const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];

    // Determine how many layers we have
    const layerCount = isScenarioStack
      ? scenarioKeys.filter((key) => dataModel.some((el: TimeChartDataModelEntry) => el[key] && !el[key].isEmpty()))
          .length
      : 1;

    if (layerCount === 0) return;

    const layerScenarios: string[] = [];

    // Identify active layers
    const activeLayers: string[] = [];
    // a stack by dimensions draws its first scenario only
    for (const key of isScenarioStack ? scenarioKeys : ["scenario1"]) {
      if (dataModel.some((el: TimeChartDataModelEntry) => el[key] && !el[key].isEmpty())) {
        activeLayers.push(key);
      }
    }

    if (isScenarioStack && this.scenarioPropOrder.length > 0) {
      const order = this.scenarioPropOrder;
      activeLayers.sort((a, b) => {
        const ia = order.indexOf((dataModel[0][a]?.scenario as string) ?? "");
        const ib = order.indexOf((dataModel[0][b]?.scenario as string) ?? "");
        return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
      });
    }

    for (const key of activeLayers) {
      const firstDp: DataPoint = dataModel[0][key];
      layerScenarios.push((firstDp?.scenario as string) || "ac1");
    }

    const layerValue = (row: TimeChartDataModelEntry, key: string): number => {
      const dp: DataPoint = row[key];
      return dp && !dp.isEmpty() && Number.isFinite(dp.value) ? dp.value : 0;
    };

    // A layer that is negative over all periods stays below the axis where it has no value:
    // -0 is a segment without length on the negative side
    const emptyValues = activeLayers.map((key) =>
      dataModel.reduce((sum: number, row: TimeChartDataModelEntry) => sum + layerValue(row, key), 0) < 0 ? -0 : 0,
    );

    // One stack per period over all layers, laid out like the columns: positive layers
    // above the axis, negative layers below it
    const relativeSpan = stackMode === StackMode.RELATIVE ? RELATIVE_STACK_UNITS : 0;
    const layouts = dataModel.map((row: TimeChartDataModelEntry) =>
      layoutStack(
        activeLayers.map((key, layerIdx) => layerValue(row, key) || emptyValues[layerIdx]),
        relativeSpan,
      ),
    );

    // Convert the edges of a layer to pixel coordinates
    const axisY = this.position.getColumnPositionY();
    const pixelPerUnit = this.pixelPerUnit;

    const toAreaPoints = (layerIdx: number, edge: "start" | "end"): AreaPoint[] => {
      return layouts.map((layout, idx) => ({
        x: this.position.getColumnCenterPositionX(idx),
        y: axisY - layout.segments[layerIdx][edge] * pixelPerUnit,
      }));
    };

    // Draw area fills in layer order
    for (let layerIdx = 0; layerIdx < activeLayers.length; layerIdx++) {
      const upperPoints = toAreaPoints(layerIdx, "end");
      const lowerPoints = toAreaPoints(layerIdx, "start");

      const scenarioType = isScenarioStack
        ? styleSlot(this.ruleSet.getScenarioColorIndex(layerScenarios[layerIdx]))
        : null;

      const areaFill = new AreaFill(areaGroup, upperPoints, lowerPoints, scenarioType, layerIdx, isScenarioStack);
      areaFill.draw();
      areaFill.drawBoundaryLine();
    }

    const areaBox = areaGroup.bbox();
    this.scenariosArea = {
      height: areaBox.height + this.styles.padding.top + this.styles.padding.bottom,
      width: areaBox.width + this.position.spacings.columnWidth,
    };
  }

  private drawOverlayLayer(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    // no period, no average: the overlays read the first and the last period
    if (dataModel.length === 0) {
      return;
    }

    const overlayGroup: G = svgContainer.group().id("Overlay");

    const scenarioFactory = new ScenarioFactory(
      this.position,
      overlayGroup,
      this.scenarioStyles(),
      dataModel.length,
      this.i18n,
    );

    if (this.showOverlayAvg === true) {
      let previousDataPoint: DataPoint | null = null;

      const avgDataModel = tranformToAvgDataModel(dataModel);

      avgDataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory
            .createLine(
              `Ø  ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`,
              elements["scenario1"],
              previousDataPoint,
              index - 1,
            )
            .draw(this.dataFormatDigits, this.measureScale);
        }
        previousDataPoint = elements["scenario1"];
      });
    }

    if (this.showOverlayMedian === true) {
      let previousDataPoint: DataPoint | null = null;

      const medianDataModel = tranformToMedianDataModel(dataModel);

      medianDataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory
            .createLine(
              `Mdn ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`,
              elements["scenario1"],
              previousDataPoint,
              index - 1,
            )
            .draw(this.dataFormatDigits, this.measureScale);
        }
        previousDataPoint = elements["scenario1"];
      });
    }
  }

  private leftOuterJoinDates(result: TimeChartResponseRow[], dateInterval: DateDistance): TimeChartResponseRow[] {
    const validDates = result
      .map((e: TimeChartResponseRow) => e.calcdate)
      .filter((d): d is DateTime => d != null && typeof (d as DateTime).isValid === "boolean" && d.isValid);
    if (validDates.length === 0) {
      return result;
    }
    const to: DateTime = DateTime.max(...validDates);
    const from: DateTime = DateTime.min(...validDates);

    const dateStringFactory = new DateStringFactory();
    // an interval far finer than the data (second over a month) would add millions of empty periods
    if (dateStringFactory.countBetween(from, to, dateInterval) > MAX_GAP_FILLED_PERIODS) {
      return result;
    }

    const dateRange: DateTime[] = dateStringFactory.datesBetween(from, to, dateInterval);

    const dateRangeEntries: Map<string, TimeChartResponseRow> = new Map();

    dateRange.forEach((element: DateTime, idx: number) => {
      dateRangeEntries.set(element.toISO() as string, {
        id: idx,
        calcdate: element,
        category: null,
        ac1: null,
        ac2: null,
        ac3: null,
        ac4: null,
        pp1: null,
        pp2: null,
        pp3: null,
        pp4: null,
        fc1: null,
        fc2: null,
        fc3: null,
        fc4: null,
        pl1: null,
        pl2: null,
        pl3: null,
        pl4: null,
        isEmpty: true,
      });
    });

    result.forEach((element: TimeChartResponseRow) => {
      const millisecondKey: string = element.calcdate.toISO() as string;

      const placeholder = dateRangeEntries.get(millisecondKey);
      if (placeholder && placeholder.isEmpty) {
        const newElement = {
          id: placeholder.id,
          calcdate: element.calcdate,
          category: element.category,
          ac1: element.ac1,
          ac2: element.ac2,
          ac3: element.ac3,
          ac4: element.ac4,
          pp1: element.pp1,
          pp2: element.pp2,
          pp3: element.pp3,
          pp4: element.pp4,
          fc1: element.fc1,
          fc2: element.fc2,
          fc3: element.fc3,
          fc4: element.fc4,
          pl1: element.pl1,
          pl2: element.pl2,
          pl3: element.pl3,
          pl4: element.pl4,
          isEmpty: false,
        };
        dateRangeEntries.set(millisecondKey, newElement);
      }
    });

    return Array.from(dateRangeEntries.values());
  }
}
/** Values of scenario1 without the periods that have no value: a gap period holds null, a period without this scenario NaN. */
function finiteScenario1Values(dataModel: TimeChartDataModelEntry[]): number[] {
  return dataModel
    .map((elements: TimeChartDataModelEntry) => elements["scenario1"]?.value)
    .filter((value): value is number => Number.isFinite(value));
}

export function tranformToAvgDataModel(dataModel: TimeChartDataModelEntry[]) {
  const values = finiteScenario1Values(dataModel);

  // NaN draws no line
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;

  // Create a new first element
  const firstElement = {
    ...dataModel[0],
    scenario1: new DataPoint(
      average,
      dataModel[0]["scenario1"].scenario,
      dataModel[0]["scenario1"].pixelPerUnit,
      dataModel[0]["scenario1"].variance,
    ),
  };

  // Create a new last element
  const lastElement = {
    ...dataModel[dataModel.length - 1],
    scenario1: new DataPoint(
      average,
      dataModel[dataModel.length - 1]["scenario1"].scenario,
      dataModel[dataModel.length - 1]["scenario1"].pixelPerUnit,
      dataModel[dataModel.length - 1]["scenario1"].variance,
    ),
  };

  // Add the new first and last elements to the transformed data model
  return [
    firstElement,
    ...dataModel.map((elements: TimeChartDataModelEntry) => {
      return {
        ...elements,
        scenario1: new DataPoint(
          average,
          elements["scenario1"].scenario,
          elements["scenario1"].pixelPerUnit,
          elements["scenario1"].variance,
        ),
      };
    }),
    lastElement,
  ];
}

export function tranformToMedianDataModel(dataModel: TimeChartDataModelEntry[]) {
  const values = finiteScenario1Values(dataModel).sort((a: number, b: number) => a - b);

  // an empty list gives NaN, which draws no line
  const median =
    values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];

  // Create a new first element
  const firstElement = {
    ...dataModel[0],
    scenario1: new DataPoint(
      median,
      dataModel[0]["scenario1"].scenario,
      dataModel[0]["scenario1"].pixelPerUnit,
      dataModel[0]["scenario1"].variance,
    ),
  };

  // Create a new last element
  const lastElement = {
    ...dataModel[dataModel.length - 1],
    scenario1: new DataPoint(
      median,
      dataModel[dataModel.length - 1]["scenario1"].scenario,
      dataModel[dataModel.length - 1]["scenario1"].pixelPerUnit,
      dataModel[dataModel.length - 1]["scenario1"].variance,
    ),
  };

  // Add the new first and last elements to the transformed data model
  return [
    firstElement,
    ...dataModel.map((elements: TimeChartDataModelEntry) => {
      return {
        ...elements,
        scenario1: new DataPoint(
          median,
          elements["scenario1"].scenario,
          elements["scenario1"].pixelPerUnit,
          elements["scenario1"].variance,
        ),
      };
    }),
    lastElement,
  ];
}
