import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import {
  isBlankInput,
  isValidAxisLabelsMode,
  isValidBoolean,
  isValidDateFormat,
  isValidDirection,
  isValidInteger,
  isValidLevel,
  isValidMeasureScale,
  isValidNumber,
  validateOrderList,
  validateScenarioList,
  validateVariancesList
} from "../../utils/validate";


import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import { Formatter } from "@bino-bi/ibcs-component/dist/collection/utils";

import {
  AggregationLevel,
  AxisLabelsMode,
  DateDistance,
  IOrder,
  ITimeChartDataRow,
  ITimeChartStyles,
  OrderColumn,
  OrderDirection
} from "@bino-bi/ibcs-component-interface";

import withHasError, { ErrorDispatcher } from "../../utils/withHasError";


@Component({
  tag: 'bn-chart-time',
  styleUrl: "bn-chart-time.scss",
})
export class Chart {
  @Element() private element: HTMLElement;

  @State() data: ITimeChartDataRow[] = []

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T, >(q: (Style) => T) => T;
  private readonly errors: ErrorDispatcher;

  /**
   * Custom chart title
   */
  @Prop()
  chartTitle: string = "";


  @Prop()
  filter: string = "";


  /**
   * List of Scenarios Map.
   *<br /> <br />
   * per chart there are up to 4 different scenarios supported.
   * The first 4 scenarios in the list are used, the rest ignored.
   *
   *<br /> <br />
   *  values:<br /> ```ac // fc // pp // pl  [1-4]```
   *  example:<br /> ```ac1,ac2,ac3,ac4```
   *
   */
  @Prop() scenarios!: string;
  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    const errId: string = 'ERR_scenarios';

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * List of Variance Map.
   *<br /> <br />
   *   Variance chart can be added by seperating the scenarios
   *   of each chart with ```;```<br />
   *   The additonal variances which
   *   are calculated form the given scenarios.
   *   the scenarios used in the variances have also
   *   be defined in the *scenarios* property.
   *<br /> <br />
   *   the variance is defiend as  (Scenario A -  ScenarioB)
   *   neu. neg and pos post fix defines which value is *good*
   *   a negative or a positive value.
   *<br /> <br />
   *   if empty variance charts are hidden
   *<br /> <br />
   *   each variance creates a chart
   *<br /> <br />
   *   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```
   *
   *    example: <br />```'dpp1_ac1_neg,dfc1_ac1_neg'```
   */
  @Prop() variances!: string;

  @Watch('variances')
  validateVariances(newValue: string) {

    const errIdVar: string = 'ERR_variances';
    let invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({
        id: errIdVar,
        type: 'warning',
        message: 'variances: invalid value(s) \'' + invalidVariances?.toString() + '\' are not supported.'
      });
    } else {
      this.errors.remove(errIdVar);
    }
  }

  @Prop() syncSpaceLeft: number = -1;

  @Watch('syncSpaceLeft')
  validateLeftSync(newValue: string | number) {
    const errId: string = 'ERR_syncSpaceLeft';

    if (!isValidNumber(newValue as number)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'syncSpaceLeft: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }


  /**
   * Set the maximum number of columns stacks The value 0 means *no limit*
   * <br /><br />
   *
   * columns stacks wich where cut by the limit are cumulated as REST
   *
   */
  @Prop() limit: number = 0;

  @Watch('limit')
  validateLimit(newValue: number) {
    const errId: string = 'ERR_limit';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'limit: invalid value \'' + newValue?.toString() + '\' is not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Name of the 'scaling-group' which the chart uses
   * scalig groups are maintained globaly
   * <br /> <br />
   * alternativly a number which represent the
   * pixel per measure unit.
   */
  @Prop() unitScaling!: string | number;

  @Watch('unitScaling')
  validateUnitScaling(newValue: string | number) {
    const errId: string = 'ERR_unitScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'unitScaling: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Name of the 'scaling-group' which the chart uses
   * scalig groups are maintained globaly
   * <br /> <br />
   * alternativly a number which represent the
   * pixel per percentage.
   */
  @Prop() percentageScaling!: string | number;

  @Watch('percentageScaling')
  validatePercentageScaling(newValue: string | number) {
    const errId: string = 'ERR_percentageScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'percentageScaling: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Determines level on which the chart is aggregated on.
   * <br /> <br />
   *
   * values:<br/>
   * ``` rowcategory // category // subcategory ```
   * <br /> <br />
   *
   */
  @Prop() level!: string;

  @Watch('level')
  validateLevel(newValue: string) {
    const errId: string = 'ERR_level';

    if (!isValidLevel(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'level: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *  <br /><br />
   *  values:<br />
   *  ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac[1-4] // fc[1-4] // py[1-4] // pl[1-4] ```
   */
  @Prop() order!: string;

  @Watch('order')
  validateOrderList(newValue: string) {
    const errId: string = 'ERR_order';
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }


  /** set sorting order direction
   *  <br /><br />
   *  values:<br />
   *  ```asc // desc```
   */
  @Prop() orderDirection!: string;

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    const errId: string = 'ERR_orderDirection';

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** Axis Date Interval
   *  <br /><br />
   *  values:<br />
   *  ```year// quarter // month // week // day // hour // minute // second // millisecond // auto```
   */
  @Prop() dateInterval!: string;

  

  @Watch('dateInterval')
  validateDateInterval(newValue: string) {
    const errId: string = 'ERR_dateInterval';

    if (!isValidDateFormat(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'dateInterval: invalid value \'' + newValue?.toString() + '\' is not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

   /** Chart Type
   *  <br /><br />
   *  values:<br />
   *  ```bar// line / area```
   */
   @Prop() type: string = "bar";
 

   @Watch('type')
   validateChartType(newValue: string) {
     const errId: string = 'ERR_chartType';
     console.log("newValue", newValue, errId);
     /*if (!isValidateType(newValue)) {
       this.errors.addOrReplace({
         id: errId,
         type: 'warning',
         message: 'dateInterval: invalid value \'' + newValue?.toString() + '\' is not supported.'
       });
     } else {
       this.errors.remove(errId);
     }*/
   }
 

  /** Max number of collumns
   *  is used to calculate Axis Date Interval (if dateInterval is set to AUTO)
   */
  @Prop()
  intervalSpanLimit: number = 28;

  /** Axis Labels Mode defines in which mode the labels are rendered.
   *  long, and short mode uses the long an short styles for the date
   *  smart only displays relevant information if a change/ transition occured
   *  (eg.  only on 1.Jan  the year is displayed)
   *  <br /><br />
   *  values:<br />
   *  ```smart // long // short```
   */
  @Prop() axisLabelsMode!: string;

  @Watch('axisLabelsMode')
  validateAxisLabelsMode(newValue: string) {
    const errId: string = 'ERR_axisLabelsMode';

    if (!isValidAxisLabelsMode(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'axisLabelsMode: invalid value \'' + newValue?.toString() + '\' is not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  @Prop() showCategories: string = 'true';

  @Watch('showCategories')
  validateShowCategories(newValue: string) {
    const errId: string = 'ERR_showCategories';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showCategories: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


    /**
   *  Sets the SiPrefix of the Mesaurements and converts the
   *  original value.
   *  <br /><br />
   *  values:  <br />
   *  ```_ // k // M // G // T // P // E // Z // Y // m // μ // n // p // P // f // a // z // y // GREATEST // LEAST```
   *  <br /><br />
   *  SiPrefix overview:
   *  ```     "Y":  1E+24,```<br />
   *  ```    "Z":  1E+21,```<br />
   *  ```   "E":  1E+18,```<br />
   *  ```     "P":  1E+15,```<br />
   *  ```     "T":  1E+12,```<br />
   *  ```     "G":  1000000000,```<br />
   *  ```     "M":  1000000,```<br />
   *  ```     "k":  1000,```<br />
   *  <br />
   *  ```     "m":  0.001,```<br />
   *  ```    "μ":  0.000001,```<br />
   *  ```     "n":  0.000000001,```<br />
   *  ```     "p":  0.000000000001,```<br />
   *  ```     "f":  0.000000000000001,```<br />
   *  ```     "a":  0.000000000000000001,```<br />
   *  ```     "z":  0.000000000000000000001,```<br />
   *  ```     "y":  0.000000000000000000000001,```<br />
   *  <br /><br />
   * Special modes:
   * ```GREATEST``` seaches for the bigest (farest to zero) Value in the dataset and sets this value to SiPrefix<br />
   * ```LEAST```    searches for smallest (closest to zero) Value in the dataset and sets this value to SiPrefix<br />
   *<br /><br />
   * ```_```        is the value for no SiPrefix the value is displayed as in the dataset stored.
   *
   *
   */
   @Prop() measureScale: string = "greatest";

   @Watch('measureScale')
   validateMeasureScale(newValue: string) {
     const errId: string = 'ERR_measureScale';
  
     if (!isValidMeasureScale(newValue)) {
       this.errors.addOrReplace({ id: errId, type: 'warning', message: 'measureScale: invalid value \'' + newValue?.toString() + '\' is not supported.' });
     } else {
       this.errors.remove(errId);
     }
   }
 
   /**
    *  Toggles display of measure units in table header
    *  <br /><br />
    *  values: <br />
    *  ```true // false```
    */
   @Prop() showMeasureScale: string = 'false';
 
   @Watch('showMeasureScale')
   validateShowMeasureScale(newValue: string) {
      const errId: string = 'ERR_grouped';
      
       if (!isValidBoolean(newValue)) {
           this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showMeasureScale: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
       } else {
           this.errors.remove(errId);
       }
   }
 
    /**
    * measureUnit displayed in table.
    */
   @Prop() measureUnit: string = "";
  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });
    this.chartTemplate = this.chartTemplate.bind(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
    this.t = withTranslation(this).t;

  }


  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateUnitScaling(this.unitScaling);
    this.validateLimit(this.limit);
    // this.validateStyles(this.styles);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateLeftSync(this.syncSpaceLeft);
    this.validateDateInterval(this.dateInterval);
    this.validateAxisLabelsMode(this.axisLabelsMode);
    this.validateChartType(this.type);
    this.validateShowCategories(this.showCategories);
    this.validateMeasureScale(this.measureScale);
    this.validateShowMeasureScale(this.showMeasureScale);
  }

  prepareDimension(): { height: number, width: number } {
    this.canvasWidthSegmented = this.element.clientWidth / [...this.scenarios.split(','), ...this.variances.split(',')].length;
    return { width: this.canvasWidthSegmented, height: this.element.clientHeight };
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareVariances(): string[] {
    if (isBlankInput(this.variances)) {
      return [];
    }
    return this.variances?.split(",").map(entry => entry.trim());
  }


  private prepareHideAxisLabels(localScenarioString: string): boolean {
    return localScenarioString.length != 0 || this.showCategories != "true";
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = [];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal = new Map(i18nMetaLabelsLocal.map(key => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }


  private preparePixelPerUnit(): number {
    if (this.pixelPerUnitGroupMap.has(this.unitScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string);
    }
    return Number(this.unitScaling);
  }

  private preparePixelPerPercentage(): number {
    if (this.pixelPerUnitGroupMap.has(this.percentageScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.percentageScaling as string); // TODO: check if this is correct '* 100' or not if global scaling groups are implemented (JHE)
    }

    return Number(this.percentageScaling) * 100;
  }

  private prepareLevel(): AggregationLevel {
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): IOrder {
    let entryValue = this.level;
    if (this.order.toLocaleLowerCase() === "levelindex") {
      entryValue += "Index";
    }
    const tableOrder: IOrder = {
      hierarchy: [OrderColumn[entryValue?.toUpperCase() as keyof typeof OrderColumn]],
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }

  private prepareStyle(): ITimeChartStyles {
    return this.componentStyle($ => {
      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-time"]['scaleFactors']['scenarioOffset'],
          scenarioLabelToColumn: $["bn-chart-time"]['scaleFactors']['scenarioLabelToColumn'],
          labelToColum: $["bn-chart-time"]['scaleFactors']['labelToColum'],
          labelToAxis: $["bn-chart-time"]['scaleFactors']['labelToAxis'],
          needleWidth: $["bn-chart-time"]['scaleFactors']['needleWidth'],
          needleHeadWidth: $["bn-chart-time"]['scaleFactors']['needleHeadWidth'],
          columnWidth: $["bn-chart-time"]['scaleFactors']['columnWidth'],
          varianceAxisLineWidth: $["bn-chart-time"]['scaleFactors']['varianceAxisLineWidth'],
          axisLineWidth: $["bn-chart-time"]['scaleFactors']['axisLineWidth'],
          auxiliaryLineWidth: $["bn-chart-time"]['scaleFactors']['auxiliaryLineWidth'],
          scenarioLineWidth: $["bn-chart-time"]['scaleFactors']['scenarioLineWidth'],
          markerWidth: $["bn-chart-time"]['scaleFactors']['markerWidth'],
          markerOffset: $["bn-chart-time"]['scaleFactors']['markerOffset'],
          categoryWidth: $["bn-chart-time"]['scaleFactors']['categoryWidth'],
          axisTickLength: $["bn-chart-time"]['scaleFactors']['axisTickLength'],
        },
        fontStyles: {
          font: `${$["global"]['fontSizePx']}px ${$["global"]['fontFamily']}`,
          size: $["global"]['fontSizePx'],
          color: $["global"]['fontColor'],
          background: $["global"]['fontBackgroundColor'],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-time"]['axisStyles'],
        barStyles: $["bn-chart-time"]['barStyles'],
        varianceStyles: $["bn-chart-time"]['varianceStyles'],
        padding: $["bn-chart-time"]['padding'],
        pattern: null
      }
    });
  }

  private prepareLeftSideOffset(preparedI18n: Map<string, string>, preparedStyle: ITimeChartStyles): number {

    
    if (this.syncSpaceLeft > -1) {     
      return this.syncSpaceLeft;
    }

    let leftSideOffset: number = Formatter.getMaxWidthOfArrayItems([...this.prepareVariances(), ...this.prepareScenarios(), this.chartTitle], preparedI18n, preparedStyle);

    //if(leftSideOffset < this.syncSpaceLeft) {
    //  return this.syncSpaceLeft;
    //}

    return leftSideOffset;
  }

  private prepareChartTitle(localScenarioString: string): string {
    if (localScenarioString.length != 0) {
      return '';
    }

    return this.chartTitle;
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareDateInterval(): DateDistance {
    return DateDistance[this.dateInterval?.toUpperCase() as keyof typeof DateDistance];
  }

  private prepareIntervalSpanLimit(): number {
    return this.intervalSpanLimit;
  }

  private prepareAxisLabelsMode(): AxisLabelsMode {
    return AxisLabelsMode[this.axisLabelsMode?.toUpperCase() as keyof typeof AxisLabelsMode];
  }

  
  private prepareFilter(): string {
    if (this.filter.length == 0) {
      return '';
    }

    return this.filter;
  }



  private prepareChartType() {
    return this.type;
  }

  public getDataStructure(): any {
    let dataSetStructure: any = {
      ITimeChartDataRow: {
        setName: { type: "string", isOptional: false, description: "" },
        date: { type: "string", isOptional: false, description: "" },
        operation: { type: "string", isOptional: false, description: "" },
        rowGroup: { type: "string", isOptional: false, description: "" },
        rowGroupIndex: { type: "number", isOptional: false, description: "" },
        category: { type: "string", isOptional: false, description: "" },
        categoryIndex: { type: "number", isOptional: false, description: "" },
        subCategory: { type: "string", isOptional: false, description: "" },
        subCategoryIndex: { type: "number", isOptional: false, description: "" },
        columnGroup: { type: "string", isOptional: false, description: "" },
        columnGroupIndex: { type: "number", isOptional: false, description: "" },
        columnSubGroup: { type: "string", isOptional: false, description: "" },
        columnSubGroupIndex: { type: "number", isOptional: false, description: "" },
        ac1: { type: "number", isOptional: false, description: "" },
        ac2: { type: "number", isOptional: false, description: "" },
        ac3: { type: "number", isOptional: false, description: "" },
        ac4: { type: "number", isOptional: false, description: "" },
        pp1: { type: "number", isOptional: false, description: "" },
        pp2: { type: "number", isOptional: false, description: "" },
        pp3: { type: "number", isOptional: false, description: "" },
        pp4: { type: "number", isOptional: false, description: "" },
        fc1: { type: "number", isOptional: false, description: "" },
        fc2: { type: "number", isOptional: false, description: "" },
        fc3: { type: "number", isOptional: false, description: "" },
        fc4: { type: "number", isOptional: false, description: "" },
        pl1: { type: "number", isOptional: false, description: "" },
        pl2: { type: "number", isOptional: false, description: "" },
        pl3: { type: "number", isOptional: false, description: "" },
        pl4: { type: "number", isOptional: false, description: "" },
      }
    };

    return dataSetStructure;
  }

  private prepareMeasureScale(): string {
    if (isBlankInput(this.measureScale)) {
      return "GREATEST";
    }

    if (['_', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'm', 'μ', 'n', 'p', 'P', 'f', 'a', 'z', 'y'].includes(this.measureScale.trim())) {
      return this.measureScale.trim();
    }

    if (this.measureScale.trim().toUpperCase() === 'LEAST') {
      return this.measureScale.trim();
    }

    return "GREATEST";
  }

  prepareShowMeasureScale(): boolean {
    return (this.showMeasureScale == "true");
  }
  prepareMeasureUnit(): string {
      if (this.measureUnit == "" || this.measureUnit == null) {
        return "";
      }
      return this.measureUnit;
  }

  chartTemplate(localScenarioString: string) {
    let preparedI18n: Map<string, string> = this.prepareI18n();
    let preparedStyle: ITimeChartStyles = this.prepareStyle();

    return <ibcs-chart-time
      data={this.data}
      chartTitle={this.prepareChartTitle(localScenarioString)}
      scenarios={this.prepareScenarios()}
      variances={[localScenarioString]}
      hideAxisLabels={this.prepareHideAxisLabels(localScenarioString)}
      pixelPerUnit={this.preparePixelPerUnit()}
      pixelPerPercentage={this.preparePixelPerPercentage()}
      limit={this.prepareLimit()}
      leftSideOffsetForHorizontalSync={this.prepareLeftSideOffset(preparedI18n, preparedStyle)}
      styles={preparedStyle}
      i18n={preparedI18n}
      order={this.prepareOrder()}
      level={this.prepareLevel()}
      dateInterval={this.prepareDateInterval()}
      intervalSpanLimit={this.prepareIntervalSpanLimit()}
      axisLabelsMode={this.prepareAxisLabelsMode()}
      type={this.prepareChartType()}
      filter={this.prepareFilter()}
      measure-scale={this.prepareMeasureScale()}
      measure-unit={this.prepareMeasureUnit()}
      showMeasureScale={this.prepareShowMeasureScale()}
    ></ibcs-chart-time>
  }
 

  render() {
    let scenariosArray = [''];
    let variancesArray = this.prepareVariances();
    if (variancesArray.length > 0) {
      scenariosArray = [...scenariosArray, ...variancesArray];
    }


    return <Host>
      <div class="container">
        {scenariosArray.map(this.chartTemplate)}
      </div>
    </Host>
  }


}
