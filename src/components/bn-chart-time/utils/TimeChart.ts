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

import { StackConfigParsed, TimeChartComponentConfig } from "./model/TimeChartComponentConfig";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChart } from "./model/styles/ScaleFactorsTimeChart";
import { DateTime } from "luxon";
import { AlaSQLDatabase, sourceExpr } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { DateDistance, DateStringFactory } from "../../../utils/DateStringFactory";
import { AxisLabelsMode, ChartMode, RELATIVE_STACK_UNITS, StackBy, StackMode } from "../../../utils/constants";
import { getScenarioPrefix, IBCS_LAYER_ORDER } from "../../../utils/stackColors";
import { layoutStack, stackExtent, stackLabelSide, StackLayout } from "../../../utils/stackLayout";
import { computePercentBarExtent, computeUnitBarExtent } from "../../../utils/autoFit";
import { drawAttached } from "../../../utils/measurementHost";
import { DataFormatDigits } from "../../../components";
import { Formatter } from "../../../utils";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { relativeVariance } from "../../../utils/relativeVariance";
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
};

/** One segment of a stack. */
type StackGroupSegment = { value: number; scenario: string; dataPoint: DataPoint };

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
    const highest = this.isVarianceChart() ? this.highestVarianceDataPointValue : this.highestDataPointValue;
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
      fontSize; // axis labels approximate height

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
    this.dateInterval = this.findDateInterval(config.dateInterval);

    this.dataModel = this.populateModel(scenarios, this.dateInterval);
    this.variancesDataModel = this.populateVarianceModel(config.variances, this.dataModel);
    this.configTitle = config.title;
    this.configVariances = config?.variances ?? [];
    this.updateTitle();

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
      const { scenario, variance } = this.highestDataPointValue;
      this.highestDataPointValue = new DataPoint(sides.positive, scenario, this.pixelPerUnit, variance);
      this.smallestDataPointValue = new DataPoint(0 - sides.negative, scenario, this.pixelPerUnit, variance);
    }

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
    this.title = this.configTitle || Formatter.translateScenarioLabel(this.configVariances?.toString(), this.i18n);
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

    return Math.max(axisEnd + labelBuffer, bboxTotal);
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

    return Math.max(analyticalHeight, bboxHeight);
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
      this.drawVarianceScenario(this.variancesDataModel, svgContainer);
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
      }
    }
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
      ["SEPERATOR_WS", ", "],
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
      ["there_of", "davon"],
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
      const virtualHeight = cutHeight + overdriveZoneHeight + breakGap;
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

    return new ElementPositions(
      new Padding(this.styles.padding),
      effectiveScaleFactors,
      this.styles.fontStyles,
      min,
      max,
      this.dataModel.length,
      maxLabelLengthLeft,
    );
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

  private setAxisScenario(scenarios: string[]): Scenario {
    let result: Scenario = Scenario.AC1;

    if (scenarios != null && scenarios.length > 0) {
      const axis: VarianceScenario = new VarianceScenario(scenarios.toString());
      if (axis.isValid) {
        result = <Scenario>axis.delta;
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

    return dataModel;
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

    return dataModel;
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

    for (const varianceScenario in variancesConfig) {
      const scenarios: VarianceScenario = new VarianceScenario(variancesConfig[varianceScenario]);

      if (scenarios.isValid) {
        const scenariomap: Map<string, string> = this.mapScenarios(scenarios, firstRow);
        const directon: string = scenarios.direction;

        const pixelPerUnit = scenarios.type === "dr" ? this.pixelPerPercentage : this.pixelPerUnit;

        for (const index in dataModel) {
          varianceModel.push({
            id: Number(index),
            category: dataModel[index].category,
            type: scenarios.type === "dr" ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            date: dataModel[index].date,
            scenario1: new DataPoint(
              this.calculateVariance(scenarios, dataModel[index], scenariomap),
              scenarios.delta,
              pixelPerUnit,
              directon,
            ),
            scenario2: new DataPoint(null, null, null, null),
            scenario3: new DataPoint(null, null, null, null),
            scenario4: new DataPoint(null, null, null, null),
          });
        }
      }
    }
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
    return factory;
  }

  /**
   * Side of the axis and distance from it for the date label of one period: opposite the
   * value, and for a stack opposite its total and behind the segments on that side.
   */
  private dateLabelPlace(elements: TimeChartDataModelEntry): { hookLocation: HookLocation; offset: number } {
    let flipped = elements["scenario1"]["value"] < 0;
    let offset = this.position.spacings.labelToAxis;

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

        let datelabel = dateStringFactory.getDateString(elements.date, this.dateInterval);

        if (this.axisLabelsMode === AxisLabelsMode.SMART) {
          datelabel = dateStringFactory.getSmartDateString(elements.date, this.dateInterval);

          if (index === 0 && this.dateInterval !== DateDistance.YEAR) {
            datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
          }
        } else if (this.axisLabelsMode === AxisLabelsMode.SHORT) {
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

  private drawScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    const columnGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(this.position, columnGroup, this.styles, dataModel.length, this.i18n);
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    let hasValidPrim: boolean = false;

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      scenarioFactory.createPrimaryBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      scenarioFactory.createSecondaryBar(elements["scenario2"], index).draw();
      scenarioFactory.createPrimaryMarker(elements["scenario3"], index).draw();
      scenarioFactory.createSecondaryMarker(elements["scenario4"], index).draw();

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

    const scenarioFactory = new ScenarioFactory(this.position, lineGroup, this.styles, dataModel.length, this.i18n);
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
      const series = scenarioFactory.createLineSeries(scenario.points, scenario.scenarioName);
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
        dasharray: "4,4",
      })
      .attr("stroke-dasharray", "4,4");
  }

  private drawVarianceScenario(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): G {
    const columnGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(this.position, columnGroup, this.styles, dataModel.length, this.i18n);
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      if (elements["type"] === VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw();
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
    const segments: StackGroupSegment[] = [];

    for (const key of isScenarioStack || isArea
      ? ["scenario1", "scenario2", "scenario3", "scenario4"]
      : ["scenario1"]) {
      const dp: DataPoint = row[key];
      if (dp && !dp.isEmpty() && dp.value != null) {
        segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
      }
    }

    if (segments.length === 0) return [];

    const relativeSpan = this.stackConfig.mode === StackMode.RELATIVE ? RELATIVE_STACK_UNITS : 0;
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

    // a segment without a value sorts like 0: NaN in the comparison would leave the stack unsorted
    const sortValue = (segment: StackGroupSegment): number => (Number.isFinite(segment.value) ? segment.value : 0);
    if (this.stackConfig.order === "asc") {
      segments.sort((a, b) => sortValue(a) - sortValue(b));
    } else if (this.stackConfig.order === "desc") {
      segments.sort((a, b) => sortValue(b) - sortValue(a));
    }

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
            groups.length > 1 ? groups.length - 1 - groupIdx : segIdx,
            this.stackConfig!.mode,
            group.layout,
            isScenarioStack,
            stackGroup,
          );
          column.draw(this.dataFormatDigits, this.measureScale);
          lastColumn = column;
        });

        if (lastColumn && group.hasValue) {
          (lastColumn as StackedColumn).drawTotalLabel(this.dataFormatDigits, this.measureScale);
        }
      });
    });

    const stackBox = stackGroup.bbox();
    this.scenariosArea = {
      height: stackBox.height + this.styles.padding.top + this.styles.padding.bottom,
      width: stackBox.width + this.position.spacings.columnWidth,
    };
  }

  /**
   * Draw column headers next to stacked columns showing what each group/segment represents.
   * For overlay mode (multiple scenario types): shows one header per group.
   * For single-group: shows individual segment headers.
   * The headers take their place from the first period.
   */
  private drawStackedHeaders(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig || dataModel.length === 0) return;

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    if (!isScenarioStack) return;

    const headerGroup: G = svgContainer.group().id("StackedHeaders");

    const groups = this.stackGroups(dataModel[0]);
    if (groups.length === 0) return;

    const axisY = this.position.getColumnPositionY();
    const xBase = this.position.getColumnCenterPositionX(0) - this.position.getColumnWidth() / 2;
    const labelX = xBase - this.position.spacings.labelToColumn;

    const drawHeader = (centerY: number, labelText: string): void => {
      new Label(
        headerGroup,
        labelX,
        centerY,
        "STACK_HEADER",
        labelText,
        this.styles,
        HookLocation.Center,
        HookLocation.Right,
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
      const { start, end } = group.layout.segments[segIdx];

      drawHeader(
        axisY - ((start + end) / 2) * seg.dataPoint.pixelPerUnit,
        (this.i18n.get(seg.scenario) || seg.scenario) as string,
      );
    });
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
    for (const key of scenarioKeys) {
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

      const scenarioType = isScenarioStack ? layerScenarios[layerIdx] : null;

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

    const scenarioFactory = new ScenarioFactory(this.position, overlayGroup, this.styles, dataModel.length, this.i18n);

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
