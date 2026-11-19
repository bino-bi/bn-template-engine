import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, FactoryState, Padding, RowLayout, VarianceType } from "./helper";

import {
  DataPoint,
  ReferenceLine,
  Scenario,
  StackConfigParsed,
  SumRows,
  StructureChartComponentConfig,
  StructureChartStyle,
  OverflowConfig,
} from "./model";

// @ts-ignore
import { Axis, HookLocation, Label, StackedBar } from "./elements";
import { ScenarioFactory } from "./factories";

import CalculateSize from "calculate-size";
import { Formatter } from "../../../utils";
import { AggregationLevel, StackBy, StackMode } from "../../../utils/constants";
import { computePercentBarExtent, computeUnitBarExtent } from "../../../utils/autoFit";
import { getScenarioPrefix, IBCS_LAYER_ORDER } from "../../../utils/stackColors";
import { layoutStack, stackExtent, stackLabelSide, StackLayout } from "../../../utils/stackLayout";
import { IBCSRuleSet, styleSlot, stylesBySlot } from "../../../utils/ibcsRuleSet";
import { relativeVariance } from "../../../utils/relativeVariance";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";
import { DataFormatDigits } from "../../../utils/model/DataFormatDigits";
import { AlaSQLDatabase, sourceExpr } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { levelKey } from "../../../utils/layoutState/dataPoint";
import { SYSTEM_STYLE_DEFAULTS } from "../../../stores/componentStyles";

/** Internal data model entry: one category with up to 4 scenario DataPoints and optional stack segments. */
type StructureChartDataModelEntry = {
  id: number;
  category: string;
  type: VarianceType;
  scenario1: DataPoint;
  scenario2: DataPoint;
  scenario3: DataPoint;
  scenario4: DataPoint;
  stackSegments?: { label: string; value: number; dataPoint: DataPoint }[];
  /** A sum row: over the rows of one `rowGroup`, or over all rows. */
  sum?: "group" | "total";
  /** Half a row of room below this row: it closes a group. */
  gapAfter?: boolean;
};

/** The id of the row that sums the rows a limit cut off. */
const REST_ROW_ID = 9999;

/** One segment of a stack; `scenario` is the scenario or the value of the stack dimension. */
type StackGroupSegment = { value: number; scenario: string; dataPoint: DataPoint };

/**
 * One stack of a row with its layout; `prefix` names the scenario family of an overlay stack.
 * `hasValue` is false when no segment has a value: such a stack keeps its place and draws nothing.
 */
type StackGroup = { prefix: string; segments: StackGroupSegment[]; layout: StackLayout; hasValue: boolean };

/**
 * Orchestrates the full rendering pipeline for an IBCS structure (categorical) chart.
 *
 * Rendering pipeline (in draw()):
 * 1. Clears the SVG container
 * 2. Routes to the appropriate drawing method:
 *    - Variance chart: drawVarianceScenario() for absolute/relative variance bars
 *    - Stacked chart: drawStackedScenarios() + drawStackedHeaders()
 *    - Standard chart: drawScenarios() with primary/secondary bars and markers
 * 3. Draws vertical axis + category labels via drawAxisAndLabels()
 *
 * Data pipeline (in setConfig()):
 * 1. Raw data is filtered via AlaSQL
 * 2. Categories are aggregated (GROUP BY) with operation-sign-aware SUM
 * 3. Optional limit + REST row aggregation for top-N display
 * 4. Variance model is computed from base/delta scenario pairs
 * 5. Min/max DataPoints drive the coordinate system sizing
 *
 * Overflow handling: setAvailableWidth() can enable broken-bar rendering
 * when bars exceed the container width.
 */
export class StructureChart {
  private dataModel: StructureChartDataModelEntry[] = [];
  private variancesDataModel: StructureChartDataModelEntry[] = [];
  private position: ElementPositions;
  public styles: StructureChartStyle;
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
  /** The dimension a bar stands for: names the `data-bn-*` key of its value. */
  private level: AggregationLevel = AggregationLevel.CATEGORY;
  private hideCategories: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  readonly CSS_CATEGORIES: string = "categories";
  private state: FactoryState = FactoryState.DIRTY;
  private i18n: Map<string | number, string>;

  private titleLength: number = 0;
  private leftSideOffsetForHorizontalSync: number = 0;
  private limit: number = 0;

  private ruleSet: VisualisationRuleSet;

  private measureScale: SiPrefix = new SiPrefix();
  private measureUnit: string = "";
  private dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };
  private stackConfig: StackConfigParsed | null = null;
  private scenarioPropOrder: string[] = [];
  private overflowConfig: OverflowConfig | null = null;
  /** Largest positive and negative side of all stacks, in the units the stacks are laid out in. */
  private stackSides = stackExtent([]);
  /** Largest distance a category label keeps from the axis to clear the stack segments, per side. */
  private stackLabelClearance = { left: 0, right: 0 };
  private db: AlaSQLDatabase;
  private tableName: string;
  private fromExpr: string = "";
  private rowCount: number = 0;
  /** Text of the first query that failed since the source was set. The component reports it as ERR_sql. */
  private queryError: string | undefined;
  private sums: SumRows = "none";
  private sumTitle: string = "";
  private scenarioLabelTop: boolean = false;
  private hideScenarioName: boolean = false;
  private referenceLine: ReferenceLine | null = null;
  private italicCategories: string[] = [];

  constructor(
    ruleSet: VisualisationRuleSet,
    db: AlaSQLDatabase,
    tableName: string,
    config: StructureChartComponentConfig,
    styles: StructureChartStyle,
  ) {
    this.db = db;
    this.tableName = tableName;
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.i18n = this.createI18n(new Map());
    this.styles = styles;
    this.setConfig(config);
    this.position = this.createElementPosition();
  }

  private updatePosition() {
    this.position = this.createElementPosition();
  }

  private createElementPosition(): ElementPositions {
    this.titleLength = this.calculateTitleLength(0);
    let leftSideWidth = this.calculateLeftSideWidth(this.getVarianceType());
    const categoryWidth = this.calculateCategoryWidth();

    if (this.titleLength > leftSideWidth) {
      leftSideWidth = this.titleLength;
    }

    return new ElementPositions(
      new Padding(this.styles.padding),
      this.styles.scaleFactors,
      this.styles.fontStyles.size,
      this.dataModel.length,
      this.leftSideOffsetForHorizontalSync,
      this.titleLength,
      leftSideWidth,
      categoryWidth,
      (!!this.stackConfig && this.variancesDataModel.length === 0) || this.scenarioLabelTop,
      this.rowLayout(),
    );
  }

  public setStyles(newStyle: StructureChartStyle) {
    this.styles = newStyle;
  }

  public setRuleSet(ruleSet: VisualisationRuleSet) {
    this.ruleSet = ruleSet || new IBCSRuleSet();
  }

  setConfig(config: StructureChartComponentConfig) {
    this.state = FactoryState.DIRTY;

    this.scenarioPropOrder = [...config.scenarios];
    const scenarios = this.sortScenariosbyVisualisationRules(config.scenarios);
    this.hideCategories = config.hideCategories || false;
    this.limit = config.limit;
    this.pixelPerUnit = config.pixelPerUnit || 1;
    this.pixelPerPercentage = config.pixelPerPercentage || 100;
    this.setSource(config.filter);
    this.level = config.level;
    this.sums = config.sums;
    this.sumTitle = config.sumTitle;
    this.styles.valueSuffix = config.valueSuffix;
    this.scenarioLabelTop = config.scenarioLabelTop;
    this.hideScenarioName = config.hideScenarioName;
    this.referenceLine = config.referenceLine;
    this.italicCategories = config.italicCategories;
    this.dataModel = this.populateModel(scenarios, config.level, config.sortOrder);

    // Populate per-dimension stack segments when stacking by a data dimension
    if (config.stackConfig && config.stackConfig.by !== StackBy.SCENARIOS) {
      this.populateDimensionStackSegments(scenarios, config.stackConfig, config.level);
    }
    this.addSumRows(scenarios);

    for (const row of this.dataModel) {
      for (const dataPoint of [row.scenario1, row.scenario2, row.scenario3, row.scenario4]) {
        // a category without a value has no bar: nothing an annotation can point at
        if (dataPoint.value != null && !Number.isNaN(dataPoint.value)) {
          dataPoint.key = { ...levelKey(this.level, row.category), scenario: dataPoint.scenario ?? undefined };
        }
      }
    }

    this.variancesDataModel = this.populateVarianceModel(config.variances, this.dataModel);

    this.configTitle = config.title;
    this.configVariances = config?.variances ?? [];
    this.updateTitle();

    // a sum row has no bar: it does not count for the scale
    const bars = this.dataModel.filter((row) => !row.sum);
    this.smallestDataPointValue = this.findSmallestDataPointValue(bars);
    this.smallestVarianceDataPointValue = this.findSmallestDataPointValue(this.variancesDataModel);
    this.highestDataPointValue = this.findHighestDataPointValue(bars);
    this.highestVarianceDataPointValue = this.findHighestDataPointValue(this.variancesDataModel);
    this.axisScenario = this.setAxisScenario(config.variances);

    this.measureScale = config.measureScale;
    this.measureUnit = config.measureUnit;
    this.dataFormatDigits = config.dataFormatDigits;
    this.stackConfig = config.stackConfig;
    this.measureStacks();

    this.updatePosition();
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

  /**
   * Resolves the dataset (a table or view in the shared alasql database) and
   * caches its row count. All subsequent queries reference the source by name,
   * so alasql doesn't have to ingest a fresh array per call.
   */
  public setSource(filter: string) {
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

  /**
   * Total bar extent (data units) proportional to pixelPerUnit, covering
   * BOTH sides of the axis (left side scales with negative values, right
   * side with positive ones). Used by autoFitScaling to separate fixed
   * from variable width components.
   */
  public getUnitBarExtent(): number {
    const stacked = this.isStacked();
    const vt = this.getVarianceType();
    const isVariance = vt !== VarianceType.NONE;
    const highest = isVariance ? this.highestVarianceDataPointValue : this.highestDataPointValue;
    const smallest = isVariance ? this.smallestVarianceDataPointValue : this.smallestDataPointValue;

    return computeUnitBarExtent({
      // both sides of the axis; a relative stack is laid out on a span of 1, so its sides add up to 1 * ppu
      fixedDomain: stacked ? this.stackSides.positive + this.stackSides.negative : undefined,
      relativeVariance: vt === VarianceType.RELATIVE,
      // a reference line right of the longest bar needs its room too
      maxPositive: Math.max(highest?.value ?? 0, !stacked && !isVariance ? (this.referenceLine?.value ?? 0) : 0),
      minNegative: smallest?.value ?? 0,
    });
  }

  /**
   * Total bar extent (fraction units) proportional to pixelPerPercentage.
   * Only relative variances scale with it; each side clamps at +/-145%
   * because clipped needles render as fixed-size arrows.
   */
  public getPercentBarExtent(): number {
    return computePercentBarExtent({
      relativeVariance: this.getVarianceType() === VarianceType.RELATIVE,
      maxPositive: this.highestVarianceDataPointValue?.value ?? 0,
      minNegative: this.smallestVarianceDataPointValue?.value ?? 0,
    });
  }

  public getAllocatedCanvasWidth(): number {
    //let columnLabelWidth = this.calculateCategoryWidth();

    const leftSideWidth = this.position.getAxisPositionX(); //this.calculateLeftSideWidth(this.getVarianceType());
    const rightSideWidth = this.calculateRightSideWidth(this.getVarianceType());

    let width = leftSideWidth + rightSideWidth + +this.styles.padding.left + this.styles.padding.right;

    if (rightSideWidth < this.titleLength / 2) {
      width += this.titleLength / 2;
    }

    if (leftSideWidth < this.titleLength / 2) {
      width += this.titleLength / 2;
    }

    return width;
  }

  public getAllocatedCanvasHeight(): number {
    // Axis end plus the scenario label hanging below it (see getScenarioLabelPositionOffsetY)
    return (
      this.position.getAxisEndPositionY() +
      this.position.spacings.labelToAxis +
      this.position.fontSize +
      // the 100% mark stands below the axis end
      (this.hasPercentMark() ? this.position.fontSize * 0.8 : 0) +
      this.styles.padding.bottom
    );
  }

  public patternToString(): string {
    return "<svg></svg>";
  }

  /**
   * Runs `draw()` purely for its side effects - it is what finalizes the
   * positions that `getAllocatedCanvas*()` read.
   *
   * The auto-fit solver measures the chart once per iteration and only needs
   * those numbers, so it calls this instead of {@link toString}: the XML
   * serialization of a tree that is immediately discarded is pure overhead.
   */
  public layout(): void {
    this.draw(new Svg());
  }

  public toString(): string {
    const container = new Svg();
    this.draw(container);
    container.id("drawCanvas");
    container.width(this.getAllocatedCanvasWidth());
    container.height(this.getAllocatedCanvasHeight());
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
   * space and pushed labels past the `maxWidth` threshold in {@link Label} that
   * drops them entirely.
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

    if (this.variancesDataModel && this.variancesDataModel.length > 0) {
      this.drawVarianceScenario(this.variancesDataModel, svgContainer);
      this.drawAxisAndLabels(this.variancesDataModel, svgContainer);
    } else if (this.stackConfig != null) {
      this.drawStackedScenarios(this.dataModel, svgContainer);
      this.drawStackedHeaders(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer, true);
      this.drawPercentMark(svgContainer);
    } else {
      this.drawScenarios(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer);
    }
    if (this.variancesDataModel.length === 0) {
      this.drawReferenceLine(svgContainer);
    }
  }

  setPattern(fc: string, fcPolygonPattern: SVGPolgonPattern) {
    this.styles.pattern.set(fc, fcPolygonPattern);
  }

  private calculateTitleLength(minWidth: number): number {
    const tmpTitle = "_______"; // default width if this.title  is sorther

    const width = CalculateSize(this.title.length > tmpTitle.length ? this.title : tmpTitle, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
      fontWeight: this.styles.titleBold ? "bold" : "normal",
    }).width;

    if (width < minWidth) {
      return minWidth;
    }
    return width / 2;
  }

  public getFooter(): string {
    if (this.measureScale.value === 1 && this.measureUnit === "") {
      return " ";
    }
    return Formatter.translateScenarioLabel("in", this.i18n) + " " + this.measureScale.prefix + this.measureUnit;
  }

  /**
   * The styles with each scenario on the bar style slot its colorIndex selects.
   * `this.styles` stays the theme: the hatch pattern is built from its `fc` slot.
   */
  private scenarioStyles(): StructureChartStyle {
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

  private populateModel(
    selectedScenarios: string[],
    level: AggregationLevel,
    sortOrder: Order,
  ): StructureChartDataModelEntry[] {
    if (this.rowCount === 0 || !this.fromExpr) {
      return [];
    }

    const dataModel: StructureChartDataModelEntry[] = [];
    const orderStr = this.createOrderStr(level, sortOrder);
    const select = this.createSelectString(level, sortOrder);
    const groupByStr = this.createGroupByStr(level, sortOrder);
    let result: Record<string, unknown>[];
    try {
      result = this.db.exec<Record<string, unknown>[]>(
        `SELECT ${select} ${
          selectedScenarios.length > 0
            ? "," +
              selectedScenarios
                .map((scenario: string) => {
                  return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
                })
                .join(",")
            : ""
        }
                         FROM ${this.fromExpr}
                         GROUP BY ${groupByStr}
                         ORDER BY ${orderStr}`,
      );
    } catch (e) {
      this.failQuery(e);
      return [];
    }

    this.detectNaNCells(selectedScenarios, result);

    this.createDataRows(this.limit > 0 ? result.slice(0, this.limit) : result, dataModel, selectedScenarios);
    this.crateRESTRow(result, selectedScenarios, dataModel);

    return dataModel;
  }

  private detectNaNCells(scenarios: string[], res: Record<string, unknown>[]) {
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

  private crateRESTRow(
    result: Record<string, unknown>[],
    selectedScenarios: string[],
    dataModel: StructureChartDataModelEntry[],
  ) {
    if (this.limit <= 0 || this.limit >= result.length) {
      return;
    }

    const restDataModel: StructureChartDataModelEntry[] = [];
    this.createDataRows(result.slice(this.limit), restDataModel, selectedScenarios);

    // a cell without a value is NaN: it is left out, and a sum over no value stays NaN (no bar)
    const add = (sum: number, value: number): number =>
      Number.isFinite(value) ? (Number.isFinite(sum) ? sum : 0) + value : sum;

    const reducedRestRow = restDataModel.reduce(
      function (sum: StructureChartDataModelEntry, current: StructureChartDataModelEntry) {
        const obj = {
          id: sum.id,
          category: sum.category,
          type: sum.type,
          scenario1: new DataPoint(
            add(sum.scenario1.value, current.scenario1.value),
            selectedScenarios[0],
            sum.scenario1.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario2: new DataPoint(
            add(sum.scenario2.value, current.scenario2.value),
            selectedScenarios[1],
            sum.scenario2.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario3: new DataPoint(
            add(sum.scenario3.value, current.scenario3.value),
            selectedScenarios[2],
            sum.scenario3.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario4: new DataPoint(
            add(sum.scenario4.value, current.scenario4.value),
            selectedScenarios[3],
            sum.scenario4.pixelPerUnit,
            Scenario.NEU,
          ),
        };
        return obj;
      },
      {
        id: REST_ROW_ID,
        category: "REST",
        type: VarianceType.NONE,
        scenario1: new DataPoint(NaN, selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(NaN, selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(NaN, selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(NaN, selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
      },
    );

    dataModel.push(reducedRestRow);
  }

  private createDataRows(
    result: Record<string, unknown>[],
    dataModel: StructureChartDataModelEntry[],
    selectedScenarios: string[],
  ) {
    result.forEach((element: Record<string, unknown>, index: number) => {
      dataModel.push({
        id: index,
        category: element.category as string,
        type: VarianceType.NONE,
        scenario1: new DataPoint(
          element[selectedScenarios[0]] as number,
          selectedScenarios[0],
          this.pixelPerUnit,
          Scenario.NEU,
        ),
        scenario2: new DataPoint(
          element[selectedScenarios[1]] as number,
          selectedScenarios[1],
          this.pixelPerUnit,
          Scenario.NEU,
        ),
        scenario3: new DataPoint(
          element[selectedScenarios[2]] as number,
          selectedScenarios[2],
          this.pixelPerUnit,
          Scenario.NEU,
        ),
        scenario4: new DataPoint(
          element[selectedScenarios[3]] as number,
          selectedScenarios[3],
          this.pixelPerUnit,
          Scenario.NEU,
        ),
      });
    });
  }

  private createOrderStr(level: AggregationLevel, sortOrder: Order) {
    let orderStr = `${level.toLowerCase()}`;
    if (sortOrder.hierarchy.length >= 1) {
      orderStr = sortOrder.hierarchy.map((column) => `${column} ${sortOrder.direction}`).toString();
    }
    return orderStr;
  }

  private createSelectString(level: AggregationLevel, sortOrder: Order) {
    if (level === AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY} as category`;
    } else if (level === AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP} as category`;
    } else if (level === AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
      return `${OrderColumn.SUBCATEGORYINDEX}, ${AggregationLevel.SUBCATEGORY} as category`;
    } else {
      return `${level.toString()} as category`;
    }
  }

  private createGroupByStr(level: AggregationLevel, sortOrder: Order) {
    if (level === AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY}`;
    } else if (level === AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP}`;
    } else if (level === AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
      return `${OrderColumn.SUBCATEGORYINDEX}, ${AggregationLevel.SUBCATEGORY}`;
    } else {
      return `${level.toString()}`;
    }
  }

  private calculateCategoryWidth() {
    if (this.hideCategories) {
      return 5;
    }

    let longestLength: number = 0;

    for (const entry of this.dataModel) {
      const columnLength = CalculateSize(entry.category, {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      });

      if (columnLength.width > longestLength) {
        longestLength = columnLength.width;
      }
    }

    // MagicNumber used to compensate differnet fontwidth rendered vs calculated
    const magicNumber = 1.1125;

    return longestLength * magicNumber;
  }

  private findSmallestDataPointValue(dataModel: StructureChartDataModelEntry[]): DataPoint {
    let smallestDataPoint: DataPoint = new DataPoint(0, "default", this.pixelPerUnit, null);
    for (const entry of dataModel) {
      for (const current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null && smallestDataPoint.value != null) {
          if (current.value < smallestDataPoint.value) {
            smallestDataPoint = current;
          }
        }
      }
    }
    return smallestDataPoint;
  }

  private findHighestDataPointValue(dataModel: StructureChartDataModelEntry[]): DataPoint {
    let highestDataPoint: DataPoint = new DataPoint(0, "default", this.pixelPerUnit, null);
    for (const entry of dataModel) {
      for (const current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null && highestDataPoint.value != null) {
          if (current.value > highestDataPoint.value) {
            highestDataPoint = current;
          }
        }
      }
    }
    return highestDataPoint;
  }

  /**
   * The stacks of one row as they are drawn: one per scenario family when the row
   * mixes several (overlay, back to front per IBCS layer order), else a single one.
   */
  private stackGroups(row: StructureChartDataModelEntry): StackGroup[] {
    if (!this.stackConfig) return [];

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    let segments: StackGroupSegment[] = [];

    for (const key of isScenarioStack ? ["scenario1", "scenario2", "scenario3", "scenario4"] : ["scenario1"]) {
      const dp: DataPoint = row[key];
      if (dp && !dp.isEmpty() && dp.value != null) {
        segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
      }
    }

    if (segments.length === 0) return [];

    const relativeSpan = this.stackConfig.mode === StackMode.RELATIVE ? 1 : 0;
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
    } else if (row.stackSegments && row.stackSegments.length > 0) {
      // Dimension stacking: one segment per value of the stack dimension
      segments = row.stackSegments.map((seg: { label: string; value: number; dataPoint: DataPoint }) => ({
        value: seg.value,
        scenario: seg.label,
        dataPoint: seg.dataPoint,
      }));
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

  /** Extent of all stacks and the room their category labels need, taken from exactly what is drawn. */
  private measureStacks(): void {
    const layouts: StackLayout[] = [];
    this.stackLabelClearance = { left: 0, right: 0 };

    for (const row of this.dataModel) {
      const { flipped, clearance } = this.stackLabelPlace(row);
      const rowLayouts = this.drawnStackLayouts(row);
      const side = flipped ? "right" : "left";

      this.stackLabelClearance[side] = Math.max(this.stackLabelClearance[side], clearance);
      layouts.push(...rowLayouts);
    }

    this.stackSides = stackExtent(layouts);
  }

  /** Side of the axis and distance from it (in layout units) for the category label of a stacked row. */
  private stackLabelPlace(row: StructureChartDataModelEntry): { flipped: boolean; clearance: number } {
    const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;
    // a 100 % stack prints no total
    const totalLabelRoom = (layout: StackLayout): number =>
      this.stackConfig?.mode === StackMode.RELATIVE && this.stackConfig.labels !== "value"
        ? 0
        : (labelToBar + this.calculateTotalLabelWidth(layout.total)) / this.pixelPerUnit;

    return stackLabelSide(this.drawnStackLayouts(row), totalLabelRoom);
  }

  /** Layouts of the stacks of a row that are drawn, back to front. */
  private drawnStackLayouts(row: StructureChartDataModelEntry): StackLayout[] {
    if (this.isTextSum(row)) return [];
    return this.stackGroups(row)
      .filter((group) => group.hasValue)
      .map((group) => group.layout);
  }

  /** Width of a stack total as its label prints it: with the fixed decimals and the measure scale of the chart. */
  private calculateTotalLabelWidth(total: number): number {
    const digits = this.dataFormatDigits.decimal;
    return CalculateSize(
      Formatter.number(total, "decimal", digits, digits, this.measureScale.value, this.styles.locale),
      {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      },
    ).width;
  }

  /** True when the chart draws stacks that have a length. */
  private isStacked(): boolean {
    return this.stackConfig != null && this.stackSides.positive + this.stackSides.negative > 0;
  }

  private populateVarianceModel(
    variancesConfig: string[],
    dataModel: StructureChartDataModelEntry[],
  ): StructureChartDataModelEntry[] {
    const varianceModel: StructureChartDataModelEntry[] = [];

    if (variancesConfig.length === 0) {
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

        let pixelPerUnit: number = this.pixelPerUnit;
        if (scenarios.type === "dr") {
          pixelPerUnit = this.pixelPerPercentage;
        }

        for (const index in dataModel) {
          const point = new DataPoint(
            this.calculateVariance(scenarios, dataModel[index], scenariomap),
            scenarios.base,
            pixelPerUnit,
            directon,
          );
          if (point.value !== null && !Number.isNaN(point.value)) {
            point.key = {
              ...levelKey(this.level, dataModel[index].category),
              scenario: variancesConfig[varianceScenario],
            };
          }
          varianceModel.push({
            id: Number(index),
            category: dataModel[index].category,
            type: scenarios.type === "dr" ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            scenario1: point,
            scenario2: new DataPoint(null, null, null, null),
            scenario3: new DataPoint(null, null, null, null),
            scenario4: new DataPoint(null, null, null, null),
            sum: dataModel[index].sum,
          });
        }
      }
    }

    return varianceModel;
  }

  private calculateVariance(
    scenarios: VarianceScenario,
    element: StructureChartDataModelEntry,
    scenarioMap: Map<string, string>,
  ): number | null | undefined {
    const scenarioBase = scenarioMap.get(scenarios.base);
    const scenarioDelta = scenarioMap.get(scenarios.delta);

    if (scenarioBase == null || scenarioDelta == null) {
      return null;
    }

    const isRelativeVarianze = scenarios.type === VarianceType.RELATIVE;

    if (isRelativeVarianze) {
      // NaN marks a category without data and stays empty; undefined is a reference of 0 and is shown as "n/a"
      return relativeVariance(element[scenarioBase].value - element[scenarioDelta].value, element[scenarioDelta].value);
    } else {
      return element[scenarioBase].value - element[scenarioDelta].value;
    }
  }

  private mapScenarios(
    scenarios: VarianceScenario,
    firstRow: StructureChartDataModelEntry | null,
  ): Map<string, string> {
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

  private calculateTextBoxWidth(value: number): number {
    return CalculateSize(Formatter.number(value, "decimal", 1, 0, 1, this.styles.locale), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;
  }

  private calculatePercentageTextBoxWidth(value: number): number {
    let signWidth = 0;

    // like the label: no sign for a value that rounds to zero
    const digits = this.dataFormatDigits.percent;
    const percent = (v: number) => Formatter.number(v, "percent", digits, digits, 1, this.styles.locale);

    if (value > 0 && percent(value) !== percent(0)) {
      signWidth += CalculateSize("+", {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      }).width;
    }

    signWidth += CalculateSize(" %", {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;

    const labelWidth =
      CalculateSize(Formatter.number(value, "decimal", 1, 1, 1, this.styles.locale), {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      }).width + signWidth;

    return labelWidth + signWidth;
  }

  private cleanSVGforRedraw(svgContainer: Svg) {
    svgContainer.clear();
  }

  private drawAxisAndLabels(dataModel: StructureChartDataModelEntry[], svgContainer: Svg, stacked: boolean = false) {
    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLables");

    let isRelative = false;
    if (!this.hideCategories) {
      dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
        if (elements["type"] === VarianceType.RELATIVE) {
          isRelative = true;
        }

        let textHook = HookLocation.Right;
        let isPositive = true;
        let clearance = 0;
        if (stacked) {
          // opposite the stack total, behind the segments on that side
          const side = this.stackLabelPlace(elements);
          isPositive = !side.flipped;
          clearance = side.clearance * this.pixelPerUnit * (side.flipped ? 1 : -1);
        } else if (elements["scenario1"].value < 0 && !this.hasSumNumbers(this.dataModel[index])) {
          isPositive = false;
        }
        if (!isPositive) {
          textHook = HookLocation.Left;
        }
        new Label(
          axisLabelGroup,
          this.position.getCategoryPositionX(isPositive) + clearance,
          this.position.getBarCenterPositionY(index),
          "",
          // Category labels come from the data, but the synthetic "REST"
          // overflow bucket is engine-generated and translatable, as in bn-table.
          this.i18n.get(elements.category) || elements.category,
          this.styles,
          HookLocation.Center,
          textHook,
        )
          .setEmphasis(!!this.dataModel[index]?.sum, this.isItalic(elements.category))
          .draw();
      });
    }

    // a thin line above a sum row, from the labels to the end of the row
    dataModel.forEach((_elements, index) => {
      const row = this.dataModel[index];
      if (!row?.sum) return;
      const y = this.position.getBarCenterPositionY(index) - this.position.spacings.categoryWidth / 2;
      const left = this.hideCategories ? this.position.getAxisPositionX() : this.styles.padding.left;
      axisLabelGroup
        .line(left, y, this.position.getAxisPositionX() + this.sumRowExtent(row), y)
        .stroke({ color: "#000000", width: Math.max(0.5, this.position.spacings.axisLineWidth / 2) })
        .addClass("sum-line");
    });

    new Axis(
      {
        scenarioType: this.axisScenario,
        labelText: this.title,
        isRelative: isRelative,
      },
      this.position,
      axisLabelGroup,
      this.styles,
    ).draw();
  }

  private drawScenarios(dataModel: StructureChartDataModelEntry[], svgContainer: Svg) {
    const barsGroup: G = svgContainer.group().id("Scenarios");

    // the name of the scenario stands below the last bar, or above the first one
    let lastBar = -1;
    dataModel.forEach((row, index) => {
      if (!row.sum) lastBar = index;
    });
    const scenarioFactory = new ScenarioFactory(
      this.position,
      barsGroup,
      this.scenarioStyles(),
      // the factory names the last bar. The row layout leaves room for the name when a sum row follows.
      this.scenarioLabelTop ? 0 : lastBar + 1,
      this.i18n,
    );
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
      if (elements.sum) {
        this.drawSumValue(elements, index, barsGroup);
        return;
      }
      scenarioFactory.createPrimaryBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      scenarioFactory.createSecondaryBar(elements["scenario2"], index).draw();
      scenarioFactory.createPrimaryMarker(elements["scenario3"], index).draw();
      scenarioFactory.createSecondaryMarker(elements["scenario4"], index).draw();
    });

    const first = dataModel.find((row) => !row.sum);
    if (this.scenarioLabelTop && first && !first.scenario1.isEmpty() && first.scenario1.scenario != null) {
      const scenario = first.scenario1.scenario as string;
      new Label(
        barsGroup,
        // from the axis on: the first bar can be shorter than the name
        this.position.getBarPositionX() + this.position.spacings.labelToAxis,
        this.position.getStackedHeaderPositionY(),
        "SCENARIO_HEADER",
        this.i18n.get(scenario) || scenario,
        this.styles,
        HookLocation.Bottom,
        HookLocation.Left,
      ).draw();
    }
  }

  /** The scenarios of a sum row of a chart with plain bars that have a value, in the order of the `scenarios` prop. */
  private sumPoints(row: StructureChartDataModelEntry): DataPoint[] {
    const points = [row.scenario1, row.scenario2, row.scenario3, row.scenario4].filter(
      (point) => point != null && !point.isEmpty() && Number.isFinite(point.value),
    );
    const order = this.scenarioPropOrder;
    const place = (point: DataPoint): number => {
      const index = order.indexOf(point.scenario as string);
      return index === -1 ? order.length : index;
    };
    return points.sort((a, b) => place(a) - place(b));
  }

  /** A sum row of the base chart that prints several numbers right of the axis: its title stays left of it. */
  private hasSumNumbers(row: StructureChartDataModelEntry | undefined): boolean {
    return !!row?.sum && this.variancesDataModel.length === 0 && !this.stackConfig && this.sumPoints(row).length > 1;
  }

  /** How wide the numbers of a sum row of a chart with plain bars are, from the axis on. */
  private sumValuesWidth(row: StructureChartDataModelEntry): number {
    const font = this.styles.fontStyles.size;
    const labelToBar = font * this.styles.scaleFactors.labelToBar;
    const points = this.sumPoints(row);
    if (points.length === 0) return 0;
    const numbers = points.map((point) => this.boldWidth(this.sumText(point.value as number)));
    if (points.length === 1) return labelToBar + numbers[0];
    return labelToBar + numbers.reduce((sum, width) => sum + font * 0.9 + width, 0) + (points.length - 1) * font * 1.4;
  }

  /**
   * The sum row of a chart with plain bars: bold numbers at the axis, no bar. One
   * scenario is a plain number. Several get a small square each, in the look of the scenario.
   */
  private drawSumValue(row: StructureChartDataModelEntry, index: number, group: G): void {
    const points = this.sumPoints(row);
    if (points.length === 0) return;
    const font = this.styles.fontStyles.size;
    const y = this.position.getBarCenterPositionY(index);
    const sumGroup = group.group().id(`sum_${index}`);
    const number = (point: DataPoint, x: number, hook: HookLocation): void => {
      new Label(sumGroup, x, y, `SUM_${point.scenario}`, point.value as number, this.styles, HookLocation.Center, hook)
        .setEmphasis(true, false)
        .setPoint(point.key)
        .draw(this.dataFormatDigits, this.measureScale);
    };

    if (points.length === 1) {
      // like the label of a bar without length: a negative number stands left of the axis
      const negative = (points[0].value as number) < 0;
      number(
        points[0],
        this.position.getLabelPositionX(negative ? -0.000001 : 0),
        negative ? HookLocation.Right : HookLocation.Left,
      );
      return;
    }

    const key = font * 0.6;
    const barStyles = this.scenarioStyles().barStyles;
    let x = this.position.getLabelPositionX(0);
    for (const point of points) {
      const style = barStyles.getSVGStyle(point.getScenario());
      sumGroup
        .rect(key, key)
        .fill({ color: style?.fill || "#000000" })
        .stroke({ color: style?.stroke || "#000000", width: 1 })
        .cy(y)
        .x(x);
      number(point, x + key + font * 0.3, HookLocation.Left);
      x += font * 0.9 + this.boldWidth(this.sumText(point.value as number)) + font * 1.4;
    }
  }

  private drawVarianceScenario(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): G {
    const barsGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(
      this.position,
      barsGroup,
      this.scenarioStyles(),
      dataModel.length,
      this.i18n,
    );
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
      // the variance of a sum row is a bar like the others, with a bold number
      if (elements["type"] === VarianceType.RELATIVE) {
        const needle = scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index);
        if (elements.sum) needle.emphasize();
        needle.draw(this.dataFormatDigits);
      } else {
        const bar = scenarioFactory.createVarianceBar(elements["scenario1"], index);
        if (elements.sum) bar.emphasize();
        bar.draw(this.dataFormatDigits, this.measureScale);
      }
    });

    return barsGroup;
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
   * Draw stacked horizontal bars. Supports stacking by scenario or by data dimension.
   * When stacking by scenario with multiple scenario types (e.g. ac+pl),
   * uses overlay mode: each type group is drawn from the same baseline,
   * back-to-front per IBCS convention (PL behind, AC on top).
   * Positive segments stack right of the axis, negative segments left of it.
   */
  private drawStackedScenarios(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const stackGroup: G = svgContainer.group().id("StackedScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;

    const relative = this.stackConfig.mode === StackMode.RELATIVE;
    const valueLabels = relative && this.stackConfig.labels === "value";
    const label = valueLabels ? "value" : this.stackConfig.percentMark ? "plain-share" : "share";

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
      const groups = this.stackGroups(elements);

      if (this.isTextSum(elements)) {
        this.drawSumText(elements, index, stackGroup);
        return;
      }
      const options = {
        label,
        total: valueLabels,
        bold: !!elements.sum,
        italic: this.isItalic(elements.category),
      } as const;

      groups.forEach((group, groupIdx) => {
        let lastBar: StackedBar | null = null;

        group.segments.forEach((seg, segIdx) => {
          const bar = new StackedBar(
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
            options,
          );
          bar.draw(this.dataFormatDigits, this.measureScale);
          lastBar = bar;
        });

        if (lastBar && group.hasValue) {
          // an overlay has one total per scenario family: the family tells them apart
          (lastBar as StackedBar).drawTotalLabel(this.dataFormatDigits, this.measureScale, {
            ...levelKey(this.level, elements.category),
            scenario: groups.length > 1 ? group.prefix : undefined,
          });
        }
      });
    });
  }

  /**
   * Draw column headers above stacked bars showing what each segment/group represents.
   * For overlay mode (multiple scenario types): shows one header per group.
   * For single-group stacking: shows individual segment headers.
   * The headers take their place from the first row.
   */
  private drawStackedHeaders(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig || dataModel.length === 0) return;

    const firstRow = dataModel.find((row) => !this.isTextSum(row)) ?? dataModel[0];

    // Dimension stacking without segments draws one plain bar: nothing to name
    if (this.stackConfig.by !== StackBy.SCENARIOS && (!firstRow.stackSegments || firstRow.stackSegments.length === 0)) {
      return;
    }

    const groups = this.stackGroups(firstRow);
    if (groups.length === 0) return;

    const headerGroup: G = svgContainer.group().id("StackedHeaders");
    const axisX = this.position.getBarPositionX();
    const headerY = this.position.getStackedHeaderPositionY();

    const drawHeader = (centerX: number, labelText: string): void => {
      new Label(
        headerGroup,
        centerX,
        headerY,
        "STACK_HEADER",
        labelText,
        this.styles,
        HookLocation.Bottom,
        HookLocation.Center,
      ).draw();
    };

    if (groups.length > 1) {
      // Overlay mode: one header per group, centered on group's bar extent
      groups.forEach((group) => {
        const pixelPerUnit = group.segments[0].dataPoint.pixelPerUnit;
        const centerX = axisX + ((group.layout.positive - group.layout.negative) / 2) * pixelPerUnit;

        drawHeader(centerX, this.i18n.get(group.prefix + "1") || group.prefix.toUpperCase());
      });
      return;
    }

    // Single group: one header per segment, centered on the segment
    const [group] = groups;
    const totalDrawn = this.stackConfig.mode !== StackMode.RELATIVE || this.stackConfig.labels === "value";
    if (this.stackConfig.totalTitle && totalDrawn) {
      // above the total of the first bar, which starts behind the bar
      new Label(
        headerGroup,
        this.position.getLabelPositionX(group.layout.positive * this.pixelPerUnit),
        headerY,
        "STACK_TOTAL_HEADER",
        this.stackConfig.totalTitle,
        this.styles,
        HookLocation.Bottom,
        HookLocation.Left,
      ).draw();
    }
    group.segments.forEach((seg, segIdx) => {
      const { start, end } = group.layout.segments[segIdx];

      drawHeader(axisX + ((start + end) / 2) * seg.dataPoint.pixelPerUnit, this.i18n.get(seg.scenario) || seg.scenario);
    });
  }

  private getVarianceType() {
    if (this.variancesDataModel.length > 0) {
      return this.variancesDataModel[0].type;
    }
    return VarianceType.NONE;
  }

  private calculateLeftSideWidth(varianceType: VarianceType): number {
    let width = 0;
    const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;

    if (VarianceType.NONE === varianceType && this.isStacked()) {
      // the negative side with the label of a negative total behind it
      if (this.stackSides.negative > 0) {
        width = this.stackSides.negative * this.pixelPerUnit;
        if (this.stackSides.minTotal < 0) {
          width += labelToBar + this.calculateTotalLabelWidth(this.stackSides.minTotal);
        }
      }
      // a category label that sits behind negative segments
      if (this.stackLabelClearance.left > 0) {
        width = Math.max(width, this.stackLabelClearance.left * this.pixelPerUnit + this.calculateCategoryWidth());
      }
    } else if (
      VarianceType.NONE === varianceType &&
      this.smallestDataPointValue?.value != null &&
      this.smallestDataPointValue.value < 0
    ) {
      const sizeLabelValue = this.calculateTextBoxWidth(this.smallestDataPointValue.value);
      width = Math.abs(this.smallestDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    } else if (
      VarianceType.RELATIVE === varianceType &&
      this.smallestVarianceDataPointValue?.value != null &&
      this.smallestVarianceDataPointValue.value < 0
    ) {
      const sizeLabelValue = this.calculatePercentageTextBoxWidth(this.smallestVarianceDataPointValue.value);
      width = Math.abs(this.smallestVarianceDataPointValue.getScaledPercentUnit()) + labelToBar + sizeLabelValue;
    } else if (
      VarianceType.ABSOLUTE === varianceType &&
      this.smallestVarianceDataPointValue?.value != null &&
      this.smallestVarianceDataPointValue.value < 0
    ) {
      const sizeLabelValue = this.calculateTextBoxWidth(this.smallestVarianceDataPointValue.value);
      width = Math.abs(this.smallestVarianceDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    }

    if (width <= this.titleLength) {
      return this.titleLength;
    }

    return width;
  }

  private calculateRightSideWidth(varianceType: VarianceType): number {
    // Stacked charts: width based on the positive side of the stacks, not individual max
    if (this.isStacked()) {
      const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;
      const sizeTotalLabel = this.calculateTextBoxWidth(this.stackSides.maxTotal);
      let width = this.stackSides.positive * this.pixelPerUnit + labelToBar + sizeTotalLabel;

      // the category label of a row with a negative total sits right of the axis, behind its positive segments
      if (this.stackSides.minTotal < 0) {
        width = Math.max(
          width,
          this.stackLabelClearance.right * this.pixelPerUnit +
            this.position.getCategoryToAxisSpaceing() +
            this.calculateCategoryWidth(),
        );
      }

      if (this.stackConfig?.totalTitle) {
        const title = CalculateSize(this.stackConfig.totalTitle, {
          font: this.styles.fontStyles.font,
          fontSize: this.styles.fontStyles.size + "px",
        }).width;
        width = Math.max(width, this.stackSides.positive * this.pixelPerUnit + labelToBar + title);
      }

      return Math.max(width, this.titleLength, this.sumColumns()?.width ?? 0, this.referenceLineExtent());
    }

    let width = 0;
    const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;

    if (
      VarianceType.NONE === varianceType &&
      this.highestDataPointValue?.value != null &&
      this.highestDataPointValue.value >= 0
    ) {
      const sizeLabelValue = this.calculateTextBoxWidth(this.highestDataPointValue.value);
      width = Math.abs(this.highestDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    } else if (
      VarianceType.RELATIVE === varianceType &&
      this.highestVarianceDataPointValue?.value != null &&
      this.highestVarianceDataPointValue.value >= 0
    ) {
      const sizeLabelValue = this.calculatePercentageTextBoxWidth(this.highestVarianceDataPointValue.value);
      width = Math.abs(this.highestVarianceDataPointValue.getScaledPercentUnit()) + labelToBar + sizeLabelValue;
    } else if (
      VarianceType.ABSOLUTE === varianceType &&
      this.highestVarianceDataPointValue?.value != null &&
      this.highestVarianceDataPointValue.value >= 0
    ) {
      const sizeLabelValue = this.calculateTextBoxWidth(this.highestVarianceDataPointValue.value);
      width = Math.abs(this.highestVarianceDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    }

    width = Math.max(width, this.referenceLineExtent());

    // the bold number of a sum row stands at the axis
    for (const row of this.dataModel) {
      if (row.sum && VarianceType.NONE === varianceType) {
        width = Math.max(width, this.sumRowExtent(row));
      }
    }

    if (width <= this.titleLength) {
      return this.titleLength;
    }

    return width;
  }

  /**
   * For dimension stacking (by category, subcategory, or rowgroup), query the raw data
   * at the stack dimension level and attach stackSegments to each dataModel row.
   */
  private populateDimensionStackSegments(
    scenarios: string[],
    _stackConfig: StackConfigParsed,
    level: AggregationLevel,
  ): void {
    if (this.rowCount === 0 || !this.fromExpr || scenarios.length === 0) return;

    // Derive stack column from level: stack by the next-lower hierarchy dimension
    const nextLowerDimension: Record<string, string> = {
      [AggregationLevel.ROWGROUP]: "category",
      [AggregationLevel.ROWGROUPINDEX]: "category",
      [AggregationLevel.CATEGORY]: "subCategory",
      [AggregationLevel.CATEGORYINDEX]: "subCategory",
    };
    const stackColumn = nextLowerDimension[level];
    if (!stackColumn) return; // subCategory has no lower dimension

    // The display level column (what each bar represents)
    const displayColumn = level.toString(); // e.g. 'rowGroup', 'category', 'subCategory'
    const scenario = scenarios[0]; // dimension stacking uses first scenario

    let result: Record<string, unknown>[];
    try {
      result = this.db.exec<Record<string, unknown>[]>(
        `SELECT [${displayColumn}] as displayGroup, [${stackColumn}] as stackLabel, ` +
          `MIN([${stackColumn}Index]) as stackIndex, ` +
          `SUM([${scenario}] * transformOperator(operation)) as stackValue ` +
          `FROM ${this.fromExpr} GROUP BY [${displayColumn}], [${stackColumn}]`,
      );
    } catch (e) {
      this.failQuery(e);
      return;
    }

    // The series of the chart: by the index column of the stack dimension, else in the order of the rows
    const series = new Map<string, number>();
    for (const row of result) {
      if (row.stackValue == null || row.stackLabel == null) continue;
      const label = row.stackLabel as string;
      const index = Number.isFinite(Number(row.stackIndex)) && row.stackIndex != null ? Number(row.stackIndex) : NaN;
      const known = series.get(label);
      if (known === undefined || (Number.isNaN(known) && !Number.isNaN(index)) || index < known) {
        series.set(label, index);
      }
    }
    const order = [...series.keys()];
    if ([...series.values()].every((index) => !Number.isNaN(index))) {
      order.sort((a, b) => series.get(a)! - series.get(b)!);
    }

    // Group results by displayGroup
    const groupMap = new Map<string, Map<string, number>>();
    for (const row of result) {
      const key = row.displayGroup as string;
      if (!groupMap.has(key)) groupMap.set(key, new Map());
      if (row.stackValue != null && row.stackLabel != null) {
        groupMap.get(key)!.set(row.stackLabel as string, row.stackValue as number);
      }
    }

    // the REST row stands for the rows the limit cut off: it gets their sum per series
    const shown = new Set(this.dataModel.map((row) => row.category));
    const rest = new Map<string, number>();
    for (const [category, values] of groupMap) {
      if (shown.has(category)) continue;
      for (const [label, value] of values) {
        rest.set(label, (rest.get(label) ?? 0) + value);
      }
    }

    // Attach stackSegments to each dataModel row: every row has every series, so place and colour stay
    for (const row of this.dataModel) {
      const values = row.id === REST_ROW_ID && !groupMap.has(row.category) ? rest : groupMap.get(row.category);
      const segments =
        values && values.size > 0 ? order.map((label) => ({ label, value: values.get(label) ?? NaN })) : undefined;
      if (segments && segments.length > 0) {
        row.stackSegments = segments.map((seg: { label: string; value: number }) => {
          const dataPoint = new DataPoint(seg.value, scenario, this.pixelPerUnit, Scenario.NEU);
          dataPoint.key = { ...levelKey(this.level, row.category), [stackColumn]: seg.label, scenario };
          return { label: seg.label, value: seg.value, dataPoint };
        });
      } else {
        row.stackSegments = [];
      }
    }
  }

  /** A sum row that is printed as numbers: every stack but a 100 % stack, where it is a bar of shares. */
  private isTextSum(row: StructureChartDataModelEntry): boolean {
    return !!row.sum && !!this.stackConfig && this.stackConfig.mode !== StackMode.RELATIVE;
  }

  private isItalic(category: string): boolean {
    return this.italicCategories.includes(category);
  }

  private hasPercentMark(): boolean {
    return (
      !!this.stackConfig?.percentMark &&
      this.stackConfig.mode === StackMode.RELATIVE &&
      this.variancesDataModel.length === 0 &&
      this.isStacked()
    );
  }

  /**
   * Adds the sum rows: one below the rows of each `rowGroup`, which keeps the rows of a
   * group together, and one over all rows at the end.
   */
  private addSumRows(scenarios: string[]): void {
    if (this.sums === "none" || this.dataModel.length === 0) return;

    // a cell without a value is left out, and a sum over no value stays NaN
    const add = (sum: number, value: number | null | undefined): number =>
      Number.isFinite(value) ? (Number.isFinite(sum) ? sum : 0) + (value as number) : sum;

    const sumRow = (
      members: StructureChartDataModelEntry[],
      category: string,
      sum: "group" | "total",
    ): StructureChartDataModelEntry => {
      const point = (key: "scenario1" | "scenario2" | "scenario3" | "scenario4", index: number): DataPoint =>
        new DataPoint(
          scenarios[index] === undefined
            ? (undefined as unknown as number)
            : members.reduce((total, row) => add(total, row[key].value), NaN),
          scenarios[index],
          this.pixelPerUnit,
          Scenario.NEU,
        );
      const row: StructureChartDataModelEntry = {
        id: 10000 + this.dataModel.length,
        category,
        type: VarianceType.NONE,
        scenario1: point("scenario1", 0),
        scenario2: point("scenario2", 1),
        scenario3: point("scenario3", 2),
        scenario4: point("scenario4", 3),
        sum,
      };
      if (members.some((member) => member.stackSegments)) {
        const values = new Map<string, number>();
        for (const member of members) {
          for (const segment of member.stackSegments ?? []) {
            values.set(segment.label, add(values.get(segment.label) ?? NaN, segment.value));
          }
        }
        row.stackSegments = [...values].map(([label, value]) => {
          const dataPoint = new DataPoint(value, scenarios[0], this.pixelPerUnit, Scenario.NEU);
          return { label, value, dataPoint };
        });
      }
      return row;
    };

    const rows = this.dataModel;
    const result: StructureChartDataModelEntry[] = [];
    const groups = this.sums === "total" ? new Map<string, { name: string; index: number }>() : this.rowGroups();

    if (groups.size > 0) {
      const names = [...new Set([...groups.values()].sort((a, b) => a.index - b.index).map((group) => group.name))];
      for (const name of names) {
        const members = rows.filter((row) => groups.get(row.category)?.name === name);
        if (members.length === 0) continue;
        const sum = sumRow(members, name, "group");
        sum.gapAfter = true;
        result.push(...members, sum);
      }
      // a row without a group, like REST, comes last
      result.push(...rows.filter((row) => !groups.has(row.category)));
    } else {
      result.push(...rows);
    }

    if (this.sums === "total" || this.sums === "all") {
      result.push(sumRow(rows, this.sumTitle || "SUM_TOTAL", "total"));
    }
    this.dataModel = result;
  }

  /** The `rowGroup` of each row of a chart at level `category`, with the place of the group. */
  private rowGroups(): Map<string, { name: string; index: number }> {
    const groups = new Map<string, { name: string; index: number }>();
    if (this.level !== AggregationLevel.CATEGORY && this.level !== AggregationLevel.CATEGORYINDEX) return groups;
    let result: Record<string, unknown>[];
    try {
      result = this.db.exec<Record<string, unknown>[]>(
        `SELECT [category] as category, [rowGroup] as rowGroup, MIN([rowGroupIndex]) as rowGroupIndex ` +
          `FROM ${this.fromExpr} GROUP BY [category], [rowGroup]`,
      );
    } catch (e) {
      this.failQuery(e);
      return groups;
    }
    const first = new Map<string, number>();
    result.forEach((row, position) => {
      if (row.rowGroup == null || row.rowGroup === "") return;
      const name = String(row.rowGroup);
      const given = Number(row.rowGroupIndex);
      // without an index column the groups keep the order of the rows
      const index = row.rowGroupIndex != null && Number.isFinite(given) ? given : (first.get(name) ?? position);
      if (!first.has(name)) first.set(name, index);
      groups.set(String(row.category), { name, index: Math.min(index, first.get(name)!) });
    });
    return groups;
  }

  /** Rows of different height (`stack.thickness: total`) and the room below a group. Null: all rows are equal. */
  private rowLayout(): RowLayout | null {
    const rows = this.dataModel;
    // the component does not set it together with variances: a variance bar has one thickness
    const byTotal = this.stackConfig?.thickness === "total";
    // the name of the scenario stands below the last bar: it needs room when a sum row follows
    const lastBar = rows.reduce((last, row, index) => (row.sum ? last : index), -1);
    const nameBelow =
      !this.stackConfig &&
      !this.scenarioLabelTop &&
      !this.hideScenarioName &&
      lastBar >= 0 &&
      lastBar < rows.length - 1;
    if (!byTotal && !nameBelow && !rows.some((row) => row.gapAfter)) return null;

    const totals = rows.map((row) => {
      if (!byTotal || row.sum) return null;
      const groups = this.stackGroups(row);
      const front = groups[groups.length - 1];
      return front ? Math.abs(front.layout.total) : 0;
    });
    const weights = this.rowWeights(totals);

    const start: number[] = [];
    const weight: number[] = [];
    let at = 0;
    rows.forEach((row, index) => {
      const rowWeight = weights[index];
      start.push(at);
      weight.push(rowWeight);
      at += rowWeight + (row.gapAfter && index < rows.length - 1 ? 0.5 : 0) + (nameBelow && index === lastBar ? 1 : 0);
    });
    return { start, weight, total: at, nameBelowBar: nameBelow };
  }

  /**
   * The height of each row in units of a normal row: by its total, with the same height
   * over all. A row is at least one line of text high, and the others give up that room.
   * Null stands for a row that keeps the normal height.
   */
  private rowWeights(totals: (number | null)[]): number[] {
    const minimum = Math.min(1, 1 / this.styles.scaleFactors.categoryWidth);
    const weights: number[] = totals.map((total) => (total === null ? 1 : 0));
    const open = new Set(totals.flatMap((total, index) => (total === null ? [] : [index])));
    let room = open.size;

    // a row below the minimum is set to it, then the rest is shared again
    for (;;) {
      const sum = [...open].reduce((all, index) => all + (totals[index] as number), 0);
      if (sum <= 0) {
        open.forEach((index) => (weights[index] = room / open.size));
        break;
      }
      const small = [...open].filter((index) => ((totals[index] as number) / sum) * room < minimum);
      if (small.length === 0 || small.length === open.size) {
        open.forEach((index) => (weights[index] = ((totals[index] as number) / sum) * room));
        break;
      }
      for (const index of small) {
        weights[index] = minimum;
        room -= minimum;
        open.delete(index);
      }
    }
    return weights;
  }

  private boldWidth(text: string): number {
    return CalculateSize(text, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
      fontWeight: "bold",
    }).width;
  }

  private sumText(value: number): string {
    const digits = this.dataFormatDigits.decimal;
    return Formatter.number(value, "decimal", digits, digits, this.measureScale.value, this.styles.locale);
  }

  /**
   * Where the numbers of the text sum rows stand, as distance from the axis: one column
   * per series, the same for all sum rows, then the total. Null without such a row.
   */
  private sumColumns(): { x: number[]; totalX: number; width: number; key: number; keyGap: number } | null {
    const rows = this.dataModel.filter((row) => this.isTextSum(row));
    if (rows.length === 0) return null;
    const font = this.styles.fontStyles.size;
    const key = font * 0.6;
    const keyGap = font * 0.3;
    const columnGap = font * 1.4;

    const widths: number[] = [];
    let totalWidth = 0;
    for (const row of rows) {
      const groups = this.stackGroups(row);
      const front = groups[groups.length - 1];
      if (!front) continue;
      front.segments.forEach((segment, index) => {
        const width = Number.isFinite(segment.value) ? this.boldWidth(this.sumText(segment.value)) : 0;
        widths[index] = Math.max(widths[index] ?? 0, width);
      });
      totalWidth = Math.max(totalWidth, this.boldWidth(this.sumText(front.layout.total)));
    }

    const x: number[] = [];
    let at = font * 0.3;
    // one series: its sum is the total
    for (const width of widths.length > 1 ? widths : []) {
      x.push(at);
      at += key + keyGap + width + columnGap;
    }
    return { x, totalX: at, width: at + totalWidth, key, keyGap };
  }

  /** A sum row of a stack as numbers: per series a small square in its colour and the sum, then the total. */
  private drawSumText(row: StructureChartDataModelEntry, index: number, group: G): void {
    const columns = this.sumColumns();
    const groups = this.stackGroups(row);
    const front = groups[groups.length - 1];
    if (!columns || !front) return;

    const axisX = this.position.getBarPositionX();
    const y = this.position.getBarCenterPositionY(index);
    const colors = this.styles.stackColors;
    const sumGroup = group.group().id(`stacked_sum_${index}`);

    front.segments.forEach((segment, segmentIndex) => {
      if (!Number.isFinite(segment.value) || columns.x[segmentIndex] === undefined) return;
      const x = axisX + columns.x[segmentIndex];
      sumGroup
        .rect(columns.key, columns.key)
        .fill({ color: colors[segmentIndex % colors.length] })
        .cy(y)
        .x(x);
      new Label(
        sumGroup,
        x + columns.key + columns.keyGap,
        y,
        `SUM_SEG_${segmentIndex}`,
        segment.value,
        this.styles,
        HookLocation.Center,
        HookLocation.Left,
      )
        .setEmphasis(true, false)
        .setPoint(segment.dataPoint.key)
        .draw(this.dataFormatDigits, this.measureScale);
    });

    new Label(
      sumGroup,
      axisX + columns.totalX,
      y,
      "SUM_TOTAL",
      front.layout.total,
      this.styles,
      HookLocation.Center,
      HookLocation.Left,
    )
      .setEmphasis(true, false)
      .setPoint(levelKey(this.level, row.category), "total")
      .draw(this.dataFormatDigits, this.measureScale);
  }

  /** How far a sum row reaches right of the axis, in px. */
  private sumRowExtent(row: StructureChartDataModelEntry): number {
    const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;
    if (this.variancesDataModel.length > 0) return 0;
    if (this.isTextSum(row)) return this.sumColumns()?.width ?? 0;
    if (this.stackConfig) {
      const total =
        this.stackConfig.labels === "value" ? labelToBar + this.boldWidth(this.sumText(row.scenario1.value ?? 0)) : 0;
      return this.stackSides.positive * this.pixelPerUnit + total;
    }
    return this.sumValuesWidth(row);
  }

  /** Where the reference line stands, as distance from the axis in px. Null without a line in this chart. */
  private referenceLineOffset(): number | null {
    const line = this.referenceLine;
    if (!line || !Number.isFinite(line.value) || this.variancesDataModel.length > 0) return null;
    const relative = this.stackConfig?.mode === StackMode.RELATIVE;
    return (relative ? line.value / 100 : line.value) * this.pixelPerUnit;
  }

  /** The room right of the axis that the reference line and its label need. */
  private referenceLineExtent(): number {
    const offset = this.referenceLineOffset();
    if (offset === null || offset <= 0) return 0;
    const label = this.referenceLine?.label
      ? CalculateSize(this.referenceLine.label, {
          font: this.styles.fontStyles.font,
          fontSize: this.styles.fontStyles.size + "px",
        }).width
      : 0;
    return offset + Math.max(label / 2, this.styles.fontStyles.size * 0.25);
  }

  /** The end of a 100 % stack: a line along the bar ends and one `100%` below it. */
  private drawPercentMark(svgContainer: Svg): void {
    if (!this.hasPercentMark()) return;
    const group = svgContainer.group().id("PercentMark");
    const font = this.styles.fontStyles.size;
    const x = this.position.getBarPositionX() + this.stackSides.positive * this.pixelPerUnit;
    const top = this.position.getAxisPositionY();
    const bottom = this.position.getAxisEndPositionY();
    const tip = bottom + font * 0.15;
    const base = tip + font * 0.75;

    group.line(x, top, x, bottom).stroke({ color: "#000000", width: this.position.spacings.axisLineWidth });
    group.polygon(`${x},${tip} ${x - font * 0.28},${base} ${x + font * 0.28},${base}`).fill("#000000");
    new Label(group, x, base + font * 0.1, "PERCENT_MARK", "100%", this.styles, HookLocation.Top, HookLocation.Center)
      .setEmphasis(true, false)
      .draw();
  }

  /** A line across the bars at one value, with its label above the first bar. In a 100 % stack the value is a percent. */
  private drawReferenceLine(svgContainer: Svg): void {
    const line = this.referenceLine;
    const offset = this.referenceLineOffset();
    if (!line || offset === null || this.dataModel.length === 0) return;
    const group = svgContainer.group().id("ReferenceLine");
    const font = this.styles.fontStyles.size;
    const color = `var(--bn-annotation-color, ${SYSTEM_STYLE_DEFAULTS["bn-annotation"].color})`;
    const x = this.position.getBarPositionX() + offset;
    const top =
      this.position.getStackedHeaderPositionY() - (this.stackConfig || this.scenarioLabelTop ? font * 1.1 : 0);
    // down to the last row from the top that reaches the line, or over all rows when the first one does not
    const reaches = (row: StructureChartDataModelEntry): boolean => {
      if (row.sum) return false;
      if (!this.stackConfig) return (row.scenario1.value ?? 0) >= line.value;
      const first = this.stackGroups(row)[0]?.layout.segments[0];
      return first != null && first.end * this.pixelPerUnit >= x - this.position.getBarPositionX();
    };
    let lastBar = this.dataModel.findIndex((row) => !reaches(row)) - 1;
    if (lastBar < 0) lastBar = this.dataModel.reduce((last, row, index) => (row.sum ? last : index), 0);
    const bottom = this.position.getBarCenterPositionY(lastBar) + this.position.getBarWidthAt(lastBar) / 2;

    group
      .line(x, top, x, bottom)
      .attr("style", `stroke: ${color}; stroke-width: ${Math.max(1, this.position.spacings.axisLineWidth)}px`);
    group
      .polygon(`${x},${top + font * 0.5} ${x - font * 0.25},${top} ${x + font * 0.25},${top}`)
      .attr("style", `fill: ${color}`);
    if (line.label) {
      group
        .plain(line.label)
        .attr({ x, y: top - font * 0.3, "text-anchor": "middle" })
        .attr("style", `fill: ${color}`);
    }
  }

  hasNoData() {
    return this.dataModel.length === 0;
  }

  public setAvailableWidth(availableWidth: number): void {
    if (this.pixelPerUnit <= 0 || availableWidth <= 0) {
      this.overflowConfig = null;
      return;
    }
    if (this.stackConfig != null) {
      this.overflowConfig = null;
      return;
    }

    this.overflowConfig = this.calculateOverflowConfig(availableWidth);
    if (this.overflowConfig) {
      const { cutWidth, overdriveZoneWidth, breakGap } = this.overflowConfig;
      const virtualWidth = cutWidth + overdriveZoneWidth + breakGap;

      const isVariance = this.variancesDataModel && this.variancesDataModel.length > 0;

      if (isVariance) {
        if (this.highestVarianceDataPointValue.getScaledUnit() > cutWidth) {
          this.highestVarianceDataPointValue = new DataPoint(
            virtualWidth,
            this.highestVarianceDataPointValue.scenario,
            1,
            this.highestVarianceDataPointValue.variance,
          );
        }
        if (
          this.smallestVarianceDataPointValue.value != null &&
          Math.abs(this.smallestVarianceDataPointValue.getScaledUnit()) > cutWidth
        ) {
          this.smallestVarianceDataPointValue = new DataPoint(
            -virtualWidth,
            this.smallestVarianceDataPointValue.scenario,
            1,
            this.smallestVarianceDataPointValue.variance,
          );
        }
      } else {
        if (this.highestDataPointValue.getScaledUnit() > cutWidth) {
          this.highestDataPointValue = new DataPoint(
            virtualWidth,
            this.highestDataPointValue.scenario,
            1,
            this.highestDataPointValue.variance,
          );
        }
        if (
          this.smallestDataPointValue.value != null &&
          Math.abs(this.smallestDataPointValue.getScaledUnit()) > cutWidth
        ) {
          this.smallestDataPointValue = new DataPoint(
            -virtualWidth,
            this.smallestDataPointValue.scenario,
            1,
            this.smallestDataPointValue.variance,
          );
        }
      }

      this.updatePosition();
    }
  }

  private calculateOverflowConfig(availableWidth: number): OverflowConfig | null {
    const isVariance = this.variancesDataModel && this.variancesDataModel.length > 0;
    const varianceType = this.getVarianceType();

    // Don't apply to relative variance (Needle handles its own clipping at 145%)
    if (varianceType === VarianceType.RELATIVE) return null;

    const highest = isVariance ? this.highestVarianceDataPointValue : this.highestDataPointValue;
    const smallest = isVariance ? this.smallestVarianceDataPointValue : this.smallestDataPointValue;
    const highestScaledUnit = highest.getScaledUnit();
    const smallestAbsScaledUnit = smallest.value != null ? Math.abs(smallest.getScaledUnit()) : 0;
    const maxAbsScaledUnit = Math.max(highestScaledUnit, smallestAbsScaledUnit);

    if (maxAbsScaledUnit <= 0) return null;

    const fontSize = this.styles.fontStyles.size;
    const labelToBar = fontSize * this.styles.scaleFactors.labelToBar;

    // Available space on the right side of the axis
    const axisX = this.position.getAxisPositionX();
    // Match getAllocatedCanvasWidth() which adds padding.left + padding.right on top of axisX
    const rightSideAvailable = availableWidth - axisX - this.styles.padding.left - this.styles.padding.right;

    // Estimate the label width of the largest value
    const maxLabelWidth = this.calculateTextBoxWidth(highest.value || 0);

    const overdriveZoneWidth = fontSize * 1.5;
    const breakGap = fontSize * 0.3;
    const scenarioCutOffset = fontSize * 0.8;

    const cutWidth = rightSideAvailable - labelToBar - maxLabelWidth - overdriveZoneWidth - breakGap;

    if (cutWidth <= scenarioCutOffset) return null;

    const lowestCutWidth = cutWidth - scenarioCutOffset;
    if (maxAbsScaledUnit <= lowestCutWidth) return null;

    const maxOverflow = maxAbsScaledUnit - lowestCutWidth;

    return { cutWidth, overdriveZoneWidth, breakGap, maxOverflow, scenarioCutOffset };
  }
}
