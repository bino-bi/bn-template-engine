import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, FactoryState, Padding, VarianceType } from "./helper";

import {
  DataPoint,
  Scenario,
  StackConfigParsed,
  StructureChartComponentConfig,
  StructureChartDataRow,
  StructureChartStyle,
  OverflowConfig,
} from "./model";

// @ts-ignore
import { Axis, HookLocation, Label, StackedBar } from "./elements";
import { ScenarioFactory } from "./factories";
import alasql from "alasql";

import CalculateSize from "calculate-size";
import { Formatter } from "../../../utils";
import { AggregationLevel, StackBy, StackMode } from "../../../utils/constants";
import { getScenarioPrefix, IBCS_LAYER_ORDER } from "../../../utils/stackColors";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";
import { DataFormatDigits } from "../../../utils/model/DataFormatDigits";

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
};

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
  private smallestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private smallestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);

  private pixelPerUnit: number = 1;
  private pixelPerPercentage: number = 1;
  private hideCategories: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  readonly CSS_CATEGORIES: string = "categories";
  private preparedDataSet: StructureChartDataRow[] = [];
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
  private overflowConfig: OverflowConfig | null = null;
  private highestStackedTotal: number = 0;

  constructor(ruleSet: VisualisationRuleSet, config: StructureChartComponentConfig, styles: StructureChartStyle) {
    this.initSQLFunctions();
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
    );
  }

  initSQLFunctions() {
    alasql.fn.transformOperator = function (a) {
      return a === "-" ? -1 : 1;
    };
  }

  public setStyles(newStyle: StructureChartStyle) {
    this.styles = newStyle;
  }

  setConfig(config: StructureChartComponentConfig) {
    this.state = FactoryState.DIRTY;

    this.sortScenariosbyVisualisationRules(config);
    this.hideCategories = config.hideCategories || false;
    this.limit = config.limit;
    this.pixelPerUnit = config.pixelPerUnit || 1;
    this.pixelPerPercentage = config.pixelPerPercentage || 100;
    this.setData([...config.data], config.filter);
    this.dataModel = this.populateModel(config.scenarios, config.level, config.sortOrder);

    // Populate per-dimension stack segments when stacking by a data dimension
    if (config.stackConfig && config.stackConfig.by !== StackBy.SCENARIOS) {
      this.populateDimensionStackSegments(config.scenarios, config.stackConfig, config.level);
    }

    this.variancesDataModel = this.populateVarianceModel(config.variances, this.dataModel);

    this.title = config.title || Formatter.translateScenarioLabel(config?.variances?.toString(), this.i18n);

    this.smallestDataPointValue = this.findSmallestDataPointValue(this.dataModel);
    this.smallestVarianceDataPointValue = this.findSmallestDataPointValue(this.variancesDataModel);
    this.highestDataPointValue = this.findHighestDataPointValue(this.dataModel);
    this.highestVarianceDataPointValue = this.findHighestDataPointValue(this.variancesDataModel);
    this.axisScenario = this.setAxisScenario(config.variances);

    this.measureScale = config.measureScale;
    this.measureUnit = config.measureUnit;
    this.dataFormatDigits = config.dataFormatDigits;
    this.stackConfig = config.stackConfig;
    this.highestStackedTotal = this.findHighestStackedRowTotal(this.dataModel);

    this.updatePosition();
  }

  private sortScenariosbyVisualisationRules(config: StructureChartComponentConfig) {
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

  /**
   * Init load raw datasets the loaded dataset is
   * the base on which the filters defined in the config
   * are apllied on internaly it is called prepared DataSet
   *
   * @param data
   * @param filter - data filter
   * @param customColumnNameMap Custon ColumnNameMap can be used if data uses non standard columnames
   */
  public setData(data: StructureChartDataRow[], filter: string) {
    if (data == null) {
      return;
    }

    this.state = FactoryState.DIRTY; // mark dataSet for update
    this.preparedDataSet.length = 0; // cleans formerly loaded and prepared  dataset

    if (filter != null && filter.length > 0) {
      try {
        this.preparedDataSet = alasql(`SELECT * FROM ? WHERE ${filter}`, [data]);
      } catch (e) {
        console.error("StructureChart: filter query failed, using unfiltered data", filter, e);
        this.preparedDataSet = data;
      }
    } else {
      this.preparedDataSet = data;
    }
  }

  /**
   * Returns the data value whose bar extent is proportional to pixelPerUnit.
   * Used by autoFitScaling to separate fixed vs variable width components.
   */
  public getMaxBarValue(): number {
    // Stacked: bar extent = highestStackedTotal * ppu (or just ppu for relative)
    if (this.stackConfig != null && this.highestStackedTotal > 0) {
      if (this.stackConfig.mode === StackMode.RELATIVE) {
        return 1;
      }
      return this.highestStackedTotal;
    }

    // Non-stacked: bar extent = highestDataPointValue * ppu
    const vt = this.getVarianceType();
    if (vt === VarianceType.NONE && this.highestDataPointValue?.value != null) {
      return Math.abs(this.highestDataPointValue.value);
    }
    if (vt === VarianceType.ABSOLUTE && this.highestVarianceDataPointValue?.value != null) {
      return Math.abs(this.highestVarianceDataPointValue.value);
    }

    // RELATIVE variance depends on pixelPerPercentage, not pixelPerUnit
    return 0;
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
    return (
      (this.dataModel.length + 1) * this.position.spacings.categoryWidth +
      this.styles.padding.top +
      this.styles.padding.bottom
    );
  }

  public patternToString(): string {
    return "<svg></svg>";
  }

  public toString(): string {
    const container = new Svg();
    this.draw(container);
    container.id("drawCanvas");
    container.width(this.getAllocatedCanvasWidth());
    container.height(this.getAllocatedCanvasHeight());
    return container.svg();
  }

  public draw(svgContainer: Svg): void {
    this.cleanSVGforRedraw(svgContainer);

    if (this.state === FactoryState.DIRTY) {
      this.state = FactoryState.UP_TO_DATE;
    }

    if (this.variancesDataModel && this.variancesDataModel.length > 0) {
      this.drawVarianceScenario(this.variancesDataModel, svgContainer);
      this.drawAxisAndLabels(this.variancesDataModel, svgContainer);
    } else if (this.stackConfig != null) {
      this.drawStackedScenarios(this.dataModel, svgContainer);
      this.drawStackedHeaders(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer);
    } else {
      this.drawScenarios(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer);
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
    level: AggregationLevel,
    sortOrder: Order,
  ): StructureChartDataModelEntry[] {
    if (this.preparedDataSet?.length === 0) {
      return [];
    }

    const dataModel: StructureChartDataModelEntry[] = [];
    const orderStr = this.createOrderStr(level, sortOrder);
    const select = this.createSelectString(level, sortOrder);
    const groupByStr = this.createGroupByStr(level, sortOrder);
    const result = alasql<Record<string, unknown>[]>(
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
                         FROM ?
                         GROUP BY ${groupByStr}
                         ORDER BY ${orderStr}`,
      [this.preparedDataSet],
    );

    this.detectNaNCells(selectedScenarios, result);

    this.createDataRows(result, dataModel, selectedScenarios);
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
    if (this.limit === 0 || this.limit > result.length) {
      return;
    }

    const restDataModel: StructureChartDataModelEntry[] = [];
    const restResult = result.slice(this.limit, result.length);
    this.createDataRows(restResult, restDataModel, selectedScenarios);

    const reducedRestRow = restDataModel.reduce(
      function (sum: StructureChartDataModelEntry, current: StructureChartDataModelEntry) {
        const obj = {
          id: sum.id,
          category: sum.category,
          type: sum.type,
          scenario1: new DataPoint(
            sum.scenario1.value + current.scenario1.value,
            selectedScenarios[0],
            sum.scenario1.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario2: new DataPoint(
            sum.scenario2.value + current.scenario2.value,
            selectedScenarios[1],
            sum.scenario2.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario3: new DataPoint(
            sum.scenario3.value + current.scenario3.value,
            selectedScenarios[2],
            sum.scenario3.pixelPerUnit,
            Scenario.NEU,
          ),
          scenario4: new DataPoint(
            sum.scenario4.value + current.scenario4.value,
            selectedScenarios[3],
            sum.scenario4.pixelPerUnit,
            Scenario.NEU,
          ),
        };
        return obj;
      },
      {
        id: 9999,
        category: "REST",
        type: VarianceType.NONE,
        scenario1: new DataPoint(0, selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(0, selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(0, selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(0, selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
      },
    );

    dataModel.push(reducedRestRow);
  }

  private createDataRows(
    result: Record<string, unknown>[],
    dataModel: StructureChartDataModelEntry[],
    selectedScenarios: string[],
  ) {
    let primaryResult = result;

    if (this.limit > 0) {
      primaryResult = result.slice(0, this.limit);
    }

    primaryResult.forEach((element: Record<string, unknown>, index: number) => {
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
      orderStr = `${sortOrder.hierarchy.toString()} ${sortOrder?.direction}`;
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

  private findHighestStackedRowTotal(dataModel: StructureChartDataModelEntry[]): number {
    if (!this.stackConfig || dataModel.length === 0) return 0;

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;
    let maxTotal = 0;

    for (const row of dataModel) {
      let rowTotal = 0;

      if (isScenarioStack) {
        const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"] as const;
        const segments: { value: number; scenario: string }[] = [];

        for (const key of scenarioKeys) {
          const dp: DataPoint = row[key];
          if (dp && !dp.isEmpty() && dp.value != null) {
            segments.push({ value: dp.value, scenario: dp.scenario as string });
          }
        }

        const prefixes = new Set(segments.map((s) => getScenarioPrefix(s.scenario)));

        if (prefixes.size > 1) {
          // Overlay: groups overlap from baseline, width = max group total
          const groupMap = new Map<string, number>();
          for (const seg of segments) {
            const prefix = getScenarioPrefix(seg.scenario);
            groupMap.set(prefix, (groupMap.get(prefix) || 0) + Math.abs(seg.value));
          }
          rowTotal = Math.max(...groupMap.values());
        } else {
          // Single group: segments stack end-to-end, width = sum
          rowTotal = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
        }
      } else {
        // Dimension stacking: use stackSegments
        if (row.stackSegments && row.stackSegments.length > 0) {
          rowTotal = row.stackSegments.reduce((sum, s) => sum + Math.abs(s.value), 0);
        }
      }

      if (rowTotal > maxTotal) maxTotal = rowTotal;
    }

    return maxTotal;
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
          varianceModel.push({
            id: Number(index),
            category: dataModel[index].category,
            type: scenarios.type === "dr" ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            scenario1: new DataPoint(
              this.calculateVariance(scenarios, dataModel[index], scenariomap),
              scenarios.base,
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
    element: StructureChartDataModelEntry,
    scenarioMap: Map<string, string>,
  ): number | null {
    const scenarioBase = scenarioMap.get(scenarios.base);
    const scenarioDelta = scenarioMap.get(scenarios.delta);

    if (scenarioBase == null || scenarioDelta == null) {
      return null;
    }

    const isRelativeVarianze = scenarios.type === VarianceType.RELATIVE;

    if (isRelativeVarianze) {
      return (element[scenarioBase].value - element[scenarioDelta].value) / element[scenarioDelta].value;
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
    return CalculateSize(Formatter.number(value, "decimal", 1, 0), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px",
    }).width;
  }

  private calculatePercentageTextBoxWidth(value: number): number {
    let signWidth = 0;

    if (value >= 0) {
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
      CalculateSize(Formatter.number(value, "decimal", 1, 1), {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px",
      }).width + signWidth;

    return labelWidth + signWidth;
  }

  private cleanSVGforRedraw(svgContainer: Svg) {
    svgContainer.clear();
  }

  private drawAxisAndLabels(dataModel: StructureChartDataModelEntry[], svgContainer: Svg) {
    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLables");

    let isRelative = false;
    if (!this.hideCategories) {
      dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
        if (elements["type"] === VarianceType.RELATIVE) {
          isRelative = true;
        }

        let textHook = HookLocation.Right;
        let isPositive = true;
        if (elements["scenario1"].value < 0) {
          textHook = HookLocation.Left;
          isPositive = false;
        }
        new Label(
          axisLabelGroup,
          this.position.getCategoryPositionX(isPositive),
          this.position.getBarCenterPositionY(index),
          "",
          elements.category,
          this.styles,
          HookLocation.Center,
          textHook,
        ).draw();
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
      this.styles,
    ).draw();
  }

  private drawScenarios(dataModel: StructureChartDataModelEntry[], svgContainer: Svg) {
    const barsGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(this.position, barsGroup, this.styles, dataModel.length, this.i18n);
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
      scenarioFactory.createPrimaryBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      scenarioFactory.createSecondaryBar(elements["scenario2"], index).draw();
      scenarioFactory.createPrimaryMarker(elements["scenario3"], index).draw();
      scenarioFactory.createSecondaryMarker(elements["scenario4"], index).draw();
    });
  }

  private drawVarianceScenario(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): G {
    const barsGroup: G = svgContainer.group().id("Scenarios");

    const scenarioFactory = new ScenarioFactory(this.position, barsGroup, this.styles, dataModel.length, this.i18n);
    scenarioFactory.setOverflowConfig(this.overflowConfig);

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
      if (elements["type"] === VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw();
      } else {
        scenarioFactory.createVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
    });

    return barsGroup;
  }

  /**
   * Draw stacked horizontal bars. Supports stacking by scenario or by data dimension.
   * When stacking by scenario with multiple scenario types (e.g. ac+pl),
   * uses overlay mode: each type group is drawn from the same baseline,
   * back-to-front per IBCS convention (PL behind, AC on top).
   */
  private drawStackedScenarios(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const stackGroup: G = svgContainer.group().id("StackedScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;

    dataModel.forEach((elements: StructureChartDataModelEntry, index: number) => {
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

        // Sort groups by IBCS layer order (back-to-front: pl, fc, pp, ac)
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
          const colorIndex = groups.length - 1 - groupIdx; // back=lighter, front=darker
          let cumulativeValue = 0;
          let lastBar: StackedBar | null = null;

          group.segments.forEach((seg) => {
            const bar = new StackedBar(
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
            bar.draw(this.dataFormatDigits, this.measureScale);
            cumulativeValue += Math.abs(seg.value);
            lastBar = bar;
          });

          if (lastBar) {
            lastBar.drawTotalLabel(this.dataFormatDigits, this.measureScale);
          }
        });
      } else {
        // Single group, scenario or dimension stacking
        // For dimension stacking, use stackSegments if available
        let finalSegments = segments;
        if (!isScenarioStack && elements.stackSegments && elements.stackSegments.length > 0) {
          finalSegments = elements.stackSegments.map((seg: { label: string; value: number; dataPoint: DataPoint }) => ({
            value: seg.value,
            scenario: seg.label,
            dataPoint: seg.dataPoint,
          }));
        }

        if (this.stackConfig!.order === "asc") {
          finalSegments.sort((a, b) => a.value - b.value);
        } else if (this.stackConfig!.order === "desc") {
          finalSegments.sort((a, b) => b.value - a.value);
        }

        const total = finalSegments.reduce((sum, s) => sum + Math.abs(s.value), 0);
        let cumulativeValue = 0;
        let lastBar: StackedBar | null = null;

        finalSegments.forEach((seg, segIdx) => {
          const bar = new StackedBar(
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
          bar.draw(this.dataFormatDigits, this.measureScale);
          cumulativeValue += Math.abs(seg.value);
          lastBar = bar;
        });

        if (lastBar) {
          lastBar.drawTotalLabel(this.dataFormatDigits, this.measureScale);
        }
      }
    });
  }

  /**
   * Draw column headers above stacked bars showing what each segment/group represents.
   * For overlay mode (multiple scenario types): shows one header per group.
   * For single-group scenario stacking: shows individual segment headers.
   */
  private drawStackedHeaders(dataModel: StructureChartDataModelEntry[], svgContainer: Svg): void {
    if (!this.stackConfig || dataModel.length === 0) return;

    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIOS;

    const headerGroup: G = svgContainer.group().id("StackedHeaders");
    const firstRow = dataModel[0];

    // Dimension stacking: use stackSegments from first row for headers
    if (!isScenarioStack) {
      const stackSegs = firstRow.stackSegments;
      if (!stackSegs || stackSegs.length === 0) return;

      const orderedSegs = [...stackSegs];
      if (this.stackConfig.order === "asc")
        orderedSegs.sort((a: { value: number }, b: { value: number }) => a.value - b.value);
      else if (this.stackConfig.order === "desc")
        orderedSegs.sort((a: { value: number }, b: { value: number }) => b.value - a.value);

      const total = orderedSegs.reduce((sum: number, s: { value: number }) => sum + Math.abs(s.value), 0);
      const axisX = this.position.getBarPositionX();
      const headerY = this.position.getAxisTitlePositionY();
      let cumulativePixels = 0;

      orderedSegs.forEach((seg: { label: string; value: number; dataPoint: DataPoint }) => {
        const pixelPerUnit = seg.dataPoint.pixelPerUnit;
        let segmentLength: number;
        if (this.stackConfig!.mode === StackMode.RELATIVE) {
          const proportion = total !== 0 ? Math.abs(seg.value) / total : 0;
          segmentLength = proportion * pixelPerUnit;
        } else {
          segmentLength = Math.abs(seg.value * pixelPerUnit);
        }

        const centerX = axisX + cumulativePixels + segmentLength / 2;
        const labelText = this.i18n.get(seg.label) || seg.label;

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

        cumulativePixels += segmentLength;
      });

      return;
    }

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
    const axisX = this.position.getBarPositionX();
    const headerY = this.position.getAxisTitlePositionY();

    if (prefixes.size > 1) {
      // Overlay mode: one header per group, centered on group's bar extent
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
        const groupPixelLength =
          this.stackConfig!.mode === StackMode.RELATIVE ? pixelPerUnit : groupTotal * pixelPerUnit;
        const centerX = axisX + groupPixelLength / 2;
        const labelText = this.i18n.get(group.prefix + "1") || group.prefix.toUpperCase();

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
      });
    } else {
      // Single group: show individual segment headers
      if (this.stackConfig.order === "asc") segments.sort((a, b) => a.value - b.value);
      else if (this.stackConfig.order === "desc") segments.sort((a, b) => b.value - a.value);

      const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);
      let cumulativePixels = 0;

      segments.forEach((seg) => {
        const pixelPerUnit = seg.dataPoint.pixelPerUnit;
        let segmentLength: number;

        if (this.stackConfig!.mode === StackMode.RELATIVE) {
          const proportion = total !== 0 ? Math.abs(seg.value) / total : 0;
          segmentLength = proportion * pixelPerUnit;
        } else {
          segmentLength = Math.abs(seg.value * pixelPerUnit);
        }

        const centerX = axisX + cumulativePixels + segmentLength / 2;
        const labelText = this.i18n.get(seg.scenario) || seg.scenario;

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

        cumulativePixels += segmentLength;
      });
    }
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

    if (
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
    // Stacked charts: width based on max row total, not individual max
    if (this.stackConfig != null && this.highestStackedTotal > 0) {
      const labelToBar = this.styles.fontStyles.size * this.styles.scaleFactors.labelToBar;
      let barExtent: number;

      if (this.stackConfig.mode === StackMode.RELATIVE) {
        barExtent = this.pixelPerUnit;
      } else {
        barExtent = this.highestStackedTotal * this.pixelPerUnit;
      }

      const sizeTotalLabel = this.calculateTextBoxWidth(this.highestStackedTotal);
      const width = barExtent + labelToBar + sizeTotalLabel;

      return Math.max(width, this.titleLength);
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
    if (this.preparedDataSet?.length === 0 || scenarios.length === 0) return;

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

    const result = alasql<Record<string, unknown>[]>(
      `SELECT [${displayColumn}] as displayGroup, [${stackColumn}] as stackLabel, ` +
        `SUM([${scenario}] * transformOperator(operation)) as stackValue ` +
        `FROM ? GROUP BY [${displayColumn}], [${stackColumn}]`,
      [this.preparedDataSet],
    );

    // Group results by displayGroup
    const groupMap = new Map<string, { label: string; value: number }[]>();
    for (const row of result) {
      const key = row.displayGroup as string;
      if (!groupMap.has(key)) groupMap.set(key, []);
      if (row.stackValue != null && row.stackLabel != null) {
        groupMap.get(key)!.push({ label: row.stackLabel as string, value: row.stackValue as number });
      }
    }

    // Attach stackSegments to each dataModel row
    for (const row of this.dataModel) {
      const segments = groupMap.get(row.category);
      if (segments && segments.length > 0) {
        row.stackSegments = segments.map((seg: { label: string; value: number }) => ({
          label: seg.label,
          value: seg.value,
          dataPoint: new DataPoint(seg.value, scenario, this.pixelPerUnit, Scenario.NEU),
        }));
      } else {
        row.stackSegments = [];
      }
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
