//import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import {Component, h, Host, Prop, State, Watch} from "@stencil/core";

import {
  isBlankInput,
  isValidDate,
  isValidDateFormat,
  isValidDateLink,
  isValidDirection,
  validateMeasureList,
  validateScenarioList,
} from "../../utils/validate";


import {
  DateDistance,
  DateLink,
  I18nMode,
  MeasureEntry,
  IOrder,
  OrderDirection,
  TimePeriod
} from "@bino-bi/ibcs-component-interface";

import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import {globalLabelKeys} from "../../stores/internationalization";
import {withStyled} from "../../utils/styled/withStyled";


@Component({
  tag: 'bn-title',
  styleUrl: 'bn-title.scss',
})


export class Title {
  private readonly t: (key: string, data?: object) => string;

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.t = withTranslation(this).t;

    }

  /** Name of the business unit displayed in card header. If empty string (`''` or `null`) the business unit row is omitted */
  @Prop() readonly businessUnit: string = '';


  /** List of scenarios displayed in card header.
   *  <br /><br />
   *  If scenarios is empty string (`''` or `null`) the scenarios are omitted
   *  <br /><br />
   *  values:<br /> ```ac // fc // py // pl // null```
   */
  @Prop() readonly scenarios: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios?.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.')
    }
  }


  /** List of the primary scenarios on which the order direction are applied.
   *  <br /><br />
   *  If order is set to a scenario it has also exists in scenariolist.<br />
   *  If order is empty string (`''` or `null`) the order arrow is omitted
   *  <br /><br />
   *  values:<br /> ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac // fc // py // pl // null ```
   */
  @Prop() readonly order: string = 'category';

  @Watch('order')
  validateOrder(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios?.length > 0) {
      throw new Error('order: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.')
    }
  }


  /** Sets sorting order directon
   *  <br /><br />
   *  values:<br /> ``` asc // desc ```
   */
  @Prop() readonly orderDirection: string = 'asc';

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


  /** Stringified Array of measure objects {name: string, unit: string}
   *  <br /><br />
   *  If all units are the same the redundant units will be reduced and names concatenated.<br />
   *  If unit is empty string (`''` or `null`) the row is omitted
   *  <br /><br />
   *  example:<br /> ``` [{"name": "Bruttoumsatz", "unit": "mEUR"}] ```
   */
  @Prop() readonly measures: string;

  @Watch('measures')
  validateMeasures(newValue: string) {
    const invalidMeasures: string[] = validateMeasureList(newValue);
    if (invalidMeasures?.length > 0) {
      throw new Error('measures: invalid value \'' + invalidMeasures + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]')
    }
  }

  /** String of start date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateStart: string;

  @Watch('dateStart')
  validateDateStart(newValue: string) {
    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateStart: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


  /** String of end date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateEnd: string;

  @Watch('dateEnd')
  validateDateEnd(newValue: string) {
    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateEnd: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }

  /** Date format
   *  <br /><br />
   *  values:<br /> ``` year // quarter // month // week // day // hour // auto // none ```
   *  <br /><br />
   *
   *  detail:<br />
   *  ```year: "YYYY"```<br />
   *  ```quarter:  "Q[Q] YYYY"```<br />
   *  ```month: "MMM YYYY"```<br />
   *  ```week: "[KW]WW YYYY"```<br />
   *  ```day: "DD.MM.YYYY"```<br />
   *  ```time: "DD.MM.YYYY HH:mm:ss"```<br />
   *  ```none: "DD.MM.YYYY"```<br />
   *
   */
  @Prop() readonly dateFormat: string = 'none';

  @Watch('dateFormat')
  validateDateFormat(newValue: string) {
    if (!isValidDateFormat(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateFormat: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


  /** Format in which the start and end date are linked.
   *  <br /><br />
   * If empty string (`''` or `null`) the date row is omitted
   * <br /><br />
   *  values:<br /> ``` avg // interval // cum // start // end // ytd // ytg // cum // mat // none // null```
   *  <br /><br />
   *
   *  detail:<br />
   *  ```avg: "Ø[DATE]"```<br />
   *  ```interval: "[DATE]..[DATE2]"```<br />
   *  ```start: ".[DATE]"```<br />
   *  ```end: "[DATE]."```<br />
   *  ```ytd: "_[DATE]"```<br />
   *  ```ytg: "[DATE]_"```<br />
   *  ```cum: "[DATE]_[DATE2]"```<br />
   *  ```mat: "~[DATE]"```<br />
   *  ```none: "[DATE]"```<br />
   *
   */
  @Prop() readonly dateLink: string = 'none';

  @Watch('dateLink')
  validateDateLink(newValue: string) {
    if (!isValidDateLink(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateLink: invalid value \'' + newValue.toString() + '\' is not supported.')
    }
  }

  @State() readonly datasource: any

  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateMeasures(this.measures);
    this.validateDateStart(this.dateStart);
    this.validateDateEnd(this.dateEnd);
    this.validateDateFormat(this.dateFormat);
    this.validateDateLink(this.dateLink);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrder(this.order);
  }

  scopedEval = (scope, script) => {
    try {
      return Function(`"use strict"; try { return ${script} } catch { return ""}`).bind(scope)();
    } catch (e) {
      console.error("bn-text", e)
    }
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["SEPERATOR_WS", "in", "CONNECTOR_WS"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal  = new Map(i18nMetaLabelsLocal.map(key  => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return  new Map([...i18nMapGlobal.entries(),...i18nMapLocal.entries()]);
  }

  private prepareI18nMode(): I18nMode {
    return I18nMode.META;
  }

  private prepareTitleOrder(): IOrder {
    if (isBlankInput(this.order) || isBlankInput(this.orderDirection)) {
      return null;
    }

    return {
      hierarchy: this.order.split(",").map(entry => entry.trim()),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };
  }

  private prepareTitleTimePeriod(): TimePeriod | null {
    if (isBlankInput(this.dateStart) && isBlankInput(this.dateEnd)) {
      return null;
    }
    if (isBlankInput(this.dateLink)) {
      return null;
    }

    return {
      start: new Date(this.dateStart),
      end: new Date(this.dateEnd),
      format: DateDistance[this.dateFormat?.toUpperCase() as keyof typeof DateDistance],
      link: DateLink[this.dateLink?.toUpperCase() as keyof typeof OrderDirection],
    };
  }

  private prepareMeasures(): MeasureEntry[] {
    if (isBlankInput(this.measures)) {
      return [];
    }
    return JSON.parse(this.measures) as MeasureEntry[];
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareBusinessUnit(): string {
    if (isBlankInput(this.businessUnit) || this.businessUnit == "null") {
      return null;
    }
    return this.businessUnit;
  }

  render() {

    return <Host>
      <ibcs-title
        businessUnit={this.prepareBusinessUnit()}
        scenarios={this.prepareScenarios()}
        measures={this.prepareMeasures()}
        timeperiod={this.prepareTitleTimePeriod()}
        order={this.prepareTitleOrder()}
        i18n={this.prepareI18n()}
        i18n-mode={this.prepareI18nMode()}
      ></ibcs-title>
    </Host>
  }
}
