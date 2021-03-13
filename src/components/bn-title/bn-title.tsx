//import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
//import {get ,onChange} from '../../data/datasource';
import { styled } from "../../utils/styled/styled";
import { isValidDate, isValidDateFormat, isValidDateLink, isValidDirection, isValidMeasure, isValidOrderList, validateScenarioList } from "../../utils/validate";

@Component({
  tag: 'bn-title',
  styleUrl: 'bn-title.scss'
})
export class Title {

  // @ts-ignore
  @Element() private element: HTMLElement;

  /** (optional) Name of business unit. If empty buisnes unit row is omitted */
  @Prop() businessUnit: string;


  /** (optional) List of scenarios. Valid scenarios are
   *
   *  values: ac | fc | py | pl | null
   */
  @Prop() scenarios: string;


  /** (optional) List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *
   *  values: category | categoryindex | rowgroup | rowgroup | rowgroupindex | ac | fc | py | pl
   */
  @Prop() order: string;


  /** (optional) set sorting order directon
   *
   * values: asc | desc
   */
  @Prop() orderDirection: string = 'asc';

  /**(optional) stringified Array of measure Objects {name: string, unit: string}
   *
   * IF all units are the same the redundant units will be reduced and names concatenated
   * IF unit is null  the 'in' label is omitted
   *
   * example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]
   */
  @Prop() measures: string;


  /**(optional) String of start date
   *
   * format: yyyy-MM-dd
   */
  @Prop() dateStart: string;


  /**(optional) String of end date
   *
   * format: yyyy-MM-dd
   */
  @Prop() dateEnd: string;


  /**(optional) String of end date (format: yyyy-MM-dd)
   *
   * values: year | quarter | month | week | day | hour | auto | fallback
   *
   *  detail:
   *  year: "YYYY",
   *  quarter:  "Q[Q] YYYY",
   *  month: "MMM YYYY",
   *  week: "[KW]WW YYYY",
   *  day: "DD.MM.YYYY",
   *  time: "DD.MM.YYYY HH:mm:ss",
   *  fallback: "DD.MM.YYYY",
   */
  @Prop() dateFormat: string = 'fallback';


  /**(optional) String of end date (format: yyyy-MM-dd)
   *
   * values: avg | interval | cum | start | end | ytd | ytg | cum | mat | none |
   *
   * detail:
   *   avg: "Ø[DATE]",
   *   interval:  "[DATE]..[DATE2]",
   *   start: ".[DATE]",
   *   end: "[DATE].",
   *   ytd: "_[DATE]",
   *   ytg: "[DATE]_",
   *   cum: "[DATE]_[DATE2]",
   *   mat: "~[DATE]",
   *   none: "[DATE]",
   */
  @Prop() dateLink: string = 'none';


  @State() datasouce: any


  @Watch('scenarios')
  validateScenario(newValue: string) {
    if ( newValue != null){
      const invalidScenarios: string[] = validateScenarioList(newValue);

      if (invalidScenarios.length > 0) { throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.') };

    }
  }

  @Watch('measures')
  validateMeasures(newValue: string) {
    if (!isValidMeasure(newValue)) {

      const newObj = JSON.parse(newValue);
      let error: any;

      if (newObj instanceof Array) {
        error = JSON.stringify(newObj.filter(elem => !(elem.hasOwnProperty('name') && elem.hasOwnProperty('unit'))));
      }
      else {
        error = newValue;
      }
      throw new Error('measures: invalid value \'' + error + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]')
    };

  }

  @Watch('dateStart')
  validateDateStart(newValue: string) {
    if (!isValidDate(newValue)) { throw new Error('dateStart: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('dateEnd')
  validateDateEnd(newValue: string) {
    if (!isValidDate(newValue)) { throw new Error('dateEnd: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('dateFormat')
  validateDateFormat(newValue: string) {
    if (!isValidDateFormat(newValue)) { throw new Error('dateFormat: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('dateLink')
  validateDateLink(newValue: string) {
    if (!isValidDateLink(newValue)) { throw new Error('dateLink: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) { throw new Error('orderDirection: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('order')
  validateOrderList(newValue: string) {
    if (!isValidOrderList(newValue)) { throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateMeasures(this.measures);
    this.validateDateStart(this.dateStart);
    this.validateDateEnd(this.dateEnd);
    this.validateDateFormat(this.dateFormat);
    this.validateDateLink(this.dateLink);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
  }

  render() {
    const titleOrder = {
      columnshierachy: this.order ? this.order.split(",") : null,
      direction: this.orderDirection
    };

    const titleTimeperiod = {
      start: this.dateStart,
      end: this.dateEnd,
      format: this.dateFormat,
      link: this.dateLink,
    };

    return <Host>
      <ibcs-title
        businessUnit={this.businessUnit}
        scenarios={this.scenarios == null? this.scenarios.split(",") : null}
        measures={this.measures ? JSON.parse(this.measures!) : null}
        timeperiod={titleTimeperiod}
        order={titleOrder}
        i18n={new Map([
          ["title1", "🤩"]
        ])}
      ></ibcs-title>
    </Host>
  }
}

styled(Title);


