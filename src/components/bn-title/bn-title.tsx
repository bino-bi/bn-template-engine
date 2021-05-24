//import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import {Component, Element, h, Host, Prop, State, Watch} from "@stencil/core";

import {styled} from "../../utils/styled/styled";
import {
  isBlankInput,
  isValidDate,
  isValidDateFormat,
  isValidDateLink,
  isValidDirection,
  validateMeasureList,
  validateOrderList,
  validateScenarioList,
} from "../../utils/validate";


import {
  DateDistance,
  DateLink,
  MeasureEntry,
  Order,
  OrderColumn,
  OrderDirection,
  TimePeriod
} from "@bino-bi/ibcs-component-interface";
import Tunnel from "../bn-context/tunnel";


@Component({
  tag: 'bn-title',
  styleUrl: 'bn-title.scss',
})


export class Title {
  // @ts-ignore
  @Element() private readonly element: HTMLElement;


  /** (optional) Name of business unit. If empty buisnes unit row is omitted */
  @Prop() readonly businessUnit: string;


  /** (optional) List of scenarios. Valid scenarios are
   *
   *  values: ac | fc | py | pl | null
   */
  @Prop() readonly scenarios: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios?.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.')
    }
  }


  /** (optional) List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *
   *  values: category | categoryindex | rowgroup | rowgroup | rowgroupindex | ac | fc | py | pl
   */
  @Prop() readonly order: string;

  @Watch('order')
  validateOrder(newValue: string) {
    const invalidScenarios: string[] = validateOrderList(newValue);
    if (invalidScenarios?.length > 0) {
      throw new Error('order: invalid value \'' + invalidScenarios?.toString() + '\' is not supported.')
    }
  }


  /** (optional) set sorting order directon
   *
   * values: asc | desc
   */
  @Prop() readonly orderDirection: string = 'asc';

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


  /**(optional) stringified Array of measure Objects {name: string, unit: string}
   *
   * IF all units are the same the redundant units will be reduced and names concatenated
   * IF unit is null  the 'in' label is omitted
   *
   * example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]
   */
  @Prop() readonly measures: string;

  @Watch('measures')
  validateMeasures(newValue: string) {
    const invalidMeasures: string[] = validateMeasureList(newValue);
    if (invalidMeasures?.length > 0) {
      throw new Error('measures: invalid value \'' + invalidMeasures + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]')
    }
  }

  /**(optional) String of start date
   *
   * format: yyyy-MM-dd
   */
  @Prop() readonly dateStart: string;

  @Watch('dateStart')
  validateDateStart(newValue: string) {
    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateStart: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


  /**(optional) String of end date
   *
   * format: yyyy-MM-dd
   */
  @Prop() readonly dateEnd: string;

  @Watch('dateEnd')
  validateDateEnd(newValue: string) {
    if (!isValidDate(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateEnd: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }

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
  @Prop() readonly dateFormat: string = 'fallback';

  @Watch('dateFormat')
  validateDateFormat(newValue: string) {
    if (!isValidDateFormat(newValue) && !isBlankInput(newValue)) {
      throw new Error('dateFormat: invalid value \'' + newValue?.toString() + '\' is not supported.')
    }
  }


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


  private prepareI18n(): Map<string, string> {
    return new Map([
      ["title1", "🤩"]
    ]);
  }

  private prepareTitleOrder(): Order {
    if(isBlankInput(this.order) || isBlankInput(this.orderDirection)) {
      return null;
    }

    return {
      hierarchy: this.order.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };
  }

  private prepareTitleTimePeriod(): TimePeriod | null {
    if ( isBlankInput(this.dateStart) && isBlankInput(this.dateEnd) ) {
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

  render() {
    return <Host>
       <ibcs-title
        businessUnit={this.businessUnit}
        scenarios={this.prepareScenarios()}
        measures={this.prepareMeasures()}
        timeperiod={this.prepareTitleTimePeriod()}
        order={this.prepareTitleOrder()}
        i18n={this.prepareI18n()}
      ></ibcs-title>
    </Host>
  }
}

styled(Title);
Tunnel.injectProps(Title, ['datasourcesData']);

