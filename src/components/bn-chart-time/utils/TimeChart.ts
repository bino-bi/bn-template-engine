import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, Padding, } from "./helper";

import { DataPoint, Scenario } from "./model";

import { Axis, HookLocation, Label } from "./elements";
import { ScenarioFactory, } from "./factories";
import alasql from "alasql";

import CalculateSize from 'calculate-size';

// import { Formatter } from "../../../utils";
// import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
// import { Order } from "../../../utils/model/Order";
import { TimeChartComponentConfig } from "./model/TimeChartComponentConfig";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { TimeChartDataRow } from "./model/TimeChartDataRow";
//import { DateStringFactory } from "../../../utils/DateStringFactory";
import { DateTime } from "luxon";
import { DateDistance, DateStringFactory } from "../../../utils/DateStringFactory";
import { AggregationLevel, AxisLabelsMode } from "../../../utils/constants";
import { DataFormatDigits, Order } from "../../../components";
import { Formatter } from "../../../utils";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";
import { DataAnalyzer } from "../../../utils/dataAnalyzer";
// import { AggregationLevel, AxisLabelsMode, DateDistance, IDataFormatDigits } from "@bino-bi/ibcs-component-interface";
// import { VisualisationRuleSet } from "../../ibcs-table/utils/model";
// import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
// import { SiPrefix } from "../../../utils/model/SiPrefix";


enum FactoryState {
  UP_TO_DATE,
  DIRTY,
}

enum VarianceType {
  RELATIVE = 'dr',
  ABSOLUTE = 'd',
  NONE = '',
}

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
}

export class TimeChart {

  public styles: TimeChartStyle;
  readonly CSS_CATEGORIES: string = "categories";
  private dataModel: any[] = [];
  private variancesDataModel: any[] = [];
  private position: ElementPositions;
  private title: string = '';
  private smallestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private smallestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private highestVarianceDataPointValue: DataPoint = new DataPoint(0, Scenario.AC1, 1, Scenario.NEU);
  private pixelPerUnit: number = 1;
  private pixelPerPercentage: number = 1;
  private hideAxisLabels: boolean = false;
  private axisScenario: Scenario = Scenario.AC1;
  private preparedDataSet: any = [];

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
  
  constructor(ruleSet: VisualisationRuleSet, config: TimeChartComponentConfig, styles: TimeChartStyle) {
    this.initSQLFunctions();
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.i18n = this.createI18n(new Map());
    this.styles = styles;
    this.setConfig(config);
    this.position = this.createElementPosition(config.scenarios);
  }

  public updatePosition(scenarios: string[]) {
    this.position = this.createElementPosition(scenarios);
  }

  initSQLFunctions() {
    alasql.fn.transformOperator = function (a) {
      return a == '-' ? -1 : 1;
    };

    // @ts-ignore
    alasql.fn.normalizeDate = function (date: DateTime | undefined, normalizationLevel: StringOf, locale: moment.LocaleSpecifier): DateTimes {
      if (date == undefined || !date.isValid) {
        return undefined;
      }

      return date.startOf(normalizationLevel);
    };
  }

  public setStyles(newStyle: TimeChartStyle) {
    this.styles = newStyle;
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
    console.log("measureScale", this.measureScale);
    this.measureUnit = config.measureUnit;  
    this.dataFormatDigits = config.dataFormatDigits;    
    
    this.updatePosition(config.scenarios);

    this.showOverlayMedian = config.showOverlayMedian;
    this.showOverlayAvg = config.showOverlayAvg;

    console.log("setConfig", config);

  }

  public getFooter(): string {  
    if (this.measureScale.value == 1 && this.measureUnit == "" ){
      return " ";
    }
     return Formatter.translateScenarioLabel("in" , this.i18n) + " " + this.measureScale.prefix + this.measureUnit;  
  }

  private sortScenariosbyVisualisationRules(config: TimeChartComponentConfig) {
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
    
    if(filter != null && filter.length > 0 ) {
      try{
        this.preparedDataSet  = alasql(`SELECT * FROM ? WHERE ${filter}`, [data]);
      } catch(e) {
        this.preparedDataSet = data;
      }     
    } else {
      this.preparedDataSet = data;
    }
  }

  public getAllocatedCanvasWidth(): number {
    if (this.axisCategoryArea.width > this.scenariosArea.width) {
      return this.axisCategoryArea.width + this.position.leftSideLabelLength;
    } else {
      return this.scenariosArea.width + this.position.leftSideLabelLength;
    }

  }

  public getAllocatedCanvasHeight(): number {
    let isOnSameAxisSide: boolean;

    if (this.smallestVarianceDataPointValue.value == null || this.highestVarianceDataPointValue.value == null || this.smallestDataPointValue.value == null || this.highestDataPointValue.value == null) {
      return 0;
    }

    isOnSameAxisSide = this.isOnSameAxisSide();


    if (isOnSameAxisSide) {
      return this.axisCategoryArea.height + this.scenariosArea.height;
    } else {
      return this.scenariosArea.height;
    }

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

    if (this.isVarianceChart()) {
      this.drawVarianceScenario(this.variancesDataModel, svgContainer);
      this.drawAxisAndLabels(this.variancesDataModel, svgContainer);
    } else {
      this.drawScenarios(this.dataModel, svgContainer);
      this.drawOverlayLayer(this.dataModel, svgContainer);
      this.drawAxisAndLabels(this.dataModel, svgContainer);
    }
  }

  setPattern(fc: string, fcPolygonPattern: SVGPolgonPattern) {
    this.styles.pattern.set(fc, fcPolygonPattern);
  }

  hasNoData() {
    return this.dataModel.length == 0;
  }

  private isOnSameAxisSide(): boolean {
    if (this.smallestVarianceDataPointValue.value == null || this.highestVarianceDataPointValue.value == null || this.smallestDataPointValue.value == null || this.highestDataPointValue.value == null) {
      return false;
    }

    if (this.isVarianceChart()) {
      return Math.sign(this.smallestVarianceDataPointValue.value) == Math.sign(this.highestVarianceDataPointValue.value) || this.smallestDataPointValue.value == 0 && Math.sign(this.highestDataPointValue.value) == 1;
    } else {
      return Math.sign(this.smallestDataPointValue.value) == Math.sign(this.highestDataPointValue.value) || this.smallestDataPointValue.value == 0 && Math.sign(this.highestDataPointValue.value) == 1;
    }
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

  private createElementPosition(scenarios: string[]): ElementPositions {
    let maxLabelLengthLeft = 0;

    // only need scenarios written on the leftside of bar/ marker
    let scenarioLabelLeft = CalculateSize(scenarios.filter((_value, index) => index == 1 || index == 2)
      .map((scenario) => Formatter.translateScenarioLabel(scenario, this.i18n))
      .reduce((a, b) => a.length < b.length ? b : a, ""), {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width;

    let titleLength = this.calculateTitleLength(this.leftSideOffsetForHorizontalSync);

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

    return new ElementPositions(new Padding(this.styles.padding), this.styles.scaleFactors, this.styles.fontStyles, min, max, this.dataModel.length, maxLabelLengthLeft);
  }

  private calculateTitleLength(minWidth: number): number {
    let tmpTitle = "_______"; // default width if this.title  is sorther

    if (tmpTitle.length < this.title.length) {
      tmpTitle = this.title;
    }

    let width = CalculateSize(tmpTitle, {
      font: this.styles.fontStyles.font,
      fontSize: this.styles.fontStyles.size + "px"
    }).width;

    if (width < minWidth) {
      return minWidth;
    }
    return width;

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

  private populateModel(selectedScenarios: string[], dateInterval: DateDistance, _level: AggregationLevel, _sortOrder: Order): any {
    if (this.preparedDataSet?.length === 0) {
      return []
    }

    const select = ``;
    const order = '';

    let result = this.queryDataSet(dateInterval, select, order);
    this.detectNaNCells(selectedScenarios, result);

    result = this.leftOuterJoinDates(result, dateInterval);

    const dataModel: any[] = this.createDataRows(result, selectedScenarios);

    console.log("populateModel", dataModel);
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


  private findDateInterval(dateInterval: DateDistance): DateDistance {
    if (dateInterval != DateDistance.AUTO) {
      return dateInterval;
    }

    let resultMinMax = this.queryMinMaxDates();
    let localDateInterval = DateDistance.DAY;

    if (resultMinMax[0]?.mindate != null) {
      localDateInterval = new DateStringFactory().calculateDistanceType(resultMinMax[0]?.mindate, resultMinMax[0]?.maxdate, this.intervalSpanLimit);
    }

    return localDateInterval;
  }

  private queryMinMaxDates(): any[] {

    //let result: any[] = [];
    const result = alasql(`SELECT MAX(${"date"}) as maxdate, MIN(${"date"}) as mindate FROM ?`, [this.preparedDataSet]);

    if(result[0]?.mindate != null){
      result[0].mindate = DateTime.fromMillis(result[0]?.mindate);
    }
    if(result[0]?.maxdate != null){
      result[0].maxdate = DateTime.fromMillis(result[0]?.maxdate);
    }     
    
    return result;
  }

  private queryDataSet(dateInterval: DateDistance, select: string, order: string) {
    const scenarios = ['ac1', 'ac2', 'ac3', 'ac4', 'pp1', 'pp2', 'pp3', 'pp4', 'fc1', 'fc2', 'fc3', 'fc4', 'pl1', 'pl2', 'pl3', 'pl4'];
    const dateSelect = `normalizeDate([date], '${dateInterval}' , '${this.locale}') as  calcdate`;
    const result = alasql(`SELECT ${"p.calcdate"}                                ${select},
                          ${scenarios.map((scenario: string) => { return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt` }).join(",")} 
                     
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
                           ORDER BY ${"calcdate asc"}`, [this.preparedDataSet]);

    console.log("queryDataSet", result);                       
    return result;
  }

  private createDataRows(result: TimeChartResponseRow[], selectedScenarios: string[]): any[] {
    let dataModel: any[] = [];

    result.forEach((element: any, index: number) => {
      dataModel.push({
        id: index,
        category: element.category,
        type: VarianceType.NONE,
        date: element['calcdate'],
        scenario1: new DataPoint(element[selectedScenarios[0]], selectedScenarios[0], this.pixelPerUnit, Scenario.NEU),
        scenario2: new DataPoint(element[selectedScenarios[1]], selectedScenarios[1], this.pixelPerUnit, Scenario.NEU),
        scenario3: new DataPoint(element[selectedScenarios[2]], selectedScenarios[2], this.pixelPerUnit, Scenario.NEU),
        scenario4: new DataPoint(element[selectedScenarios[3]], selectedScenarios[3], this.pixelPerUnit, Scenario.NEU),
      });
      //}
    });

    console.log("createDataRows", dataModel);        
    return dataModel;
  }

  private findSmallestDataPointValue(dataModel: any[]): DataPoint {
    let pixel = this.isVarianceChart() ? this.pixelPerPercentage : this.pixelPerUnit;
    let smallestDataPoint: DataPoint = new DataPoint(0, "default", pixel, Scenario.NEU);

    for (let entry of dataModel) {
      for (let current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current && current.value != null) {
          if (current.value < Number(smallestDataPoint.value)) {
            smallestDataPoint = current;
          }
        }
      }
    }

    return smallestDataPoint;
  }

  private findHighestDataPointValue(dataModel: any[]): DataPoint {
    let pixel = this.isVarianceChart() ? this.pixelPerPercentage : this.pixelPerUnit;
    let highestDataPoint: DataPoint = new DataPoint(0, "default", pixel, Scenario.NEU);

    for (let entry of dataModel) {
      for (let current of [entry.scenario1, entry.scenario2, entry.scenario3, entry.scenario4]) {
        if (current != null) {
          if (current.value > Number(highestDataPoint.value)) {
            highestDataPoint = current;
          }
        }
      }
    }
    return highestDataPoint;
  }

  private populateVarianceModel(variancesConfig: string[], dataModel: any[]): any {
    let varianceModel: any = [];

    if (variancesConfig == null || variancesConfig.length === 0) {
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

        let pixelPerUnit = scenarios.type == 'dr' ? this.pixelPerPercentage : this.pixelPerUnit;

        for (let index in dataModel) {
          varianceModel.push({
            id: index,
            category: dataModel[index].name,
            type: scenarios.type == 'dr' ? VarianceType.RELATIVE : VarianceType.ABSOLUTE,
            date: dataModel[index].date,
            scenario1: new DataPoint(this.calculateVariance(scenarios, dataModel[index], scenariomap), scenarios.delta, pixelPerUnit, directon),
            scenario3: new DataPoint(null, null, null, null),
            scenario4: new DataPoint(null, null, null, null),
          });
        }
      }
    }
    console.log("populateVarianceModel", varianceModel);     
    return varianceModel;
  }

  private calculateVariance(scenarios: VarianceScenario, element: any, scenarioMap: Map<string, string>): number | null {
    let scenarioBase = scenarioMap.get(scenarios.base);
    let scenarioDelta = scenarioMap.get(scenarios.delta);

    if (scenarioBase == null || scenarioDelta == null) {
      return null;
    }

    if (element[scenarioBase].value == null || element[scenarioDelta].value == null) {
      return null;
    }

    let isRelativeVariance = scenarios.type === VarianceType.RELATIVE;

    if (isRelativeVariance) {
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

  private cleanSVGforRedraw(svgContainer: Svg) {
    svgContainer.clear();
  }

  private isVarianceChart() {
    return this.variancesDataModel && this.variancesDataModel.length > 0;
  }

  private createDateFactory(): DateStringFactory {
    let factory: DateStringFactory = new DateStringFactory();
    return factory;
  }

  private drawAxisAndLabels(dataModel: any[], svgContainer: Svg) {

    let dateStringFactory: DateStringFactory = this.createDateFactory();

    let axisLabelGroup: G = svgContainer.group()
      .id("AxisAndDateLables");

    let isRelative: boolean = false;

    if (this.hideAxisLabels === false) {
      dataModel.forEach((elements: any, index: number) => {

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

        new Label(axisLabelGroup, this.position.getColumnCenterPositionX(index), this.position.getAxisPositionY(isRelative) + offset, '', datelabel, this.styles, hookLocation, HookLocation.Center).forceStringTypeDraw();

      });
    } else {
      let element = dataModel?.[0];
      if (element && element["type"] == VarianceType.RELATIVE) {
        isRelative = true;
      }
    }

    new Axis({
      scenarioType: this.axisScenario,
      labelText: this.title,
      isRelative: isRelative
    }, this.position, axisLabelGroup).draw();
    this.axisCategoryArea = {
      height: axisLabelGroup.height() as number,
      width: axisLabelGroup.width() as number
    };

  }

  private drawScenarios(dataModel: any, svgContainer: Svg) {


    let columnGroup: G = svgContainer.group()
      .id("Scenarios");

    let scenarioFactory = new ScenarioFactory(this.position, columnGroup, this.styles, dataModel.length, this.i18n);

    let hasValidPrim: boolean = false;

    dataModel.forEach((elements: any, index: number) => {
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
      height: columnGroup.height() as number + this.styles.padding.top + this.styles.padding.bottom + heightOffset,
      width: columnGroup.width() as number + this.position.spacings.columnWidth
    };

  }

  private drawVarianceScenario(dataModel: any, svgContainer: Svg): G {
    let columnGroup: G = svgContainer.group()
      .id("Scenarios");

    let scenarioFactory = new ScenarioFactory(this.position, columnGroup, this.styles, dataModel.length, this.i18n);

    dataModel.forEach((elements: any, index: number) => {
      if (elements["type"] == VarianceType.RELATIVE) {
        scenarioFactory.createRelativeVarianceBar(elements["scenario1"], index).draw();
      } else {
        scenarioFactory.createVarianceBar(elements["scenario1"], index).draw(this.dataFormatDigits, this.measureScale);
      }
    });


    this.scenariosArea = {
      height: columnGroup.height() as number + this.styles.padding.top + this.styles.padding.bottom,
      width: columnGroup.width() as number + this.position.spacings.columnWidth
    };

    return columnGroup;
  }

  private drawOverlayLayer (dataModel: any, svgContainer: Svg) {
    let overlayGroup: G = svgContainer.group()
      .id("Overlay");

    let scenarioFactory = new ScenarioFactory(this.position, overlayGroup, this.styles, dataModel.length, this.i18n);
   
    if ( this.showOverlayAvg == true) {
      let previousDataPoint: null;

      const avgDataModel = tranformToAvgDataModel(dataModel);

      avgDataModel.forEach((elements: any, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory.createLine(`Ø  ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`, elements["scenario1"], previousDataPoint, index -1).draw(this.dataFormatDigits, this.measureScale);
        }       
        previousDataPoint = elements["scenario1"]; 
  
      });
    }

    if ( this.showOverlayMedian === true) {
     
      let previousDataPoint: null;


      const medianDataModel = tranformToMedianDataModel(dataModel);
      
      medianDataModel.forEach((elements: any, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory.createLine(`Median ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`, elements["scenario1"], previousDataPoint, index -1 ).draw(this.dataFormatDigits, this.measureScale);
        }       
        previousDataPoint = elements["scenario1"]; 
  
      });
    }
  }

  private leftOuterJoinDates(result: TimeChartResponseRow[], dateInterval: DateDistance): TimeChartResponseRow[] {
    let to: DateTime = DateTime.max(...result.map(function (e: TimeChartResponseRow) {
      return e.calcdate;
    }));

    let from: DateTime = DateTime.min(...result.map(function (e: TimeChartResponseRow) {
      return e.calcdate;
    }));

    let dateRange: DateTime[] = new DateStringFactory().datesBetween(from, to, dateInterval, this.intervalSpanLimit);

    let dateRangeEntries: Map<string, TimeChartResponseRow> = new Map();

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
      }
      );
    });

    result.forEach((element: TimeChartResponseRow) => {
      let millisecondKey: string = element.calcdate.toISO() as string;

      let placeholder = dateRangeEntries.get(millisecondKey);
      if (placeholder && placeholder.isEmpty) {
        let newElement = {
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
        }
        dateRangeEntries.set(millisecondKey, newElement);
      }
    });

    return Array.from(dateRangeEntries.values());

  }
}
function tranformToAvgDataModel(dataModel: any) {
  const total = dataModel.reduce((sum: number, elements: any) => {
    return sum + (elements["scenario1"]?.value || 0); // Sum up the values of scenario1
  }, 0);

  const count = dataModel.filter((elements: any) => elements["scenario1"]?.value !== undefined).length; // Count valid scenario1 values

  const average = count > 0 ? total / count : 0; // Calculate the average, avoid division by zero

  // Create a new first element
  const firstElement = {
    ...dataModel[0],
    scenario1: new DataPoint(average, dataModel[0]["scenario1"].scenario, dataModel[0]["scenario1"].pixelPerUnit, dataModel[0]["scenario1"].variance),
  };

  // Create a new last element
  const lastElement = {
    ...dataModel[dataModel.length - 1],
    scenario1: new DataPoint(average, dataModel[dataModel.length - 1]["scenario1"].scenario, dataModel[dataModel.length - 1]["scenario1"].pixelPerUnit, dataModel[dataModel.length - 1]["scenario1"].variance),
  };

  // Add the new first and last elements to the transformed data model
  return [firstElement, ...dataModel.map((elements: any) => {
    return {
      ...elements,
      scenario1: new DataPoint(average, elements["scenario1"].scenario, elements["scenario1"].pixelPerUnit, elements["scenario1"].variance),
    };
  }), lastElement];

}

function tranformToMedianDataModel(dataModel: any) {
  const values = dataModel
    .map((elements: any) => elements["scenario1"]?.value)
    .filter((value: number | undefined) => value !== undefined)
    .sort((a: number, b: number) => a - b);

  const median =
    values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];


    // Create a new first element
  const firstElement = {
      ...dataModel[0],
      scenario1: new DataPoint(median, dataModel[0]["scenario1"].scenario, dataModel[0]["scenario1"].pixelPerUnit, dataModel[0]["scenario1"].variance),
  };
  
    // Create a new last element
  const lastElement = {
      ...dataModel[dataModel.length - 1],
      scenario1: new DataPoint(median, dataModel[dataModel.length - 1]["scenario1"].scenario, dataModel[dataModel.length - 1]["scenario1"].pixelPerUnit, dataModel[dataModel.length - 1]["scenario1"].variance),
  };

   // Add the new first and last elements to the transformed data model
   return [firstElement, ...dataModel.map((elements: any) => {
    return {
      ...elements,
      scenario1: new DataPoint(median, elements["scenario1"].scenario, elements["scenario1"].pixelPerUnit, elements["scenario1"].variance),
    };
  }), lastElement];
}

