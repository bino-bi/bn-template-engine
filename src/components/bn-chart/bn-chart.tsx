import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import {
  isBlankInput,
  isValidDirection,
  isValidLevel,
  isValidNumber,
  validateOrderList,
  validateScenarioList,
  validateVariancesList
} from "../../utils/validate";
import { AggregationLevel, Order, OrderColumn, OrderDirection } from "@bino-bi/ibcs-component-interface";
import {
  BinoChartSyles,
  DataRow
} from "@bino-bi/ibcs-component/dist/types/components/ibcs-chart-structure/utils/model";
import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";

@Component({
  tag: 'bn-chart',
  styleUrl: "bn-chart.scss",
})
export class Chart {
  @Element() private element: HTMLElement;

  @State() data: DataRow[] = []

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T, >(q: (Style) => T) => T;
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
   *    example: <br />```'ac1,pp1,fc1,fc2;dpp1_ac1_neg;dfc1_ac1_neg'```
   */
  @Prop() scenarios!: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    this.scenariosArray = newValue.split(";").map(value => value.trim());
    const invalidScenarios: string[] = validateScenarioList(this.scenariosArray[0]);

    if (invalidScenarios.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.')
    }

    let invalidVariances: string[] = [];

    for (let i = 1; i < this.scenariosArray.length; i++) {
      invalidVariances = invalidVariances.concat(validateVariancesList(this.scenariosArray[i]));
    }

    if (invalidVariances.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidVariances?.toString() + '\' are not supported.')
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
    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      throw new Error('unitScaling: invalid value(s) \'' + newValue + '\' are not supported.')
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
    if (!isValidLevel(newValue)) {
      throw new Error('level: invalid value(s) \'' + newValue + '\' are not supported.')
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
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      throw new Error('order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }


  /** set sorting order direction
   *  <br /><br />
   *  values:<br />
   *  ```asc // desc```
   */
  @Prop() orderDirection!: string;

  /** set translaton mode.
   *  <br /><br />
   *  values:<br />
   *  ``` all // none // meta ```
   */

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }

  }

  private scenariosArray: string[];
  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });
    this.chartTemplate = this.chartTemplate.bind(this);

    this.componentStyle = withComponentStyle(this);
    this.t = withTranslation(this).t;

  }


  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateUnitScaling(this.unitScaling);
    //this.validateStyles(this.styles);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
  }

  prepareDimension(): { height: number, width: number } {
    this.canvasWidthSegmented = this.element.clientWidth / this.scenariosArray.length;
    return { width: this.canvasWidthSegmented, height: this.element.clientHeight };
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenariosArray[0]?.split(",").map(entry => entry.trim());
  }

  private prepareVariances(localScenarioString: string): string[] {
    const isValidateVariancesList: boolean = validateVariancesList(localScenarioString).length == 0;

    if (isValidateVariancesList == false) {
      return null;
    }

    return localScenarioString.split(',');
  }


  private prepareHideCategories(localScenarioString: string): boolean {
    return validateVariancesList(localScenarioString).length == 0;
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = [];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal = new Map(i18nMetaLabelsLocal.map(key => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }


  private preparePixelPerUnit(): Number {
    if (this.pixelPerUnitGroupMap.has(this.unitScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string);
    }

    return Number(this.unitScaling);
  }

  private prepareLevel(): AggregationLevel {
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): Order {
    const tableOrder: Order = {
      hierarchy: this.order.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }

  private prepareStyle(): BinoChartSyles {
    // TODO ScaleFactors in global Constant schiben
    return {
      scaleFactors: {
        barWidthYOffset: 0.95,
        fontNetHeight: 0.7,
        needleWidthOffset: 0.7,
        barHeightOffset: 0.4,
        barWidthOffset: 0.3,
        pt2Px: 1.2,
        axisWidth: 0.1,
        rowHeight: 1.8,
        barWidth: 1.2,
        needleWidth: 0.3,
      },
      fontStyles: {
        font: `${this.componentStyle($ => $["global"]['fontSizePx'])}px ${this.componentStyle($ => $["global"]['fontFamily'])}`,
        size: this.componentStyle($ => $["global"]['fontSizePx']),
        color: "#000000",
        background: "#ffffff",
        leading: 1.8,
      },
      axisStyles: this.componentStyle($ => $["bn-chart"]['axisStyles']),
      barStyles: this.componentStyle($ => $["bn-chart"]['barStyles']),
      varianceStyles: this.componentStyle($ => $["bn-chart"]['varianceStyles']),
      padding: this.componentStyle($ => $["bn-chart"]['padding']),
      pattern: null
    }
  }

  chartTemplate(localScenarioString: string) {
    return <ibcs-chart-structure
      data={this.data}
      scenarios={this.prepareScenarios()}
      variances={this.prepareVariances(localScenarioString)}
      hideCategories={this.prepareHideCategories(localScenarioString)}
      pixelPerUnit={this.preparePixelPerUnit()}
      chartTitle={null}
      styles={this.prepareStyle()}
      i18n={this.prepareI18n()}
      level={this.prepareLevel()}
      order={this.prepareOrder()}
    ></ibcs-chart-structure>
  }

  render() {
    return <Host>
      <div class="container">
        {this.scenariosArray.map(this.chartTemplate)}
      </div>
    </Host>
  }
}
