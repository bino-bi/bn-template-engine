import {Component, Element, h, Host, Prop, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import {
  isValidBoolean,
  isValidDirection,
  isValidi18nMode,
  isValidTableType,
  isValidThereOf,
  validateOrderList, isValidDataFormat,
  validateScenarioList, isValidNumber
} from "../../utils/validate";

import {
  I18nMode,
  TableComponentOrder,
  TableComponentOrder,
} from "@bino-bi/ibcs-component/dist/types/components/ibcs-table/utils/model";

import Tunnel from "../bn-context/tunnel";
import {DataFormat, OrderDirection, TableType} from "@bino-bi/ibcs-component-interface";


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
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.')
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
      throw new Error('dataFormat: invalid value(s) \'' + newValue.toString() + '\' are not supported.')
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
      throw new Error('grouped: invalid value(s) \'' + newValue.toString() + '\' are not supported.')
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
      throw new Error('showGroupTitle: invalid value(s) \'' + newValue.toString() + '\' are not supported.')
    }
  }


  /**
   *  Set the table type
   *
   *  list | sum | opt
   *
   */
  @Prop() type!: string;

  @Watch('type')
  validateType(newValue: string | boolean) {
    if (!isValidTableType(newValue)) {
      throw new Error('type: invalid value(s) \'' + newValue.toString() + '\' are not supported.')
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
    console.log("my Limit", limit);
    if (!isValidNumber(newValue)) {
      throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.')
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
  /** List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *
   *  values: category | categoryindex | rowgroup | rowgroup | rowgroupindex | ac | fc | py | pl
   */
  @Prop() order!: string;
  /** set sorting order directon
   *
   * values: asc | desc
   */
  @Prop() orderDirection!: string;
  /** set translaton mode.
   *
   * values:   all | none | meta
   */
  @Prop() i18nMode: string = "none";
  @Prop() datasource: string
  @Prop() datasourcesData: any
  unsubscribe: () => void
  // @ts-ignore
  @Element() private element: HTMLElement;





  @Watch('thereof')
  validateThereOf(newValue: string) {
    if (!isValidThereOf(newValue)) {

      const newObj = JSON.parse(newValue);
      let error: any;

      if (newObj instanceof Array) {
        error = JSON.stringify(newObj.filter(elem => !(elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))));
      } else {
        error = newValue;
      }
      throw new Error('measures: invalid value \'' + error + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]')
    }


  }

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue.toString() + '\' is not supported.')
    }

  }

  @Watch('order')
  validateOrderList(newValue: string) {
    if (!validateOrderList(newValue)) {
      throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.')
    }

  }


  @Watch('i18nMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) {
      throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.')
    }

  }

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

  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private prepareDataFormat(): DataFormat{
    return DataFormat[this.dataFormat?.toUpperCase() as keyof typeof DataFormat]
  }

  private prepareGrouped(): boolean {
    return (this.grouped == true || this.grouped == "true")
  }

    private prepareShowGroupTitle(): boolean {
      return  (this.showGroupTitle == true ||  this.showGroupTitle == "true")
    }

  private prepareTableType(): TableType {
    return TableType[this.type?.toUpperCase() as keyof typeof TableType]
  }

  private prepareLimit(): number {
    return Number(this.limit) || 0
  }

  render() {
    const tableOrder: TableComponentOrder = {
      columnshierachy: this.order.split(","),
      direction: this.orderDirection as OrderDirection
    };
    let data = this.datasourcesData[this.datasource]
    const groupByKey = (list, key) => list.reduce((hash, obj) => ({
      ...hash,
      [obj[key]]: (hash[obj[key]] || []).concat(obj)
    }), {})
    const explode = (map) => Object.keys(map).map((k) => ({"setname": k, "data": map[k]}))
//TODO
    var temp = []

    if (data) {
      temp = explode(groupByKey([...data], 'setname'))
    }

    return <Host>
      <ibcs-table
        table-title={this.tableTitle}
        scenarios={this.scenarios?.split(",")}
        scenarios-data-format={this.prepareDataFormat()}
        grouped={this.prepareGrouped()}
        show-group-title={this.prepareShowGroupTitle()}
        type={this.prepareTableType()}
        limit={this.prepareLimit()}

        i18n-mode={this.i18nMode as I18nMode}

        thereof={this.thereof ? JSON.parse(this.thereof!) : null}
        order={tableOrder}
        i18n={this.prepareI18n()}
        data={temp}
      ></ibcs-table>
    </Host>
  }


  private prepareI18n(): Map<string, string> {
    return new Map([
      ["title1", "🤩"]
    ]);
  }

}

styled(Table);
Tunnel.injectProps(Table, ['datasourcesData']);


