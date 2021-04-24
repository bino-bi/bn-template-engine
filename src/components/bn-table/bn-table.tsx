import {Component, Element, h, Host, Prop, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import {
  isValidBoolean,
  isValidDataFormat,
  isValidDirection, validateI18nString,
  isValidi18nMode,
  isValidInteger,
  isValidTableType,
  validateOrderList,
  validateScenarioList,
  validateThereOfJsonStr
} from "../../utils/validate";

import Tunnel from "../bn-context/tunnel";
import {
  DataFormat,
  I18nMode,
  OrderDirection,
  TableComponentOrder,
  TableDrillGroup,
  TableType
} from "@bino-bi/ibcs-component-interface";


@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {
  /**
   * A not mundane tile for the shard,
   * which describes the shown data.
   */
  @Prop() tableTitle!: string;


  /**
   * (optional) List of scenarios. Valid scenarios are
   *
   *  variances pattern d<scenario_baseScenario>
   *  relative variance pattern dr<scenario_baseScenario>
   *
   *  values: ac | fc | py | pl | dfc_ac | drfc_ac
   */
  @Prop() readonly scenarios!: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.');
    }
  }


  /**
   * (optional) Scenario Unit Type
   *
   *  percent all data values are converted into percent
   *  (0.02 ->  2%)
   *
   *  default volume
   *  values: percent | decimal
   */
  @Prop() dataFormat!: string;

  @Watch('dataFormat')
  validateDataFormat(newValue: string) {
    if (!isValidDataFormat(newValue)) {
      throw new Error('dataFormat: invalid value(s) \'' + newValue.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles of data should be grouped by
   *  'rowgroup'.
   *
   *  values: true | false
   *  default: true
   */
  @Prop() grouped!: boolean | string;

  @Watch('grouped')
  validateGrouped(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('grouped: invalid value(s) \'' + newValue.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles a title header for each (row-)group
   *  the title header value is found set by 'rowgroup'
   *
   *  values: true | false
   *  default: true
   *
   */
  @Prop() showGroupTitle!: boolean | string;

  @Watch('showGroupTitle')
  validateShowGroupTitle(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('showGroupTitle: invalid value(s) \'' + newValue.toString() + '\' are not supported.');
    }
  }


  /**
   *  Set the table type
   *
   *  list | sum | opt | sumnototal | optnototal
   *
   */
  @Prop() type!: string;

  @Watch('type')
  validateType(newValue: string | boolean) {
    if (!isValidTableType(newValue)) {
      throw new Error('type: invalid value(s) \'' + newValue.toString() + '\' are not supported.');
    }
  }


  /**
   * (optional) Set the maximum number of rows for each
   * group. The value 0 means *no limit*
   *
   * rows wich where cut by the limit are cumulated as REST
   *
   */
  @Prop() limit: number = 0;

  @Watch('limit')
  validateLimit(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.');
    }
  }


  /**
   * (optional) stringified Array of drilldown Objects {
            "rowgroup": string,
            "category": string,
            "subcategory": string,
            "partof": string
          },
   * rowgroup, categroy defines the location of the drill
   * subcategory is the displayed label of the data row
   *
   * example: [{
            "rowgroup":"Umsatz",
            "category": "Applications",
            "subcategory": "Applications-A",
          },]
   */
  @Prop() thereof: string = '[]';


  @Watch('thereof')
  validateThereOf(newValue: string) {
    const invalidElements: string[] = validateThereOfJsonStr(newValue);
    if (invalidElements.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidElements.toString() + '\' are not supported.');
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
      throw new Error('order: invalid value(s) \'' + invalidElements.toString() + '\' are not supported.');
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
      throw new Error('orderDirection: invalid value \'' + newValue.toString() + '\' is not supported.');
    }

  }


  @Prop() i18nMode: string = "none";

  @Watch('i18nMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) {
      throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.');
    }

  }

  @Prop() i18n?: string;

  @Watch('i18n')
  validateI18n(newValue: string) {
    if (!validateI18nString(newValue)) {
      throw new Error('i18: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  @Prop() datasource: string
  @Prop() datasourcesData: any
  unsubscribe: () => void
  // @ts-ignore
  @Element() private element: HTMLElement;


  componentWillLoad() {
    //this.datasouce = get("test");
    // this.unsubscribe = onChange("test", (value) => this.datasouce = value);

    this.validateScenario(this.scenarios);
    this.validateDataFormat(this.dataFormat);
    this.validateGrouped(this.grouped);
    this.validateShowGroupTitle(this.showGroupTitle);
    this.validateType(this.type);
    this.validateLimit(this.limit);
    this.validateThereOf(this.thereof);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validatei18nMode(this.i18nMode);
    this.validateI18n(this.i18n);

  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private prepareDataFormat(): DataFormat {
    return DataFormat[this.dataFormat?.toUpperCase() as keyof typeof DataFormat];
  }

  private prepareGrouped(): boolean {
    return (this.grouped == true || this.grouped == "true");
  }

  private prepareShowGroupTitle(): boolean {
    return (this.showGroupTitle == true || this.showGroupTitle == "true");
  }

  private prepareTableType(): TableType {
    return TableType[this.type?.toUpperCase() as keyof typeof TableType];
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareThereOf(): TableDrillGroup[] {
    if (this.thereof == null) {
      return [];
    }

    return JSON.parse(this.thereof!) as TableDrillGroup[];

  }

  private prepareTableOrder(): TableComponentOrder {
    const tableOrder: TableComponentOrder = {
      columnshierachy: this.order.split(","),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }

  private prepareI18nMode(): I18nMode {
    return I18nMode[this.i18nMode?.toUpperCase() as keyof typeof I18nMode];
  }

  private prepareI18n(): Map<string, string> {
    return new Map([
      ["title1", "🤩"]
    ]);
  }

  private prepareData(): { setname: string; data: any }[] {
    const data = this.datasourcesData[this.datasource];

    if (data == null) {
      return [];
    }

    const groupByKey = (list, key) => list.reduce((hash, obj) => ({
      ...hash,
      [obj[key]]: (hash[obj[key]] || []).concat(obj)
    }), {});
    const explode = (map) => Object.keys(map).map((k) => ({"setname": k, "data": map[k]}));

    return explode(groupByKey([...data], 'setname'));

  }

  render() {
    return <Host>
      <ibcs-table
        table-title={this.tableTitle}
        scenarios={this.scenarios?.split(",")}
        scenarios-data-format={this.prepareDataFormat()}
        grouped={this.prepareGrouped()}
        show-group-title={this.prepareShowGroupTitle()}
        type={this.prepareTableType()}
        limit={this.prepareLimit()}
        thereof={this.prepareThereOf()}
        order={this.prepareTableOrder()}
        i18n-mode={this.prepareI18nMode()}
        i18n={this.prepareI18n()}
        data={this.prepareData()}
      ></ibcs-table>
    </Host>
  }
}

styled(Table);
Tunnel.injectProps(Table, ['datasourcesData']);


