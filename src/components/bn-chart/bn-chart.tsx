import {Component, Element, h, Host, Prop, State, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import {
  isBlankInput,
  isValidDirection, isValidi18nMode,
  isValidLevel,
  isValidNumber,
  validateI18nString,
  validateOrderList,
  validateScenarioList,
  validateStylesString,
  validateVariancesList
} from "../../utils/validate";
import {AggregationLevel, Order, OrderColumn, OrderDirection} from "@bino-bi/ibcs-component-interface";
import {DataRow} from "@bino-bi/ibcs-component/dist/types/components/ibcs-chart-structure/utils/model";
import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-chart',
  styleUrl: "bn-chart.scss",
})
export class Chart {
  @Element() private element: HTMLElement;

  @State() data: DataRow[] = []

  // @Prop() order?: string;
  // @Prop() orderDirection?: string;

  /**
   * (mandatory) List of Scenarios Map.
   * the position of the scenario is maped to the datasource
   * column scenario1 - scenario4
   *
   * if empty the main chart is hidden
   *
   * Valid scenarios are
   *
   *  values: ac | fc | py | pl  (1-4)
   *  example: ac, ac2, ac3, ac4
   *
   *  list of additonal variances which
   *   are calculated form the given scenarios.
   *   the scenarios used in the variances have also
   *   be defined in the *scenarios* property.
   *
   *   the variance is defiend as  (Scenario A -  SvenarioB)
   *   neg and pos post fix defines which value is *good*
   *   a negative or a positive value.
   *
   *   if empty variance charts are hidden
   *
   *   each variance creates a chart
   *
   *   pattern:  d<scenarioB>_<scenarioA>_[pos|neg]
   */
  @Prop() scenarios!: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    this.scenariosArray = newValue.split(";");
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
   *
   * alternativly a number which represent the
   * pixel per measure unit directy. the
   */
  @Prop() unitScaling!: string;

  @Watch('unitScaling')
  validateUnitScaling(newValue: string) {
    if (!isValidNumber(newValue) && !this.pixelPerUnitGroupMap.has(newValue)) {
      throw new Error('unitScaling: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Determines level on which the chart is aggregated on.
   * valid values are
   *
   * rowcategory, catgeory, subcategory
   * default: category
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
   *
   *  values: category | categoryindex | rowgroup | rowgroup | rowgroupindex | ac | fc | py | pl
   */
  @Prop() order!: string;

  @Watch('order')
  validateOrderList(newValue: string) {
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      throw new Error('order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }


  /** set sorting order directon
   *
   * values: asc | desc
   */
  @Prop() orderDirection!: string;

  /** set translaton mode.
   *
   * values:   all | none | meta
   */

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }

  }

  /**
   *  Mode of Translation,
   *
   *  values: none| meta| all
   *
   *  default: meta
   */
  @Prop() internationalisationMode: string = "meta";

  @Watch('internationalisationMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) {
      throw new Error('internationalisationMode: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  @Prop() internationalisation?: string;
  @Watch('internationalisation')
  validateI18n(newValue: string) {
    if (!validateI18nString(newValue)) {
      throw new Error('internationalisation: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  @Prop() styles?: 'String';

  @Watch('styles')
  validateStles(newValue: string) {
    if (!validateStylesString(newValue)) {
      throw new Error('i18: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  private scenariosArray: string[];
  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });
    this.chartTemplate = this.chartTemplate.bind(this);

    withComponentStatus(this);
  }


  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateUnitScaling(this.unitScaling);
    this.validateStles(this.styles);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validatei18nMode(this.internationalisationMode);
    this.validateI18n(this.internationalisation);
  }

  prepareDimension(): {height: number , width: number} {
    this.canvasWidthSegmented = this.element.clientWidth / this.scenariosArray.length;
    return {width: this.canvasWidthSegmented, height: this.element.clientHeight};
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenariosArray[0]?.split(",").map(entry => entry.trim());
  }

  private prepareVariances(localScenarioString: string):string[] {
   const isValidateVariancesList: boolean = validateVariancesList(localScenarioString).length == 0;

   if (isValidateVariancesList == false) {
     return null;
   }

   return localScenarioString.split(',');
  }


  private prepareHideCategories(localScenarioString: string): boolean{
    return validateVariancesList(localScenarioString).length == 0;
  }

  private prepareI18n(): Map<string, string> {
    return new Map([
      ["title1", "🤩"]
    ]);
  }

  private preparePixelPerUnit(): Number{
    if (this.pixelPerUnitGroupMap.has(this.unitScaling)) {
      return this.pixelPerUnitGroupMap.get(this.unitScaling);
    }

    return Number(this.unitScaling);
  }

  private prepareLevel(): AggregationLevel{
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): Order {
    const tableOrder: Order = {
      hierarchy: this.order.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }


  chartTemplate(localScenarioString: string) {
    return <ibcs-chart-structure
      dimension={this.prepareDimension()}
      data={this.data}
      scenarios={this.prepareScenarios()}
      variances={this.prepareVariances(localScenarioString)}
      hideCategories={this.prepareHideCategories(localScenarioString)}
      pixelPerUnit={this.preparePixelPerUnit()}
      chartTitle={null}
      styles={null}
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

styled(Chart);
