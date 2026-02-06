import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, FactoryState, Padding, VarianceType, } from "./helper";

import { DataPoint, Scenario, StructureChartComponentConfig, StructureChartDataRow, StructureChartStyle } from "./model";

// @ts-ignore
import { Axis, Categories, HookLocation, Label } from "./elements";
import { ScenarioFactory, } from "./factories";
// import { Formatter } from "../../../utils";
import alasql from "alasql";

import CalculateSize from 'calculate-size';
import { Formatter } from "../../../utils";
import { AggregationLevel } from "../../../utils/constants";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";
import { DataFormatDigits } from "../../../utils/model/DataFormatDigits";
// import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
// import { Order } from "../../../utils/model/Order";
// import { AggregationLevel, IDataFormatDigits, OrderColumn } from "@bino-bi/ibcs-component-interface";
// import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
// import { VisualisationRuleSet } from "../../ibcs-table/utils/model";
// import { SiPrefix } from "../../../utils/model/SiPrefix";



export class StructureChart {

  private dataModel: any[] = [];
  private variancesDataModel: any[] = [];
  private position: ElementPositions;
  public styles: StructureChartStyle;
  private title: string = '';
  private smallestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private smallestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);

  private pixelPerUnit: number = 1;
  private pixelPerPercentage: number = 1;
  private hideCategories: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  readonly CSS_CATEGORIES: string = "categories";
  private preparedDataSet: any = [];
  private state: FactoryState = FactoryState.DIRTY;
  private i18n: Map<string | number, string>;

  private titleLength: number = 0;
  private leftSideOffsetForHorizontalSync: number = 0;
  private limit: number = 0;

  private ruleSet: VisualisationRuleSet;

  private measureScale: SiPrefix = new SiPrefix();
  private measureUnit: string = "";
  private dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

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
    let categoryWidth = this.calculateCategoryWidth();

    if (this.titleLength > leftSideWidth) {
      leftSideWidth = this.titleLength;
    }

    return new ElementPositions(new Padding(this.styles.padding), this.styles.scaleFactors, this.styles.fontStyles.size, this.dataModel.length, this.leftSideOffsetForHorizontalSync, this.titleLength, leftSideWidth, categoryWidth);
  }

  initSQLFunctions() {
    alasql.fn.transformOperator = function (a) {
      return a == '-' ? -1 : 1;
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

    this.updatePosition();
  }


  private sortScenariosbyVisualisationRules(config: StructureChartComponentConfig) {
    let self = this;
    config.scenarios.sort((n1, n2) => {
      return self.ruleSet.getScenarioSorIndex(n1) - self.ruleSet.getScenarioSorIndex(n2);
    }).reverse();
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
      ["SEPERATOR_WS", ", "], ["in", "in"], ["ORDER_asc", "↑"], ["ORDER_desc", "↓"],
      ["ac1", "AC"], ["pp1", "PY"], ["fc1", "FC"], ["pl1", "PL"],
      ["ac2", "AC2"], ["pp2", "PY2"], ["fc2", "FC2"], ["pl2", "PL2"],
      ["ac3", "AC3"], ["pp3", "PY3"], ["fc3", "FC3"], ["pl3", "PL3"],
      ["ac4", "AC4"], ["pp4", "PY4"], ["fc4", "FC4"], ["pl4", "PL4"],
      ["category", " "], ["operation", " "], ["there_of", "davon"], ["part_of", "in % von"], ["ibcssymbol_delta_ac", "Δ{%}"],
      ["ibcssymbol_delta_generic", "Δ({%})"], ["ibcssymbol_delta_ac_relative", "Δ{%}%"],
      ["ibcssymbol_delta_generic_relative", "Δ({%})%"], ["SUM_TOTAL", "❖"]
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

  public getAllocatedCanvasWidth(): number {
    //let columnLabelWidth = this.calculateCategoryWidth();

    let leftSideWidth = this.position.getAxisPositionX(); //this.calculateLeftSideWidth(this.getVarianceType());
    let rightSideWidth = this.calculateRightSideWidth(this.getVarianceType());

    let width = leftSideWidth + rightSideWidth + + this.styles.padding.left + this.styles.padding.right;

    if (rightSideWidth < this.titleLength / 2) {
      width += this.titleLength / 2;
    }

    if (leftSideWidth < this.titleLength / 2) {
      width += this.titleLength / 2;
    }


    return width
  }

  public getAllocatedCanvasHeight(): number {
    return ((this.dataModel.length + 1) * this.position.spacings.categoryWidth) + this.styles.padding.top + this.styles.padding.bottom;
  }

  public patternToString(): string {
    return "<svg></svg>"
  }

  public toString(): string {
    const container = new Svg();
    this.draw(container);
    container.id("drawCanvas")
    container.width(this.getAllocatedCanvasWidth())
    container.height(this.getAllocatedCanvasHeight())
    return container.svg();
  }

  public draw(svgContainer: Svg): void {
    this.cleanSVGforRedraw(svgContainer);

    if (this.state == FactoryState.DIRTY) {
      this.state = FactoryState.UP_TO_DATE;
    }

    if (this.variancesDataModel && this.variancesDataModel.length > 0) {
      this.drawVarianceScenario(this.variancesDataModel, svgContainer);
      this.drawAxisAndLabels(this.variancesDataModel, svgContainer);

    } else {
      this.drawScenarios(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer);
    }
  }

  setPattern(fc: string, fcPolygonPattern: SVGPolgonPattern) {
    this.styles.pattern.set(fc, fcPolygonPattern);
  }

  private calculateTitleLength(minWidth: number): number {

    let tmpTitle = "_______"; // default width if this.title  is sorther

    let width = CalculateSize(this.title.length > tmpTitle.length ? this.title : tmpTitle, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width;

    if (width < minWidth) {
      return minWidth;
    }
    return width / 2;

  }

  public getFooter(): string {
    if (this.measureScale.value == 1 && this.measureUnit == "") {
      return " ";
    }
    return Formatter.translateScenarioLabel("in", this.i18n) + " " + this.measureScale.prefix + this.measureUnit;
  }

  private setAxisScenario(scenarios: string[]): Scenario {

    let result: Scenario = Scenario.AC1;

    if (scenarios != null && scenarios.length > 0) {
      let axis: VarianceScenario = new VarianceScenario(scenarios.toString());
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

  private populateModel(selectedScenarios: string[], level: AggregationLevel, sortOrder: Order): any {
    if (this.preparedDataSet?.length === 0) {
      return [];
    }

    let dataModel: any = [];
    let orderStr = this.createOrderStr(level, sortOrder);
    let select = this.createSelectString(level, sortOrder);
    let groupByStr = this.createGroupByStr(level, sortOrder);
    let result = alasql<any[]>(`SELECT ${select} ${selectedScenarios.length > 0 ?
      "," + selectedScenarios.map((scenario: string) => { return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt` }).join(",")
      : ""}                          
                         FROM ?
                         GROUP BY ${groupByStr}
                         ORDER BY ${orderStr}`, [this.preparedDataSet]);

    this.detectNaNCells(selectedScenarios, result);

    this.createDataRows(result, dataModel, selectedScenarios);
    this.crateRESTRow(result, selectedScenarios, dataModel);

    return dataModel;
  }

  private detectNaNCells(scenarios: any, res: any[]) {
    res.forEach((row) => {

      scenarios.forEach((scenario: any) => {
        let varianceScenario = new VarianceScenario(scenario);

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

  private crateRESTRow(result: any, selectedScenarios: string[], dataModel: any) {
    if (this.limit == 0 || this.limit > result.length) {
      return;
    }

    let restDataModel: any[] = [];
    let restResult = result.slice(this.limit, result.length);
    this.createDataRows(restResult, restDataModel, selectedScenarios);

    let reducedRestRow = restDataModel.reduce(function (sum: any, current: any) {
      let obj = {
        id: sum.id, category: sum.category, type: sum.type,
        scenario1: new DataPoint(sum.scenario1.value + current.scenario1.value, selectedScenarios[0], sum.scenario1.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(sum.scenario2.value + current.scenario2.value, selectedScenarios[1], sum.scenario2.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(sum.scenario3.value + current.scenario3.value, selectedScenarios[2], sum.scenario3.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(sum.scenario4.value + current.scenario4.value, selectedScenarios[3], sum.scenario4.pixelPerUnit, Scenario.NEU),
      }
      return obj;
    }, {
      id: 9999, category: 'REST', type: VarianceType.NONE,
      scenario1: new DataPoint(0, selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
      scenario2: new DataPoint(0, selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
      scenario3: new DataPoint(0, selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
      scenario4: new DataPoint(0, selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
    });

    dataModel.push(reducedRestRow);
  }

  private createDataRows(result: any, dataModel: any[], selectedScenarios: string[]) {
    let primaryResult = result;

    if (this.limit > 0) {
      primaryResult = result.slice(0, this.limit);
    }

    primaryResult.forEach((element: any, index: number) => {
      dataModel.push({
        id: index,
        category: element.category,
        type: VarianceType.NONE,
        scenario1: new DataPoint(element[selectedScenarios[0]], selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(element[selectedScenarios[1]], selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(element[selectedScenarios[2]], selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(element[selectedScenarios[3]], selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
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
    if (level == AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY} as category`;
    } else if (level == AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP} as category`;
    } else if (level == AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
      return `${OrderColumn.SUBCATEGORYINDEX}, ${AggregationLevel.SUBCATEGORY} as category`;
    } else {
      return `${level.toString()} as category`;
    }
  }

  private createGroupByStr(level: AggregationLevel, sortOrder: Order) {
    if (level == AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY}`;
    } else if (level == AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP}`;
    } else if (level == AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
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

    for (let entry of this.dataModel) {

      const columnLength = CalculateSize(entry.category, {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px"
      })

      if (columnLength.width > longestLength) {
        longestLength = columnLength.width;
      }

    }

    // MagicNumber used to compensate differnet fontwidth rendered vs calculated
    let magicNumber = 1.1125;

    return longestLength * magicNumber;
  }

  private findSmallestDataPointValue(dataModel: any[]): DataPoint {
    let smallestDataPoint: DataPoint = new DataPoint(0, "default", this.pixelPerUnit, null);
    for (let entry of dataModel) {
      for (let current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null && smallestDataPoint.value != null) {
          if (current.value < smallestDataPoint.value) {
            smallestDataPoint = current;
          }
        }
      }
    }
    return smallestDataPoint;
  }

  private findHighestDataPointValue(dataModel: any[]): DataPoint {
    let highestDataPoint: DataPoint = new DataPoint(0, "default", this.pixelPerUnit, null);
    for (let entry of dataModel) {
      for (let current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null && highestDataPoint.value != null) {
          if (current.value > highestDataPoint.value) {
            highestDataPoint = current;
          }
        }
      }
    }
    return highestDataPoint;
  }

  private populateVarianceModel(variancesConfig: string[], dataModel: any[]): any {
    let varianceModel: any = [];

    if (variancesConfig.length === 0) {
      return varianceModel;
    }

    let firstRow = null;

    if (dataModel != null && dataModel.length > 0) {
      firstRow = dataModel[0];
    }

    for (let varianceScenario in variancesConfig) {
      let scenarios: VarianceScenario = new VarianceScenario(variancesConfig[varianceScenario]);

      if (scenarios.isValid) {
        let scenariomap: Map<string, string> = this.mapScenarios(scenarios, firstRow);
        let directon: string = scenarios.direction;


        let pixelPerUnit: number = this.pixelPerUnit;
        if (scenarios.type == 'dr') {
          pixelPerUnit = this.pixelPerPercentage;
        }

        for (let index in dataModel) {
          varianceModel.push({
            id: index,
            category: dataModel[index].category,
            type: scenarios.type == 'dr' ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            scenario1: new DataPoint(this.calculateVariance(scenarios, dataModel[index], scenariomap), scenarios.base, pixelPerUnit, directon),
            scenario3: new DataPoint(null, null, null, null),
            scenario4: new DataPoint(null, null, null, null),
          });
        }
      }
    }

    return varianceModel;
  }

  private calculateVariance(scenarios: VarianceScenario, element: any, scenarioMap: Map<string, string>): number | null {
    let scenarioBase = scenarioMap.get(scenarios.base);
    let scenarioDelta = scenarioMap.get(scenarios.delta);

    if (scenarioBase == null || scenarioDelta == null) {
      return null;
    }

    let isRelativeVarianze = scenarios.type === VarianceType.RELATIVE;

    if (isRelativeVarianze) {
      return ((element[scenarioBase].value - element[scenarioDelta].value) / element[scenarioDelta].value);
    } else {
      return element[scenarioBase].value - element[scenarioDelta].value;
    }
  }

  private mapScenarios(scenarios: VarianceScenario, firstRow: any): Map<string, string> {

    let varianceMap: Map<string, string> = new Map();

    if (firstRow == null) {
      return varianceMap;
    }

    ["scenario1", "scenario2", "scenario3", "scenario4"].forEach((scenarioKey) => {
      if (firstRow[scenarioKey].scenario === scenarios.delta) {
        varianceMap.set(scenarios.delta, scenarioKey);
      } else if (firstRow[scenarioKey].scenario === scenarios.base) {
        varianceMap.set(scenarios.base, scenarioKey);
      }
    },
    );

    return varianceMap;
  }

  private calculateTextBoxWidth(value: number): number {
    return CalculateSize(Formatter.number(value, 'decimal', 1, 0), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width;
  }

  private calculatePercentageTextBoxWidth(value: number): number {
    let signWidth = 0;
    let labelWidth = 0;

    if (value >= 0) {
      signWidth += CalculateSize("+", {
        font: this.styles.fontStyles.font,
        fontSize: this.styles.fontStyles.size + "px"
      }).width;
    }

    signWidth += CalculateSize(" %", {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width;

    labelWidth = CalculateSize(Formatter.number(value, 'decimal', 1, 1), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width + signWidth;

    return labelWidth + signWidth;
  }


  private cleanSVGforRedraw(svgContainer: Svg) {
    svgContainer.clear();
  }

  private drawAxisAndLabels(dataModel: any[], svgContainer: Svg) {
    let axisLabelGroup: G = svgContainer.group()
      .id("AxisAndDateLables");

    let isRelative = false;
    if (!this.hideCategories) {
      dataModel.forEach((elements: any, index: number) => {

        if (elements["type"] == VarianceType.RELATIVE) {
          isRelative = true;
        }

        let textHook = HookLocation.Right;
        let isPositive = true;
        if (elements['scenario1'].value < 0) {
          textHook = HookLocation.Left;
          isPositive = false;
        }
        new Label(axisLabelGroup, this.position.getCategoryPositionX(isPositive), this.position.getBarCenterPositionY(index), '', elements.category, this.styles, HookLocation.Center, textHook).draw();
      });
    }

    new Axis({
      scenarioType: this.axisScenario,
      labelText: this.title,
      isRelative: isRelative
    }, this.position, axisLabelGroup, this.styles).draw();
  }

  private drawScenarios(dataModel: any, svgContainer: Svg) {

    let barsGroup: G = svgContainer.group()
      .id("Scenarios");

    let scenarioFactory = new ScenarioFactory(this.position, barsGroup, this.styles, dataModel.length, this.i18n);

    dataModel.forEach((elements: any, index: number) => {
      scenarioFactory.createPrimaryBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      scenarioFactory.createSecondaryBar(elements["scenario2"], index).draw();
      scenarioFactory.createPrimaryMarker(elements["scenario3"], index).draw();
      scenarioFactory.createSecondaryMarker(elements["scenario4"], index).draw();
    });
  }

  private drawVarianceScenario(dataModel: any, svgContainer: Svg): G {
    let barsGroup: G = svgContainer.group()
      .id("Scenarios");

    let scenarioFactory = new ScenarioFactory(this.position, barsGroup, this.styles, dataModel.length, this.i18n);

    dataModel.forEach((elements: any, index: number) => {
      if (elements["type"] == VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw();
      } else {
        scenarioFactory.createVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
    });

    return barsGroup;
  }

  private getVarianceType() {
    if (this.variancesDataModel.length > 0) {
      return this.variancesDataModel[0].type;
    }
    return VarianceType.NONE;
  }

  private calculateLeftSideWidth(varianceType: VarianceType): number {
    let width = 0;
    let labelToBar = this.styles.fontStyles.size * (this.styles.scaleFactors).labelToBar;

    if (VarianceType.NONE == varianceType && this.smallestDataPointValue?.value != null && this.smallestDataPointValue.value < 0) {

      const sizeLabelValue = this.calculateTextBoxWidth(this.smallestDataPointValue.value);
      width = Math.abs(this.smallestDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;

    } else if (VarianceType.RELATIVE == varianceType && this.smallestVarianceDataPointValue?.value != null && this.smallestVarianceDataPointValue.value < 0) {

      const sizeLabelValue = this.calculatePercentageTextBoxWidth(this.smallestVarianceDataPointValue.value);
      width = Math.abs(this.smallestVarianceDataPointValue.getScaledPercentUnit()) + labelToBar + sizeLabelValue;

    } else if (VarianceType.ABSOLUTE == varianceType && this.smallestVarianceDataPointValue?.value != null && this.smallestVarianceDataPointValue.value < 0) {

      const sizeLabelValue = this.calculateTextBoxWidth(this.smallestVarianceDataPointValue.value);
      width = Math.abs(this.smallestVarianceDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    }

    if (width <= this.titleLength) {
      return this.titleLength;
    }

    return width;
  }

  private calculateRightSideWidth(varianceType: VarianceType): number {
    let width = 0;
    let labelToBar = this.styles.fontStyles.size * (this.styles.scaleFactors).labelToBar;

    if (VarianceType.NONE == varianceType && this.highestDataPointValue?.value != null && this.highestDataPointValue.value >= 0) {

      const sizeLabelValue = this.calculateTextBoxWidth(this.highestDataPointValue.value);
      width = Math.abs(this.highestDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;

    } else if (VarianceType.RELATIVE == varianceType && this.highestVarianceDataPointValue?.value != null && this.highestVarianceDataPointValue.value >= 0) {

      const sizeLabelValue = this.calculatePercentageTextBoxWidth(this.highestVarianceDataPointValue.value);
      width = Math.abs(this.highestVarianceDataPointValue.getScaledPercentUnit()) + labelToBar + sizeLabelValue;

    } else if (VarianceType.ABSOLUTE == varianceType && this.highestVarianceDataPointValue?.value != null && this.highestVarianceDataPointValue.value >= 0) {

      const sizeLabelValue = this.calculateTextBoxWidth(this.highestVarianceDataPointValue.value);
      width = Math.abs(this.highestVarianceDataPointValue.getScaledUnit()) + labelToBar + sizeLabelValue;
    }

    if (width <= this.titleLength) {
      return this.titleLength;
    }

    return width;
  }

  hasNoData() {
    return this.dataModel.length == 0;
  }
}
