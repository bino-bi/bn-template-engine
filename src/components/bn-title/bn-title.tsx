import { Component, Element, h, Host, Prop, Watch } from "@stencil/core";

import {
  isBlankInput,
  isValidDate,
  isValidDateFormat,
  isValidDateLink,
  isValidDirection,
  validateMeasureList,
  validateOrderList,
  validateScenarioList,
  validateVariancesList,
} from "../../utils/validate";
import { DateTime } from "luxon";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withRuleSet from "../../utils/withRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { Style } from "../../stores/componentStyles";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { I18nMode } from "../../utils/constants";
import { Order, OrderDirection } from "../../utils/model/Order";
import { TimePeriod } from "./bn-title-renderer/utils/model/TimePeriod";
import { DateDistance, DateLink } from "../../utils/DateStringFactory";
import { MeasureEntry } from "./bn-title-renderer/utils/model/MeasureEntriy";
import { getStores } from "../../context/context-protocol";

/**
 * Composes an IBCS-compliant report title block.
 *
 * Renders business unit, scenario labels, measure names with units, a
 * formatted date/time period, and sort-order indicators as a structured
 * header. Delegates the actual layout to the inner `bn-title-renderer` element.
 */
@Component({
  tag: "bn-title",
  styleUrl: "bn-title.scss",
  shadow: true,
})
export class Title {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private readonly ruleSetConfig: () => RuleSetConfig;

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.t = withTranslation(this).t;
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
    this.ruleSetConfig = withRuleSet(this);
  }

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * Namespace of the translations to use (the `namespace` of a
   * `<bn-internationalization>`). Without it the component takes the
   * `i18n-namespace` of the nearest ancestor that has one, then the built-in
   * texts.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace?: string;

  /**
   * Name of a registered IBCS rule set (see `bn-ruleset`) used for scenario
   * ordering. Supports `"inherited-closest"` / `"inherited-page"` to take
   * over the value from an ancestor `bn-layout-card` / `bn-layout-page`.
   */
  @Prop({ reflect: true }) readonly ruleset?: string;

  /** Name of the business unit displayed in card header. If empty string (`''` or `null`) the business unit row is omitted
   *  <br /><br />
   *  Rendered as sanitized HTML, so inline markup such as ```<b>```, ```<i>``` and ```<br />``` is supported.
   */
  @Prop() readonly businessUnit: string = "";

  /** List of scenarios displayed in card header.
   *  <br /><br />
   *  If scenarios is empty string (`''` or `null`) the scenarios are omitted
   *  <br /><br />
   *  values:<br /> ```ac // fc // py // pl // null```
   */
  @Prop() readonly scenarios: string;

  @Watch("scenarios")
  validateScenario(newValue: string) {
    const errId = "WARN_scenarios";

    const invalidScenarios: string[] = validateScenarioList(newValue);

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "scenarios: invalid value(s) '" + invalidScenarios?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** <br /> <br />
   List of Variances
   The additonal variances which
   are calculated form the given scenarios.
   the scenarios used in the variances have also
   be defined in the *scenarios* property.
   <br /> <br />
   the variance is defiend as  (Scenario A -  ScenarioB)
   neu. neg and pos post fix defines which value is *good*
   a negative or a positive value.
   <br /> <br />
   if empty variance charts are hidden
   <br /> <br />
   each variance creates a chart
   <br /> <br />
   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```
   */
  @Prop() readonly variances: string;

  @Watch("variances")
  validateVariances(newValue: string) {
    const errId = "WARN_variances";
    const invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "variances: invalid value(s) '" + invalidVariances?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** List of the primary scenarios on which the order direction are applied.
   *  <br /><br />
   *  If order is set to a scenario it has also exists in scenariolist.<br />
   *  If order is empty string (`''` or `null`) the order arrow is omitted
   *  <br /><br />
   *  values:<br /> ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac // fc // py // pl // null ```
   */
  @Prop() readonly order: string = "category";

  @Watch("order")
  validateOrder(newValue: string) {
    const invalidElements: string[] = validateOrderList(newValue);
    const errId = "WARN_order";

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "order: invalid value(s) '" + invalidElements?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** Sets sorting order directon
   *  <br /><br />
   *  values:<br /> ``` asc // desc ```
   */
  @Prop() readonly orderDirection: string = "asc";

  @Watch("orderDirection")
  validateOrderDirection(newValue: string) {
    const errId = "WARN_orderDirection";

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "orderDirection: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
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

  @Watch("measures")
  validateMeasures(newValue: string) {
    const errId = "WARN_measures";
    const invalidMeasures: string[] = validateMeasureList(newValue);

    if (invalidMeasures.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message:
          "measures: invalid value(s) '" +
          invalidMeasures?.toString() +
          '\' are not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]',
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** String of start date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateStart: string;

  @Watch("dateStart")
  validateDateStart(newValue: string) {
    const errId = "WARN_dateStart";
    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dateStart: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** String of end date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateEnd: string;

  @Watch("dateEnd")
  validateDateEnd(newValue: string) {
    const errId = "WARN_dateEnd";

    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dateStart: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
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
  @Prop() readonly dateFormat: string = "none";

  @Watch("dateFormat")
  validateDateFormat(newValue: string) {
    const errId = "WARN_dateFormat";

    if (!isValidDateFormat(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dateFormat: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
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
  @Prop() readonly dateLink: string = "none";

  @Watch("dateLink")
  validateDateLink(newValue: string) {
    const errId = "WARN_dateLink";
    if (!isValidDateLink(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dateLink: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateMeasures(this.measures);
    this.validateDateStart(this.dateStart);
    this.validateDateEnd(this.dateEnd);
    this.validateDateFormat(this.dateFormat);
    this.validateDateLink(this.dateLink);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrder(this.order);
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["SEPARATOR_WS", "in", "CONNECTOR_WS"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    // system
    const i18nMapSystemLocal = new Map(i18nMetaLabelsLocal.map((key) => [key, this.t(".".concat(key))]));
    const i18nMapSystemGlobal = new Map(i18nMetaLabelsGlobal.map((key) => [key, this.t("global.".concat(key))]));
    //let i18nMapCustom =

    return new Map([...i18nMapSystemGlobal.entries(), ...i18nMapSystemLocal.entries()]);
  }

  private prepareI18nMode(): I18nMode {
    return I18nMode.META;
  }

  private prepareLocale(): string {
    return getStores(this.element).context.state.locale || "de";
  }

  private prepareTitleOrder(): Order {
    if (isBlankInput(this.order) || isBlankInput(this.orderDirection)) {
      return null;
    }

    return {
      hierarchy: this.order.split(",").map((entry) => entry.trim()),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection],
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
      start: DateTime.fromISO(this.dateStart, { zone: "utc" }),
      end: DateTime.fromISO(this.dateEnd, { zone: "utc" }),
      format: DateDistance[this.dateFormat?.toUpperCase() as keyof typeof DateDistance],
      link: DateLink[this.dateLink?.toUpperCase() as keyof typeof OrderDirection],
    };
  }

  private prepareMeasures(): MeasureEntry[] {
    if (isBlankInput(this.measures)) {
      return [];
    }
    try {
      return JSON.parse(this.measures) as MeasureEntry[];
    } catch (_e) {
      // invalid JSON already reported by validateMeasures
      return [];
    }
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios) && isBlankInput(this.variances)) {
      return [];
    }
    let scenarios = [];

    if (this.scenarios?.trim().length > 0) {
      scenarios = scenarios.concat(this.scenarios?.split(","));
    }

    if (this.variances?.trim().length > 0) {
      scenarios = scenarios.concat(this.variances?.split(","));
    }
    return scenarios.map((entry) => entry.trim());
  }

  private prepareBusinessUnit(): string {
    if (isBlankInput(this.businessUnit) || this.businessUnit === "null") {
      return null;
    }
    return this.businessUnit;
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle(($) => ({
      "--bn-font-family": $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      "--bn-font-size": `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      "--bn-font-color": $["global"]?.["fontColor"] || "#000000",
      "--bn-font-background": $["global"]?.["fontBackgroundColor"] || "#ffffff",
    }));
  }

  render() {
    const fontStyles = this.getFontStyles();

    return (
      <Host style={fontStyles}>
        <bn-title-renderer
          businessUnit={this.prepareBusinessUnit()}
          scenarios={this.prepareScenarios()}
          measures={this.prepareMeasures()}
          timeperiod={this.prepareTitleTimePeriod()}
          order={this.prepareTitleOrder()}
          i18n={this.prepareI18n()}
          i18n-mode={this.prepareI18nMode()}
          locale={this.prepareLocale()}
          ruleSetConfig={this.ruleSetConfig()}
        ></bn-title-renderer>
      </Host>
    );
  }
}
