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
import alasql from "alasql";

import CalculateSize from "calculate-size";

import { StackConfigParsed, TimeChartComponentConfig } from "./model/TimeChartComponentConfig";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChart } from "./model/styles/ScaleFactorsTimeChart";
import { TimeChartDataRow } from "./model/TimeChartDataRow";
import { DateTime } from "luxon";
import { DateDistance, DateStringFactory } from "../../../utils/DateStringFactory";
import { AggregationLevel, AxisLabelsMode, ChartMode, StackBy, StackMode } from "../../../utils/constants";
import { getScenarioPrefix, IBCS_LAYER_ORDER } from "../../../utils/stackColors";
import { DataFormatDigits, Order } from "../../../components";
import { Formatter } from "../../../utils";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";

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
  mindate?: any;
  maxdate?: any;
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
  private smallestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private smallestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private pixelPerUnit: number = 1;
  private pixelPerPercentage: number = 1;
  private hideAxisLabels: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  private preparedDataSet: TimeChartDataRow[] = [];

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
  private lineFullWidth: boolean = true;
  private availableWidth: number = 0;
  private overflowConfig: OverflowConfig | null = null;
  private lastScenarios: string[] = [];

  constructor(
    ruleSet: VisualisationRuleSet,
    config: TimeChartComponentConfig,
    styles: TimeChartStyle,
    availableWidth: number = 0,
  ) {
    this.initSQLFunctions();
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.i18n = this.createI18n(new Map());
    this.styles = styles;
    this.availableWidth = availableWidth;
    this.setConfig(config);
    this.position = this.createElementPosition(config.scenarios);
  }

  public updatePosition(scenarios: string[]) {
    this.position = this.createElementPosition(scenarios);
  }

  initSQLFunctions() {
    alasql.fn.transformOperator = function (a) {
      return a == "-" ? -1 : 1;
    };

    // @ts-ignore
    alasql.fn.normalizeDate = function (
      date: DateTime | undefined,
      normalizationLevel: string,
      _locale: string,
    ): DateTime | undefined {
      if (date == undefined || !date.isValid) {
        return undefined;
      }

      return date.startOf(normalizationLevel);
    };
  }

  public setStyles(newStyle: TimeChartStyle) {
    this.styles = newStyle;
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

    this.sortScenariosbyVisualisationRules(config);

    this.setData([...config.data], config.filter);
    this.hideAxisLabels = config.hideAxisLabels || false;
    this.pixelPerUnit = config.pixelPerUnit;
    this.pixelPerPercentage = config.pixelPerPercentage;
    this.axisLabelsMode = config.axisLabelsMode;
    this.intervalSpanLimit = config.intervalSpanLimit;
    this.dateInterval = this.findDateInterval(config.dateInterval);

    this.dataModel = this.populateModel(config.scenarios, this.dateInterval, config.level, config.sortOrder);
    this.variancesDataModel = this.populateVarianceModel(config.variances, this.dataModel);
    this.title = config.title || Formatter.translateScenarioLabel(config?.variances?.toString(), this.i18n);

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
    this.lastScenarios = config.scenarios;

    this.updatePosition(config.scenarios);
  }

  public getFooter(): string {
    if (this.measureScale.value == 1 && this.measureUnit == "") {
      return " ";
    }
    return Formatter.translateScenarioLabel("in", this.i18n) + " " + this.measureScale.prefix + this.measureUnit;
  }

  private sortScenariosbyVisualisationRules(config: TimeChartComponentConfig) {
    const self = this;
    config.scenarios
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
  }

  /**
   * Init load raw datasets the loaded dataset is
   * the base on which the filters defined in the config
   * are apllied on internaly it is called prepared DataSet
   *
   * @param data
   * @param filter - data filter
   * @param customColumnNameMap Custon ColumnNameMap can be used if data uses non standard columnames
   */
  public setData(data: TimeChartDataRow[], filter: string): void {
    if (data == null) {
      return;
    }

    this.state = FactoryState.DIRTY; // mark dataSet for update
    this.preparedDataSet.length = 0; // cleans formerly loaded and prepared  dataset

    if (filter != null && filter.length > 0) {
      try {
        this.preparedDataSet = alasql(`SELECT * FROM ? WHERE ${filter}`, [data]);
      } catch (e) {
        console.error("TimeChart: filter query failed, using unfiltered data", filter, e);
        this.preparedDataSet = data;
      }
    } else {
      this.preparedDataSet = data;
    }
  }

  public getAllocatedCanvasWidth(): number {
    // Analytical calculation — doesn't rely on text bbox (unreliable in detached SVGs)
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

    // Analytical calculation — doesn't rely on text bbox
    const isRelative =
      this.isVarianceChart() &&
      this.variancesDataModel.some((e: TimeChartDataModelEntry) => e.type === VarianceType.RELATIVE);
    const axisY = this.position.getAxisPositionY(isRelative);
    // Space below axis: gap to date labels + date label height + bottom padding
    const belowAxis = this.position.spacings.labelToAxis + this.position.dataLabelHeight + this.styles.padding.bottom;

    let analyticalHeight: number;
    if (!this.isOnSameAxisSide()) {
      // Bars extend below axis — account for negative bar + its data label
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

  public toString(): string {
    const container = new Svg();
    this.draw(container);
    container.id("drawCanvas");
    container.width(this.getAllocatedCanvasWidth());
    container.height(this.getAllocatedCanvasHeight());
    container.attr("overflow", "visible");
    return container.svg();
  }

  public draw(svgContainer: Svg): void {
    this.cleanSVGforRedraw(svgContainer);

    if (this.state == FactoryState.DIRTY) {
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
    return this.dataModel.length == 0;
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
        Math.sign(this.smallestVarianceDataPointValue.value) == Math.sign(this.highestVarianceDataPointValue.value) ||
        (this.smallestDataPointValue.value == 0 && Math.sign(this.highestDataPointValue.value) == 1)
      );
    } else {
      return (
        Math.sign(this.smallestDataPointValue.value) == Math.sign(this.highestDataPointValue.value) ||
        (this.smallestDataPointValue.value == 0 && Math.sign(this.highestDataPointValue.value) == 1)
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
    let maxLabelLengthLeft = 0;

    // only need scenarios written on the leftside of bar/ marker
    const scenarioLabelLeft = CalculateSize(
      scenarios
        .filter((_value, index) => index == 1 || index == 2)
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

  private populateModel(
    selectedScenarios: string[],
    dateInterval: DateDistance,
    _level: AggregationLevel,
    _sortOrder: Order,
  ): TimeChartDataModelEntry[] {
    if (this.preparedDataSet?.length === 0) {
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
  }

  private findDateInterval(dateInterval: DateDistance): DateDistance {
    if (dateInterval != DateDistance.AUTO) {
      return dateInterval;
    }

    const resultMinMax = this.queryMinMaxDates();
    let localDateInterval = DateDistance.DAY;

    if (resultMinMax[0]?.mindate != null) {
      localDateInterval = new DateStringFactory().calculateDistanceType(
        resultMinMax[0]?.mindate,
        resultMinMax[0]?.maxdate,
        this.intervalSpanLimit,
      );
    }

    return localDateInterval;
  }

  private queryMinMaxDates(): { mindate?: any; maxdate?: any }[] {
    //let result: any[] = [];
    const result = alasql<TimeChartResponseRow[]>(
      `SELECT MAX(${"date"}) as maxdate, MIN(${"date"}) as mindate FROM ?`,
      [this.preparedDataSet],
    );

    if (result[0]?.mindate != null) {
      result[0].mindate = DateTime.fromMillis(result[0]?.mindate);
    }
    if (result[0]?.maxdate != null) {
      result[0].maxdate = DateTime.fromMillis(result[0]?.maxdate);
    }

    return result;
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
    const result = alasql<TimeChartResponseRow[]>(
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
                                 FROM ?) as p
                           GROUP BY ${"calcdate"} ${order}
                           ORDER BY ${"calcdate asc"}`,
      [this.preparedDataSet],
    );

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

        const pixelPerUnit = scenarios.type == "dr" ? this.pixelPerPercentage : this.pixelPerUnit;

        for (const index in dataModel) {
          varianceModel.push({
            id: Number(index),
            category: dataModel[index].category,
            type: scenarios.type == "dr" ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
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
  ): number | null {
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
      return (element[scenarioBase].value - element[scenarioDelta].value) / element[scenarioDelta].value;
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
    return factory;
  }

  private drawAxisAndLabels(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    const dateStringFactory: DateStringFactory = this.createDateFactory();

    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLables");

    let isRelative: boolean = false;

    if (this.hideAxisLabels === false) {
      dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
        let hookLocation: HookLocation = HookLocation.Top;
        let offset = this.position.spacings.labelToAxis;
        if (elements["scenario1"]["value"] < 0) {
          hookLocation = HookLocation.Bottom;
          offset *= -1;
        }
        if (elements["type"] == VarianceType.RELATIVE) {
          isRelative = true;
        }

        let datelabel = dateStringFactory.getDateString(elements.date, this.dateInterval);

        if (this.axisLabelsMode == AxisLabelsMode.SMART) {
          datelabel = dateStringFactory.getSmartDateString(elements.date, this.dateInterval);

          if (index == 0 && this.dateInterval != DateDistance.YEAR) {
            datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);
          }
        } else if (this.axisLabelsMode == AxisLabelsMode.SHORT) {
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
      if (element && element["type"] == VarianceType.RELATIVE) {
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
    this.axisCategoryArea = {
      height: axisLabelGroup.height() as number,
      width: axisLabelGroup.width() as number,
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

      if (elements["scenario1"].isEmpty() == false) {
        hasValidPrim = true;
      }
    });

    let heightOffset = 0;
    if (hasValidPrim == false) {
      if (this.isOnSameAxisSide()) {
        heightOffset = this.position.dataLabelHeight;
      } else {
        heightOffset = this.position.dataLabelHeight * 2;
      }
    }

    this.scenariosArea = {
      height: (columnGroup.height() as number) + this.styles.padding.top + this.styles.padding.bottom + heightOffset,
      width: (columnGroup.width() as number) + this.position.spacings.columnWidth,
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
    // PL(4) → FC(3) → PP(2) → AC(1) — AC geometry on top of PP geometry
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
    this.scenariosArea = {
      height: Math.max((lineGroup.height() as number) + this.styles.padding.top, axisY) + this.styles.padding.bottom,
      width: (lineGroup.width() as number) + this.position.spacings.columnWidth,
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

        let hookLocation: HookLocation = HookLocation.Top;
        let offset = this.position.spacings.labelToAxis;
        if (elements["scenario1"]["value"] < 0) {
          hookLocation = HookLocation.Bottom;
          offset *= -1;
        }

        // Get the date label — use smart/short logic when full-width shows all labels
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

    this.axisCategoryArea = {
      height: axisLabelGroup.height() as number,
      width: axisLabelGroup.width() as number,
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
      if (elements["type"] == VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw();
      } else {
        scenarioFactory.createVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
    });

    this.scenariosArea = {
      height: (columnGroup.height() as number) + this.styles.padding.top + this.styles.padding.bottom,
      width: (columnGroup.width() as number) + this.position.spacings.columnWidth,
    };

    return columnGroup;
  }

  /**
   * Draw stacked bar columns. Supports stacking by scenario or by data dimension.
   * When stacking by scenario with multiple scenario types (e.g. ac+pl),
   * uses overlay mode: each type group is drawn from the same baseline,
   * back-to-front per IBCS convention (PL behind, AC on top).
   */
  private drawStackedScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const stackGroup: G = svgContainer.group().id("StackedScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIO;

    dataModel.forEach((elements: TimeChartDataModelEntry, index: number) => {
      const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];
      const segments: { value: number; scenario: string; dataPoint: DataPoint }[] = [];

      if (isScenarioStack) {
        for (const key of scenarioKeys) {
          const dp: DataPoint = elements[key];
          if (dp && !dp.isEmpty() && dp.value != null) {
            segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
          }
        }
      } else {
        const dp: DataPoint = elements["scenario1"];
        if (dp && !dp.isEmpty() && dp.value != null) {
          segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
        }
      }

      if (segments.length === 0) return;

      // Check if we have multiple scenario type groups for overlay mode
      const prefixes = isScenarioStack
        ? new Set(segments.map((s) => getScenarioPrefix(s.scenario)))
        : new Set<string>();

      if (prefixes.size > 1) {
        // Overlay mode: group by scenario prefix, draw each group from same baseline
        const groupMap = new Map<string, typeof segments>();
        for (const seg of segments) {
          const prefix = getScenarioPrefix(seg.scenario);
          if (!groupMap.has(prefix)) groupMap.set(prefix, []);
          groupMap.get(prefix)!.push(seg);
        }

        const groups: { prefix: string; segments: typeof segments }[] = [];
        for (const prefix of IBCS_LAYER_ORDER) {
          if (groupMap.has(prefix)) {
            groups.push({ prefix, segments: groupMap.get(prefix)! });
            groupMap.delete(prefix);
          }
        }
        for (const [prefix, segs] of groupMap) {
          groups.push({ prefix, segments: segs });
        }

        // Draw each group from baseline=0 (overlapping)
        groups.forEach((group, groupIdx) => {
          const groupTotal = group.segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
          const colorIndex = groups.length - 1 - groupIdx;
          let cumulativeValue = 0;
          let lastColumn: StackedColumn | null = null;

          group.segments.forEach((seg) => {
            const column = new StackedColumn(
              this.position,
              this.styles,
              seg.dataPoint,
              index,
              cumulativeValue,
              seg.scenario,
              colorIndex,
              this.stackConfig!.mode,
              groupTotal,
              true,
              stackGroup,
            );
            column.draw(this.dataFormatDigits, this.measureScale);
            cumulativeValue += Math.abs(seg.value);
            lastColumn = column;
          });

          if (lastColumn) {
            lastColumn.drawTotalLabel(this.dataFormatDigits, this.measureScale);
          }
        });
      } else {
        // Single group or non-scenario: additive stacking
        if (this.stackConfig!.order === "asc") {
          segments.sort((a, b) => a.value - b.value);
        } else if (this.stackConfig!.order === "desc") {
          segments.sort((a, b) => b.value - a.value);
        }

        const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
        let cumulativeValue = 0;
        let lastColumn: StackedColumn | null = null;

        segments.forEach((seg, segIdx) => {
          const column = new StackedColumn(
            this.position,
            this.styles,
            seg.dataPoint,
            index,
            cumulativeValue,
            seg.scenario,
            segIdx,
            this.stackConfig!.mode,
            total,
            isScenarioStack,
            stackGroup,
          );
          column.draw(this.dataFormatDigits, this.measureScale);
          cumulativeValue += Math.abs(seg.value);
          lastColumn = column;
        });

        if (lastColumn) {
          lastColumn.drawTotalLabel(this.dataFormatDigits, this.measureScale);
        }
      }
    });

    this.scenariosArea = {
      height: (stackGroup.height() as number) + this.styles.padding.top + this.styles.padding.bottom,
      width: (stackGroup.width() as number) + this.position.spacings.columnWidth,
    };
  }

  /**
   * Draw column headers next to stacked columns showing what each group/segment represents.
   * For overlay mode (multiple scenario types): shows one header per group.
   * For single-group: shows individual segment headers.
   */
  private drawStackedHeaders(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig || dataModel.length === 0) return;

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIO;
    if (!isScenarioStack) return;

    const headerGroup: G = svgContainer.group().id("StackedHeaders");
    const firstRow = dataModel[0];

    const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];
    const segments: { value: number; scenario: string; dataPoint: DataPoint }[] = [];

    for (const key of scenarioKeys) {
      const dp: DataPoint = firstRow[key];
      if (dp && !dp.isEmpty() && dp.value != null) {
        segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
      }
    }

    if (segments.length === 0) return;

    const prefixes = new Set(segments.map((s) => getScenarioPrefix(s.scenario)));
    const axisY = this.position.getColumnPositionY();
    const xBase = this.position.getColumnCenterPositionX(0) - this.position.getColumnWidth() / 2;
    const labelX = xBase - this.position.spacings.labelToColumn;

    if (prefixes.size > 1) {
      // Overlay mode: one header per group, centered vertically on group's column height
      const groupMap = new Map<string, typeof segments>();
      for (const seg of segments) {
        const prefix = getScenarioPrefix(seg.scenario);
        if (!groupMap.has(prefix)) groupMap.set(prefix, []);
        groupMap.get(prefix)!.push(seg);
      }

      const groups: { prefix: string; segments: typeof segments }[] = [];
      for (const prefix of IBCS_LAYER_ORDER) {
        if (groupMap.has(prefix)) {
          groups.push({ prefix, segments: groupMap.get(prefix)! });
          groupMap.delete(prefix);
        }
      }
      for (const [prefix, segs] of groupMap) {
        groups.push({ prefix, segments: segs });
      }

      groups.forEach((group) => {
        const groupTotal = group.segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
        const pixelPerUnit = group.segments[0].dataPoint.pixelPerUnit;
        const groupPixelHeight =
          this.stackConfig!.mode === StackMode.RELATIVE ? pixelPerUnit : groupTotal * pixelPerUnit;
        const centerY = axisY - groupPixelHeight / 2;
        const labelText = this.i18n.get(group.prefix + "1") || group.prefix.toUpperCase();

        new Label(
          headerGroup,
          labelX,
          centerY,
          "STACK_HEADER",
          labelText as string,
          this.styles,
          HookLocation.Center,
          HookLocation.Right,
        ).forceStringTypeDraw();
      });
    } else {
      // Single group: show individual segment headers
      if (this.stackConfig.order === "asc") segments.sort((a, b) => a.value - b.value);
      else if (this.stackConfig.order === "desc") segments.sort((a, b) => b.value - a.value);

      const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
      const pixelPerUnit = segments[0].dataPoint.pixelPerUnit;
      let cumulativePixels = 0;

      segments.forEach((seg) => {
        let segmentHeight: number;
        if (this.stackConfig!.mode === StackMode.RELATIVE) {
          const proportion = total !== 0 ? Math.abs(seg.value) / total : 0;
          segmentHeight = proportion * pixelPerUnit;
        } else {
          segmentHeight = Math.abs(seg.value * pixelPerUnit);
        }

        const centerY = axisY - cumulativePixels - segmentHeight / 2;
        const labelText = this.i18n.get(seg.scenario) || seg.scenario;

        new Label(
          headerGroup,
          labelX,
          centerY,
          "STACK_HEADER",
          labelText as string,
          this.styles,
          HookLocation.Center,
          HookLocation.Right,
        ).forceStringTypeDraw();

        cumulativePixels += segmentHeight;
      });
    }
  }

  /**
   * Draw stacked area chart (line mode with stack).
   * Computes cumulative y-values and draws AreaFill paths between layers.
   */
  private drawStackedAreaScenarios(dataModel: TimeChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const areaGroup: G = svgContainer.group().id("StackedAreaScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIO;
    const stackMode = this.stackConfig.mode;
    const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];

    // Determine how many layers we have
    const layerCount = isScenarioStack
      ? scenarioKeys.filter((key) => dataModel.some((el: TimeChartDataModelEntry) => el[key] && !el[key].isEmpty()))
          .length
      : 1;

    if (layerCount === 0) return;

    // Build cumulative values per layer
    // cumulativePoints[layerIdx][dataIdx] = cumulative y-value at that point
    const cumulativeValues: number[][] = [];
    const layerScenarios: string[] = [];

    // Identify active layers
    const activeLayers: string[] = [];
    for (const key of scenarioKeys) {
      if (dataModel.some((el: TimeChartDataModelEntry) => el[key] && !el[key].isEmpty())) {
        activeLayers.push(key);
      }
    }

    // Compute cumulative values
    for (let layerIdx = 0; layerIdx < activeLayers.length; layerIdx++) {
      const key = activeLayers[layerIdx];
      const values: number[] = [];

      for (let dataIdx = 0; dataIdx < dataModel.length; dataIdx++) {
        const dp: DataPoint = dataModel[dataIdx][key];
        const value = dp && !dp.isEmpty() && dp.value != null ? dp.value : 0;
        const prevCumulative = layerIdx > 0 ? cumulativeValues[layerIdx - 1][dataIdx] : 0;

        if (stackMode === StackMode.RELATIVE) {
          // For relative: need total at each x position
          const total = activeLayers.reduce((sum, k) => {
            const d: DataPoint = dataModel[dataIdx][k];
            return sum + (d && !d.isEmpty() && d.value != null ? Math.abs(d.value) : 0);
          }, 0);
          const proportion = total !== 0 ? Math.abs(value) / total : 0;
          values.push(prevCumulative + proportion);
        } else {
          values.push(prevCumulative + value);
        }
      }

      cumulativeValues.push(values);
      const firstDp: DataPoint = dataModel[0][key];
      layerScenarios.push((firstDp?.scenario as string) || "ac1");
    }

    // Convert cumulative values to pixel coordinates
    const axisY = this.position.getColumnPositionY();
    const pixelPerUnit = this.pixelPerUnit;

    const toAreaPoints = (values: number[]): AreaPoint[] => {
      return values.map((val, idx) => ({
        x: this.position.getColumnCenterPositionX(idx),
        y:
          axisY -
          (stackMode === StackMode.RELATIVE
            ? val * pixelPerUnit // pixelPerUnit acts as "height for 100%"
            : val * pixelPerUnit),
      }));
    };

    // Baseline (y = axis)
    const baselinePoints: AreaPoint[] = dataModel.map((_: TimeChartDataModelEntry, idx: number) => ({
      x: this.position.getColumnCenterPositionX(idx),
      y: axisY,
    }));

    // Draw area fills bottom-to-top
    for (let layerIdx = 0; layerIdx < cumulativeValues.length; layerIdx++) {
      const upperPoints = toAreaPoints(cumulativeValues[layerIdx]);
      const lowerPoints = layerIdx === 0 ? baselinePoints : toAreaPoints(cumulativeValues[layerIdx - 1]);

      const scenarioType = isScenarioStack ? layerScenarios[layerIdx] : null;

      const areaFill = new AreaFill(areaGroup, upperPoints, lowerPoints, scenarioType, layerIdx, isScenarioStack);
      areaFill.draw();
      areaFill.drawBoundaryLine();
    }

    this.scenariosArea = {
      height: (areaGroup.height() as number) + this.styles.padding.top + this.styles.padding.bottom,
      width: (areaGroup.width() as number) + this.position.spacings.columnWidth,
    };
  }

  private drawOverlayLayer(dataModel: TimeChartDataModelEntry[], svgContainer: Svg) {
    const overlayGroup: G = svgContainer.group().id("Overlay");

    const scenarioFactory = new ScenarioFactory(this.position, overlayGroup, this.styles, dataModel.length, this.i18n);

    if (this.showOverlayAvg == true) {
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
    const to: DateTime = DateTime.max(
      ...result.map(function (e: TimeChartResponseRow) {
        return e.calcdate;
      }),
    );

    const from: DateTime = DateTime.min(
      ...result.map(function (e: TimeChartResponseRow) {
        return e.calcdate;
      }),
    );

    const dateRange: DateTime[] = new DateStringFactory().datesBetween(from, to, dateInterval, this.intervalSpanLimit);

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
function tranformToAvgDataModel(dataModel: TimeChartDataModelEntry[]) {
  const total = dataModel.reduce((sum: number, elements: TimeChartDataModelEntry) => {
    return sum + (elements["scenario1"]?.value || 0); // Sum up the values of scenario1
  }, 0);

  const count = dataModel.filter(
    (elements: TimeChartDataModelEntry) => elements["scenario1"]?.value !== undefined,
  ).length; // Count valid scenario1 values

  const average = count > 0 ? total / count : 0; // Calculate the average, avoid division by zero

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

function tranformToMedianDataModel(dataModel: TimeChartDataModelEntry[]) {
  const values = dataModel
    .map((elements: TimeChartDataModelEntry) => elements["scenario1"]?.value)
    .filter((value: number | undefined) => value !== undefined)
    .sort((a: number, b: number) => a - b);

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
