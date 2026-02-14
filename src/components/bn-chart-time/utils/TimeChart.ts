import { G, Svg } from "@svgdotjs/svg.js";

import { ElementPositions, Padding, } from "./helper";

import { DataPoint, Scenario } from "./model";

import { AreaFill, AreaPoint, Axis, HookLocation, Label, LineSeries, LineSeriesDataPoint, StackedColumn } from "./elements";
import { ScenarioFactory, } from "./factories";
import { LabelCollisionManager, SCENARIO_PRIORITY } from "./helper";
import alasql from "alasql";

import CalculateSize from 'calculate-size';

// import { Formatter } from "../../../utils";
// import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
// import { Order } from "../../../utils/model/Order";
import { StackConfigParsed, TimeChartComponentConfig } from "./model/TimeChartComponentConfig";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { TimeChartDataRow } from "./model/TimeChartDataRow";
//import { DateStringFactory } from "../../../utils/DateStringFactory";
import { DateTime } from "luxon";
import { DateDistance, DateStringFactory } from "../../../utils/DateStringFactory";
import { AggregationLevel, AxisLabelsMode, ChartMode, StackBy, StackMode } from "../../../utils/constants";
import { DataFormatDigits, Order } from "../../../components";
import { Formatter } from "../../../utils";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { SVGPolgonPattern, VarianceScenario } from "../../../utils/model";
import { SiPrefix } from "../../../utils/model/SiPrefix";
import { VisualisationRuleSet } from "../../bn-table/utils/model";
// import { DataAnalyzer } from "../../../utils/dataAnalyzer";
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
  private chartMode: ChartMode = ChartMode.BAR;
  private maxBars: number = 28;
  private stackConfig: StackConfigParsed | null = null;

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

    this.measureUnit = config.measureUnit;
    this.dataFormatDigits = config.dataFormatDigits;

    this.updatePosition(config.scenarios);

    this.showOverlayMedian = config.showOverlayMedian;
    this.showOverlayAvg = config.showOverlayAvg;
    this.chartMode = config.chartMode;
    this.maxBars = config.maxBars;
    this.stackConfig = config.stackConfig;

  }

  public getFooter(): string {
    if (this.measureScale.value == 1 && this.measureUnit == "") {
      return " ";
    }
    return Formatter.translateScenarioLabel("in", this.i18n) + " " + this.measureScale.prefix + this.measureUnit;
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
    } else if (this.stackConfig != null) {
      const effectiveChartMode = this.determineEffectiveChartMode();
      if (effectiveChartMode === ChartMode.LINE) {
        this.drawStackedAreaScenarios(this.dataModel, svgContainer);
        this.drawAxisAndLabelsForLineChart(this.dataModel, svgContainer);
      } else {
        this.drawStackedScenarios(this.dataModel, svgContainer);
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
    const result = alasql<any[]>(`SELECT MAX(${"date"}) as maxdate, MIN(${"date"}) as mindate FROM ?`, [this.preparedDataSet]);

    if (result[0]?.mindate != null) {
      result[0].mindate = DateTime.fromMillis(result[0]?.mindate);
    }
    if (result[0]?.maxdate != null) {
      result[0].maxdate = DateTime.fromMillis(result[0]?.maxdate);
    }

    return result;
  }

  private queryDataSet(dateInterval: DateDistance, select: string, order: string) {
    const scenarios = ['ac1', 'ac2', 'ac3', 'ac4', 'pp1', 'pp2', 'pp3', 'pp4', 'fc1', 'fc2', 'fc3', 'fc4', 'pl1', 'pl2', 'pl3', 'pl4'];
    const dateSelect = `normalizeDate([date], '${dateInterval}' , '${this.locale}') as  calcdate`;
    const result = alasql<any[]>(`SELECT ${"p.calcdate"}                                ${select},
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

  private drawLineScenarios(dataModel: any, svgContainer: Svg): void {
    const lineGroup: G = svgContainer.group().id("LineScenarios");
    // Create collision manager for label overlap detection across all line series
    const collisionManager = new LabelCollisionManager();

    const scenarioFactory = new ScenarioFactory(this.position, lineGroup, this.styles, dataModel.length, this.i18n);
    scenarioFactory.setCollisionManager(collisionManager);

    // Collect data points for each scenario
    const slotDefaults = ["ac1", "pp1", "fc1", "pl1"];
    const slotPoints: LineSeriesDataPoint[][] = [[], [], [], []];

    dataModel.forEach((elements: any, index: number) => {
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
      if (points.length > 0 && points.some(p => !p.dataPoint.isEmpty())) {
        const scenarioName = points[0]?.dataPoint?.scenario as string || slotDefaults[i];
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

    this.scenariosArea = {
      height: lineGroup.height() as number + this.styles.padding.top + this.styles.padding.bottom,
      width: lineGroup.width() as number + this.position.spacings.columnWidth
    };
  }

  private drawAxisAndLabelsForLineChart(dataModel: any[], svgContainer: Svg): void {
    const dateStringFactory: DateStringFactory = this.createDateFactory();
    const axisLabelGroup: G = svgContainer.group().id("AxisAndDateLabelsLine");
    const isRelative: boolean = false;
    const lastIndex = dataModel.length - 1;

    if (this.hideAxisLabels === false) {
      dataModel.forEach((elements: any, index: number) => {
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

        // Get the date label
        let datelabel = dateStringFactory.getShortDateString(elements.date, this.dateInterval);

        new Label(
          axisLabelGroup,
          this.position.getColumnCenterPositionX(index),
          this.position.getAxisPositionY(isRelative) + offset,
          '',
          datelabel,
          this.styles,
          hookLocation,
          HookLocation.Center
        ).forceStringTypeDraw();

        // Draw vertical dashed separator line at year transitions (except for first and last)
        if (index > 0 && index < lastIndex && this.isYearChange(dataModel, index)) {
          this.drawYearSeparatorLine(axisLabelGroup, index, isRelative);
        }
      });
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

  private shouldShowLineChartAxisLabel(dataModel: any[], index: number): boolean {
    const lastIndex = dataModel.length - 1;

    // Always show first and last labels
    if (index === 0 || index === lastIndex) {
      return true;
    }

    // Show label if year changed from previous data point
    return this.isYearChange(dataModel, index);
  }

  private isYearChange(dataModel: any[], index: number): boolean {
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
    const xPos = this.position.getColumnCenterPositionX(index) - (this.position.spacings.columnWidth / 2);
    // Calculate chart height from the max data point
    const chartHeight = this.position.columnValue.max.getScaledUnit() + this.position.dataLabelHeight;
    const topY = this.position.getAxisPositionY(isRelative) - chartHeight;
    const bottomY = this.position.getAxisPositionY(isRelative);

    group.line([[xPos, topY], [xPos, bottomY]])
      .stroke({
        color: '#999999',
        width: 1,
        dasharray: '4,4'
      })
      .attr('stroke-dasharray', '4,4');
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

  /**
   * Draw stacked bar columns. Supports stacking by scenario or by data dimension.
   */
  private drawStackedScenarios(dataModel: any[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const stackGroup: G = svgContainer.group().id("StackedScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIO;

    dataModel.forEach((elements: any, index: number) => {
      const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];
      const segments: { value: number; scenario: string; dataPoint: DataPoint }[] = [];

      if (isScenarioStack) {
        // Collect non-empty scenario values as segments
        for (const key of scenarioKeys) {
          const dp: DataPoint = elements[key];
          if (dp && !dp.isEmpty() && dp.value != null) {
            segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
          }
        }
      } else {
        // For dimension stacking, scenario1 holds the primary value
        // (dimension-based stacking requires data query changes not yet implemented;
        //  for now, stack scenario1 as a single segment — the SQL decomposition
        //  is handled separately when populateModel detects stackConfig.by as a dimension)
        const dp: DataPoint = elements["scenario1"];
        if (dp && !dp.isEmpty() && dp.value != null) {
          segments.push({ value: dp.value, scenario: dp.scenario as string, dataPoint: dp });
        }
      }

      if (segments.length === 0) return;

      // Sort if requested
      if (this.stackConfig!.order === 'asc') {
        segments.sort((a, b) => a.value - b.value);
      } else if (this.stackConfig!.order === 'desc') {
        segments.sort((a, b) => b.value - a.value);
      }

      // Calculate total for this position
      const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);

      // Draw segments bottom-to-top
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
          stackGroup
        );
        column.draw(this.dataFormatDigits, this.measureScale);
        cumulativeValue += Math.abs(seg.value);
        lastColumn = column;
      });

      // Draw total label above topmost segment
      if (lastColumn) {
        lastColumn.drawTotalLabel(this.dataFormatDigits, this.measureScale);
      }
    });

    this.scenariosArea = {
      height: stackGroup.height() as number + this.styles.padding.top + this.styles.padding.bottom,
      width: stackGroup.width() as number + this.position.spacings.columnWidth
    };
  }

  /**
   * Draw stacked area chart (line mode with stack).
   * Computes cumulative y-values and draws AreaFill paths between layers.
   */
  private drawStackedAreaScenarios(dataModel: any[], svgContainer: Svg): void {
    if (!this.stackConfig) return;

    const areaGroup: G = svgContainer.group().id("StackedAreaScenarios");
    const isScenarioStack = this.stackConfig.by === StackBy.SCENARIO;
    const stackMode = this.stackConfig.mode;
    const scenarioKeys = ["scenario1", "scenario2", "scenario3", "scenario4"];

    // Determine how many layers we have
    const layerCount = isScenarioStack
      ? scenarioKeys.filter(key => dataModel.some((el: any) => el[key] && !el[key].isEmpty())).length
      : 1;

    if (layerCount === 0) return;

    // Build cumulative values per layer
    // cumulativePoints[layerIdx][dataIdx] = cumulative y-value at that point
    const cumulativeValues: number[][] = [];
    const layerScenarios: string[] = [];

    // Identify active layers
    const activeLayers: string[] = [];
    for (const key of scenarioKeys) {
      if (dataModel.some((el: any) => el[key] && !el[key].isEmpty())) {
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
      layerScenarios.push(firstDp?.scenario as string || 'ac1');
    }

    // Convert cumulative values to pixel coordinates
    const axisY = this.position.getColumnPositionY();
    const pixelPerUnit = this.pixelPerUnit;

    const toAreaPoints = (values: number[]): AreaPoint[] => {
      return values.map((val, idx) => ({
        x: this.position.getColumnCenterPositionX(idx),
        y: axisY - (stackMode === StackMode.RELATIVE
          ? val * pixelPerUnit  // pixelPerUnit acts as "height for 100%"
          : val * pixelPerUnit)
      }));
    };

    // Baseline (y = axis)
    const baselinePoints: AreaPoint[] = dataModel.map((_: any, idx: number) => ({
      x: this.position.getColumnCenterPositionX(idx),
      y: axisY
    }));

    // Draw area fills bottom-to-top
    for (let layerIdx = 0; layerIdx < cumulativeValues.length; layerIdx++) {
      const upperPoints = toAreaPoints(cumulativeValues[layerIdx]);
      const lowerPoints = layerIdx === 0 ? baselinePoints : toAreaPoints(cumulativeValues[layerIdx - 1]);

      const scenarioType = isScenarioStack ? layerScenarios[layerIdx] : null;

      const areaFill = new AreaFill(
        areaGroup,
        upperPoints,
        lowerPoints,
        scenarioType,
        layerIdx,
        isScenarioStack
      );
      areaFill.draw();
      areaFill.drawBoundaryLine();
    }

    this.scenariosArea = {
      height: areaGroup.height() as number + this.styles.padding.top + this.styles.padding.bottom,
      width: areaGroup.width() as number + this.position.spacings.columnWidth
    };
  }

  private drawOverlayLayer(dataModel: any, svgContainer: Svg) {
    let overlayGroup: G = svgContainer.group()
      .id("Overlay");

    let scenarioFactory = new ScenarioFactory(this.position, overlayGroup, this.styles, dataModel.length, this.i18n);

    if (this.showOverlayAvg == true) {
      let previousDataPoint: null;

      const avgDataModel = tranformToAvgDataModel(dataModel);

      avgDataModel.forEach((elements: any, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory.createLine(`Ø  ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`, elements["scenario1"], previousDataPoint, index - 1).draw(this.dataFormatDigits, this.measureScale);
        }
        previousDataPoint = elements["scenario1"];

      });
    }

    if (this.showOverlayMedian === true) {

      let previousDataPoint: null;

      const medianDataModel = tranformToMedianDataModel(dataModel);

      medianDataModel.forEach((elements: any, index: number) => {
        if (previousDataPoint != null) {
          scenarioFactory.createLine(`Mdn ${this.i18n.get(elements["scenario1"].scenario as string) || elements["scenario1"].scenario}`, elements["scenario1"], previousDataPoint, index - 1).draw(this.dataFormatDigits, this.measureScale);
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

