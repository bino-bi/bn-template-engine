//import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import {Component, h, Host, Prop, Watch, getAssetPath} from "@stencil/core";

import {
  isBlankInput,
  isValidDate,
  isValidDateFormat,
  isValidDateLink,
  isValidDirection,
  validateMeasureList,
  validateOrderList,
  validateScenarioList,
  isValidBoolean, isValidi18nMode, validateI18nString
} from "../../utils/validate";


import {
  DateDistance,
  DateLink, I18nMode,
  MeasureEntry,
  Order,
  OrderColumn,
  OrderDirection,
  TimePeriod
} from "@bino-bi/ibcs-component-interface";
import withComponentStatus from "../../utils/withComponentStatus";
import {globalLabelKeys} from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";
import {withStyled} from "../../utils/styled/withStyled";

@Component({
  tag: 'bn-card',
  styleUrl: 'bn-card.scss',
  assetsDirs: ['assets']
})


export class Card {
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
    const invalidScenarios: string[] = validateOrderList(newValue);
    if (invalidScenarios?.length > 0) {
      throw new Error('order: invalid value \'' + invalidScenarios?.toString() + '\' is not supported.')
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
    if (!isValidDateLink(newValue) && !isBlankInput(newValue) ) {
      throw new Error('dateLink: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }

  /**
   *  Url of the cards logo/ pictogram.
   *  <br />
   *  if not http it looks up the url in the components asset folder
   *  <br />
   *  If empty string (`''` or `null`) the image is omitted
   * <br /><br />
   *  example:<br /> ```debug/concordia.png```
   */
  @Prop() readonly image: string = '';

  /**
   * show or hides the cards border
   * <br /><br />
   * values:<br /> ``` true // false ```
   *
   */
  @Prop() readonly showBorder: string = "true";

  @Watch('showBorder')
  validateShowBorder(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('showBorder: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   * Custom text for footer which is displayed in the bottom-left of the card element<br />
   * If empty string (`''` or `null`) the footer row is omitted
   *<br /><br />
   * example:<br /> ``` Hello, Footer!```
   *
   */
  @Prop() readonly footerText: string;


  /**
   *  Mode of Translation
   *  <br /><br />
   *  values:<br /> ``` none // meta // all ```
   */
  @Prop() internationalisationMode: string = "meta";

  @Watch('internationalisationMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) {
      throw new Error('internationalisationMode: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  /**
   * Lookup Map of translation tokens. (TODO: SHE)
   *
   */
  @Prop() internationalisation?: string;
  @Watch('internationalisation')
  validateI18n(newValue: string) {
    if (!validateI18nString(newValue)) {
      throw new Error('internationalisation: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateMeasures(this.measures);
    this.validateDateStart(this.dateStart);
    this.validateDateEnd(this.dateEnd);
    this.validateDateFormat(this.dateFormat);
    this.validateDateLink(this.dateLink);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrder(this.order);
    this.validateShowBorder(this.showBorder);
    this.validatei18nMode(this.internationalisationMode);
    this.validateI18n(this.internationalisation);
  }

  private prepareI18nMode(): I18nMode {
    return I18nMode.META;
  }


  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["SEPERATOR_WS", "in", "CONNECTOR_WS"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal  = new Map(i18nMetaLabelsLocal.map(key  => [key, this.t("ibcs-title.".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return  new Map([...i18nMapGlobal.entries(),...i18nMapLocal.entries()]);
  }

  private prepareTitleOrder(): Order {
    if(isBlankInput(this.order)) {
      return null;
    }
    return {
      hierarchy: this.order.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };
  }

  private prepareTitleTimePeriod(): TimePeriod | null {
    if ( isBlankInput(this.dateStart) && isBlankInput(this.dateEnd)) {
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

  setCardClass(): string {
    if (this.showBorder == "true") {
      return "card_box border";
    }
    return "card_box"
  }

  prepareAssetUrl(imgUrl: string){
    if(this.isValidHttpUrl(imgUrl)) {
      return imgUrl
    }
    return `./assets/${imgUrl}`
  }

  isValidHttpUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareFooterText(): string {
    if (isBlankInput(this.footerText) || this.footerText == "null" ) {
      return null;
    }
    return this.footerText;
  }

  private prepareBusinessUnit(): string {
    if (isBlankInput(this.businessUnit) || this.businessUnit == "null" ) {
      return null;
    }
    return this.businessUnit;
  }


  render() {
    let logo = ''


    if(this.image.trim() !== '' && this.image.trim() !== 'null' ) {
      logo =  <img class="image" src={getAssetPath(`${this.prepareAssetUrl(this.image)}`)}/>
    }

    return  <Host class={this.setCardClass()} >
      <div class="content">
        <ibcs-title
          class="titelgreen"
          businessUnit={this.prepareBusinessUnit()}
          scenarios={this.prepareScenarios()}
          measures={this.prepareMeasures()}
          timeperiod={this.prepareTitleTimePeriod()}
          order={this.prepareTitleOrder()}
          i18n={this.prepareI18n()}
          i18n-mode={this.prepareI18nMode()}
        ></ibcs-title>
        <div class="overlay">{logo}</div>
        <slot/>
        <bn-footer   class="footergreen" text={this.prepareFooterText()}  displayPageNumber={false} ></bn-footer>
      </div>
    </Host>
  }
}



