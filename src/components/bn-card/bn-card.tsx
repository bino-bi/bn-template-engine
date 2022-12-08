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

import withComponentStatus from "../../utils/withComponentStatus";
import {globalLabelKeys} from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";
import {withStyled} from "../../utils/styled/withStyled";
import {
  DateDistance, DateLink,
  I18nMode, IMeasureEntry,
  IOrder,
  OrderColumn,
  OrderDirection,
  TimePeriod
} from "@bino-bi/ibcs-component-interface";
import withHasError, {ErrorDispatcher} from "../../utils/withHasError";

@Component({
  tag: 'bn-card',
  styleUrl: 'bn-card.scss',
  assetsDirs: ['assets']
})


export class Card {
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.t = withTranslation(this).t;
    this.errors = withHasError(this);
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
    const errId: string = 'ERR_scenarios';

    if (invalidScenarios?.length > 0) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.'});
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
  @Prop() readonly order: string = 'category';

  @Watch('order')
  validateOrder(newValue: string) {
    const invalidScenarios: string[] = validateOrderList(newValue);
    const errId: string = 'ERR_order';

    if (invalidScenarios?.length > 0) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'order: invalid value \'' + invalidScenarios?.toString() + '\' is not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }


  /** Sets sorting order directon
   *  <br /><br />
   *  values:<br /> ``` asc // desc ```
   */
  @Prop() readonly orderDirection: string = 'asc';

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    const errId: string = 'ERR_orderDirection';

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.'});
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

  @Watch('measures')
  validateMeasures(newValue: string) {
    const invalidMeasures: string[] = validateMeasureList(newValue);
    const errId: string = 'ERR_measures';

    if (invalidMeasures?.length > 0) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'measures: invalid value \'' + invalidMeasures + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]'});
    } else {
      this.errors.remove(errId);
    }
  }

  /** String of start date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateStart: string;

  @Watch('dateStart')
  validateDateStart(newValue: string) {
    const errId: string = 'ERR_dateStart';

    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'dateStart: invalid value \'' + newValue?.toString() + '\' is not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }


  /** String of end date
   *  <br /><br />
   *  format:<br /> ``` yyyy-MM-dd ```
   */
  @Prop() readonly dateEnd: string;

  @Watch('dateEnd')
  validateDateEnd(newValue: string) {
    const errId: string = 'ERR_dateEnd';

    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'dateEnd: invalid value \'' + newValue?.toString() + '\' is not supported.'});
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
  @Prop() readonly dateFormat: string = 'none';

  @Watch('dateFormat')
  validateDateFormat(newValue: string) {
    const errId: string = 'ERR_dateFormat';

    if (!isValidDateFormat(newValue) && !isBlankInput(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'dateFormat: invalid value \'' + newValue?.toString() + '\' is not supported.'});
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
  @Prop() readonly dateLink: string = 'none';

  @Watch('dateLink')
  validateDateLink(newValue: string) {
    const errId: string = 'ERR_dateLink';

    if (!isValidDateLink(newValue) && !isBlankInput(newValue) ) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'dateLink: invalid value \'' + newValue?.toString() + '\' is not supported.'});
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_showBorder';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'showBorder: invalid value(s) \'' + newValue?.toString() + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_internationalisationMode';

    if (!isValidi18nMode(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'internationalisationMode: invalid value \'' + newValue?.toString() + '\' is not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Lookup Map of translation tokens. (TODO: SHE)
   *
   */
  @Prop() internationalisation?: string;
  @Watch('internationalisation')
  validateI18n(newValue: string) {
    const errId: string = 'ERR_internationalisation';

    if (!validateI18nString(newValue)) {
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'internationalisation: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
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

  private prepareTitleOrder(): IOrder {
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

  private prepareMeasures(): IMeasureEntry[] {
    if (isBlankInput(this.measures)) {
      return [];
    }
    return JSON.parse(this.measures) as IMeasureEntry[];
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
          class=""
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
        <bn-footer   class="" text={this.prepareFooterText()}  displayPageNumber={false} ></bn-footer>
      </div>
    </Host>
  }
}



