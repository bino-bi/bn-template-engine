import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import {
  isBlankInput, isValidBoolean, isValidDirection, isValidInteger,
  isValidLevel,
  isValidMeasureScale,
  isValidNumber,
  validateOrderList,
  validateScenarioList,
  validateStackConfig,
  validateVariancesList
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { getParentDimensions, ParentDimensions } from "../../utils/parentDimensions";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { Style } from "../../stores/componentStyles";
import { StructureChartDataRow} from "./utils/model";
import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed } from "./utils/model/StructureChartComponentConfig";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";

@Component({
  tag: 'bn-chart-structure',
  styleUrl: "bn-chart-structure.scss",
  shadow: true
})
export class Chart {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
    @Element() private element: HTMLElement;

  @State() data: StructureChartDataRow[] = []
  @State() private datasetMeta: DatasetMeta | null = null;

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T, >(q: (style: Style) => T) => T;
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
   *  values:<br /> ```ac // fc // pp // pl  [1-4] // auto```
   *  example:<br /> ```ac1,ac2,ac3,ac4```
   *<br /> <br />
   *  When set to ```auto```, scenarios are detected from the dataset silently.
   *  When left blank, scenarios are detected from the dataset with a warning.
   *
   */
  @Prop() scenarios!: string;
  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    const errId: string = 'ERR_scenarios';

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'scenarios: invalid value(s) \'' + JSON.stringify(invalidScenarios) + '\' are not supported.' });
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
      this.errors.addOrReplace({ id: errIdVar, type: 'warning', message: 'variances: invalid value(s) \'' + JSON.stringify(invalidVariances) + '\' are not supported.' });
    } else {
      this.errors.remove(errIdVar);
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'unitScaling: invalid value(s) \'' + newValue + '\' are not supported.' });
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'percentageScaling: invalid value(s) \'' + newValue + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Determines level on which the chart is aggregated on.
   * <br /> <br />
   *
   * values:<br/>
   * ``` rowcategory // category // subcategory // auto```
   * <br /> <br />
   *  When set to ```auto```, level is detected from the dataset silently.
   *  When left blank, level is detected from the dataset with a warning.
   *
   */
  @Prop() level!: string;

  @Watch('level')
  validateLevel(newValue: string) {
    const errId: string = 'ERR_level';

    if (!isValidLevel(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'level: invalid value(s) \'' + newValue + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /** List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *  <br /><br />
   *  values:<br />
   *  ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac[1-4] // fc[1-4] // py[1-4] // pl[1-4] // auto```
   *  <br /><br />
   *  When set to ```auto```, order is detected from the dataset silently.
   *  When left blank, order is detected from the dataset with a warning.
   */
  @Prop() order!: string;

  @Watch('order')
  validateOrderList(newValue: string) {
    const invalidElements: string[] = validateOrderList(newValue);
    const errId: string = 'ERR_order';

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'order: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.' });
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
    }

  }
  /** set translaton mode.
   *  <br /><br />
   *  values:<br />
   *  ``` all // none // meta ```
   */

  /**
   * Set the maximum number of bars for each
   * group. The value 0 means *no limit*
   * <br /><br />
   * rows wich where cut by the limit are cumulated as REST
   *
   */
  @Prop() limit: number = 0;

  @Watch('limit')
  validateLimit(newValue: number) {
    const errId: string = 'ERR_limit';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'limit: invalid value \'' + newValue?.toString() + '\' is not supported.' });
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

  /**
   * Stacking configuration for the chart as a JSON string.
   *
   * When set, bars are drawn stacked (additive layers) instead of side-by-side.
   *
   * @default '' (empty — no stacking)
   * @example stack='{"by":"scenario"}'
   */
  @Prop() stack: string = '';

  @Watch('stack')
  validateStack(newValue: string) {
    const errId: string = 'ERR_stack';
    const errors = validateStackConfig(newValue);

    if (errors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: errors.join('; ')
      });
    } else {
      this.errors.remove(errId);
    }
  }

  private scenariosArray: string[] = [''];
  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    withDataset(this, (_name, data) => {
      this.data = data || [];
    }, (_name, meta) => {
      this.datasetMeta = meta;
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
    //this.validateSelectedStyle(this.selectedStyle);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateShowCategories(this.showCategories);
    this.validateMeasureScale(this.measureScale);
    this.validateShowMeasureScale(this.showMeasureScale);
    this.validateStack(this.stack);
  }

  componentDidRender() {
    const parent = getParentDimensions(this.element);
    const errId = 'WARN_overflow';
    if (parent.width > 0 && this.element.scrollWidth > parent.width + 1) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'Chart exceeds available space and will be cut off. Check unit-scaling value.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  prepareDimension(): ParentDimensions {
    const parent = getParentDimensions(this.element);
    this.canvasWidthSegmented = parent.width / this.scenariosArray.length;
    return { width: this.canvasWidthSegmented, height: parent.height };
  }

  private prepareScenarios(): string[] {
    const isAuto = this.scenarios?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.scenarios) || isAuto) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_scenarios', type: 'warning',
            message: `scenarios: not set, auto-detected: ${this.datasetMeta.availableScenarios.join(',')}`
          });
        } else {
          this.errors.remove('AUTO_scenarios');
        }
        return this.datasetMeta.availableScenarios;
      }
      return [];
    }
    this.errors.remove('AUTO_scenarios');
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareVariances(): string[] {
    if (isBlankInput(this.variances)) {
      return [];
    }
    return this.variances?.split(",").map(entry => entry.trim());
  }


  private prepareHideCategories(idx: number): boolean {   
    return idx >= 1 || this.showCategories != "true";
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
      this.errors.remove('AUTO_unitScaling');
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string);
    }

    // Explicit 'auto' → auto-calculate silently
    if ((this.unitScaling as string)?.toString().trim().toLowerCase() === 'auto') {
      this.errors.remove('AUTO_unitScaling');
      return 0;
    }

    const numeric = Number(this.unitScaling);
    if (!isNaN(numeric) && numeric > 0) {
      this.errors.remove('AUTO_unitScaling');
      return numeric;
    }

    // Not set / invalid → auto-calculate with warning
    this.errors.addOrReplace({
      id: 'AUTO_unitScaling',
      type: 'warning',
      message: `unit-scaling: not set, auto-calculated to fit available space.`
    });
    return 0;
  }

  private preparePixelPerPercentage(): number {
    if (this.pixelPerUnitGroupMap.has(this.percentageScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.percentageScaling as string); // TODO: check if this is correct '* 100' or not if global scaling groups are implemented (JHE)
    }

    return Number(this.percentageScaling) * 100;
  }

  private prepareLevel(): AggregationLevel {
    const isAuto = this.level?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.level) || isAuto) {
      if (this.datasetMeta?.suggestedLevel) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_level', type: 'warning',
            message: `level: not set, auto-detected: ${this.datasetMeta.suggestedLevel}`
          });
        } else {
          this.errors.remove('AUTO_level');
        }
        return AggregationLevel[this.datasetMeta.suggestedLevel.toUpperCase() as keyof typeof AggregationLevel];
      }
      return undefined;
    }
    this.errors.remove('AUTO_level');
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): Order {
    const isAuto = this.order?.trim().toLowerCase() === 'auto';
    let orderStr: string;
    if (isBlankInput(this.order) || isAuto) {
      if (this.datasetMeta?.suggestedOrder) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_order', type: 'warning',
            message: `order: not set, auto-detected: ${this.datasetMeta.suggestedOrder}`
          });
        } else {
          this.errors.remove('AUTO_order');
        }
        orderStr = this.datasetMeta.suggestedOrder;
      } else {
        orderStr = this.order;
      }
    } else {
      this.errors.remove('AUTO_order');
      orderStr = this.order;
    }

    const tableOrder: Order = {
      hierarchy: orderStr?.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }
  // TODO: FIXME:  Adapter pattenr doch noch verschieben?
  private prepareStyle(): any {
    return this.componentStyle($ => {
     
      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-structure"]['scaleFactors']['scenarioOffset'],
          scenarioLabelToBar: $["bn-chart-structure"]['scaleFactors']['scenarioLabelToBar'],
          labelToBar: $["bn-chart-structure"]['scaleFactors']['labelToBar'],
          labelToAxis: $["bn-chart-structure"]['scaleFactors']['labelToAxis'],
          needleWidth: $["bn-chart-structure"]['scaleFactors']['needleWidth'],
          needleHeadWidth: $["bn-chart-structure"]['scaleFactors']['needleHeadWidth'],
          barWidth: $["bn-chart-structure"]['scaleFactors']['barWidth'],
          varianceAxisLineWidth: $["bn-chart-structure"]['scaleFactors']['varianceAxisLineWidth'],
          axisLineWidth: $["bn-chart-structure"]['scaleFactors']['axisLineWidth'],
          auxiliaryLineWidth: $["bn-chart-structure"]['scaleFactors']['auxiliaryLineWidth'],
          scenarioLineWidth: $["bn-chart-structure"]['scaleFactors']['scenarioLineWidth'],
          markerWidth: $["bn-chart-structure"]['scaleFactors']['markerWidth'],
          markerOffset: $["bn-chart-structure"]['scaleFactors']['markerOffset'],
          categoryWidth: $["bn-chart-structure"]['scaleFactors']['categoryWidth'],
          axisTickLength: $["bn-chart-structure"]['scaleFactors']['axisTickLength'],
        },
        fontStyles: {
          font: `${$["global"]['fontSizePx']}px ${$["global"]['fontFamily']}`,
          size: $["global"]['fontSizePx'],
          color: $["global"]['fontColor'],
          background: $["global"]['fontBackgroundColor'],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-structure"]['axisStyles'],
        barStyles: $["bn-chart-structure"]['barStyles'],
        varianceStyles: $["bn-chart-structure"]['varianceStyles'],
        padding: $["bn-chart-structure"]['padding'],
        pattern: null
      }
    });
  }

  private prepareChartTitle(idx: number): string {
    if (idx >= 1) {
      return '';
    }

    return this.chartTitle;
  }

  private prepareStackConfig(): StackConfigParsed | null {
    if (isBlankInput(this.stack)) {
      return null;
    }
    try {
      const parsed = JSON.parse(this.stack);
      return {
        by: parsed.by as StackBy,
        mode: (parsed.mode as StackMode) || StackMode.ABSOLUTE,
        order: (parsed.order as StackOrder) || StackOrder.DATASET,
      };
    } catch {
      return null;
    }
  }

  private prepareFilter(): string {
    if (this.filter.length == 0) {
      return '';
    }

    return this.filter;
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  public getDataStructure(): any {
    let dataSetStructure: any = {
      IStructureChartDataRow: {
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

  prepareShowMeasureScale(idx: number): boolean {
    return idx == 0 && this.showMeasureScale == "true";   
  }
  prepareMeasureUnit(): string {
      if (this.measureUnit == "" || this.measureUnit == null) {
        return "";
      }
      return this.measureUnit;
  }

  chartTemplate(localScenarioString: string, idx: number) {   

    return <ibcs-chart-structure
      data={this.data}
      chartTitle={this.prepareChartTitle(idx)}
      scenarios={this.prepareScenarios()}
      variances={[localScenarioString]}
      hideCategories={this.prepareHideCategories(idx) }
      pixelPerUnit={this.preparePixelPerUnit()}
      pixelPerPercentage={this.preparePixelPerPercentage()}
      limit={this.prepareLimit()}
      styles={this.prepareStyle()}
      i18n={this.prepareI18n()}
      order={this.prepareOrder()}
      level={this.prepareLevel()}
      filter={this.prepareFilter()}
      measure-scale={this.prepareMeasureScale()}
      measure-unit={this.prepareMeasureUnit()}
      showMeasureScale={this.prepareShowMeasureScale(idx)}
      stackConfig={this.prepareStackConfig()}
      parentDimensions={this.prepareDimension()}
    ></ibcs-chart-structure>
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle($ => ({
      '--bn-font-family': $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      '--bn-font-size': `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      '--bn-font-color': $["global"]?.["fontColor"] || '#000000',
      '--bn-font-background': $["global"]?.["fontBackgroundColor"] || '#ffffff',
    }));
  }

  render() {
    let scenariosArray = [''];
    let variancesArray = this.prepareVariances();

    if (variancesArray.length > 0) {
      scenariosArray = [...scenariosArray, ...variancesArray];
    }

    const fontStyles = this.getFontStyles();

    return <Host style={fontStyles}>
      <div class="container">
        {scenariosArray.map(this.chartTemplate)}
      </div>
    </Host>
  }
}
