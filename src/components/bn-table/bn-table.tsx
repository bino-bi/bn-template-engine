
import { Component, Element,  h, Host, Prop, Watch } from "@stencil/core";
import { styled } from "../../utils/styled/styled";
import { isValidBoolean, isValidDirection, isValidi18nMode, isValidOrderList, isValidTableType, isValidThereOf, validateScenarioList } from "../../utils/validate";
import Tunnel from "../bn-context/tunnel";
@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {
  // @ts-ignore
  @Element() private element: HTMLElement;

  /**
   * A not mondane tile for the shard, 
   * which discribes the shown data.
   */
  @Prop() tableTitle!: string;


   /** 
    * (optional) List of scenarios. Valid scenarios are 
    *  
    *  values: ac | fc | py | pl 
    */
  @Prop() scenarios!: string;

   
  /** 
    *  Toggles of data should be grouped by 
    *  'rowgroup'. 
    *  
    *  values: true | false 
    *  default: true
    */
  @Prop() grouped!: boolean;


  /**
   *  Toggles a title header for each (row-)group 
   *  the title header value is found set by 'rowgroup'
   * 
   *  values: true | false
   *  default: true
   * 
   */
  @Prop() showGroupTitle!: boolean;

  
  /**
   *  Set the table type
   *  
   *  LIST | SUM | OPT
   * 
   */
  @Prop() type!: string;

  
  /**
   * (optional) Set the maximum number of rows for each 
   * group. The value 0 means *no limit*
   * 
   * rows wich where cut by the limit are cumulated as REST
   * 
   */
  @Prop() limit: number = 0;


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
   * values:   ALL | NONE | META 
   */
  @Prop() i18nMode: string = "NONE";

  @Prop() datasource: string
  @Prop() datasourcesData: any


  unsubscribe: () => void

 
  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios.length > 0) { throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.') };
  }

  @Watch('grouped')
  validateGrouped(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) { 
      throw new Error('grouped: invalid value(s) \'' + newValue.toString() + '\' are not supported.') };
  }

  @Watch('showGroupTitle')
  validateShowGroupTitle(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) { 
      throw new Error('showGroupTitle: invalid value(s) \'' + newValue.toString() + '\' are not supported.') };
  }

  @Watch('type')
  validateType(newValue: string | boolean) {
    if (!isValidTableType(newValue)) { throw new Error('type: invalid value(s) \'' + newValue.toString() + '\' are not supported.') };
  }

  @Watch('thereof')
  validateThereOf(newValue: string) {
    if (!isValidThereOf(newValue)) {

      const newObj = JSON.parse(newValue);
      let error: any;

      if (newObj instanceof Array) {
        error = JSON.stringify(newObj.filter(elem => !(elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category')&&elem.hasOwnProperty('subcategory'))));
      }
      else {
        error = newValue;
      }
      throw new Error('measures: invalid value \'' + error + '\' is not supported. Valid format example: [{"name": "Bruttoumsatz", "unit": "mEUR"}]')
    };

  }

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) { throw new Error('orderDirection: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  @Watch('order')
  validateOrderList(newValue: string) {
    if (!isValidOrderList(newValue)) { throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  
  @Watch('i18nMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) { throw new Error('order: invalid value \'' + newValue.toString() + '\' is not supported.') };
  }

  componentWillLoad() {
    //this.datasouce = get("test");
   // this.unsubscribe = onChange("test", (value) => this.datasouce = value);

    this.validateScenario(this.scenarios);
    this.validateGrouped(this.grouped);
    this.validateShowGroupTitle(this.showGroupTitle);
    this.validateType(this.type);
    this.validateThereOf(this.thereof);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validatei18nMode(this.i18nMode);

  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  render() {
    const tableOrder = {
      columnshierachy: this.order.split(","),
      direction: this.orderDirection
    };
    let data = this.datasourcesData[this.datasource]
    const groupByKey = (list, key) => list.reduce((hash, obj) => ({...hash, [obj[key]]:( hash[obj[key]] || [] ).concat(obj)}), {})
    const explode = (map) =>  Object.keys(map).map((k) => ({"setname": k, "data": map[k]}))
//TODO
    var temp = []

    if(data){
      temp = explode(groupByKey([...data], 'setname'))
    }

    return <Host>
      <ibcs-table
        table-title={this.tableTitle}
        scenarios={this.scenarios.split(",")}
        grouped={this.grouped}
        show-group-title={this.showGroupTitle}
        type={this.type}
        i18n-mode={this.i18nMode}
        limit={this.limit}
        thereof={this.thereof ? JSON.parse(this.thereof!) : null}
        order={tableOrder}
        i18n={new Map([
          ["title1", "🤩"]
        ])}
        data={temp}
    ></ibcs-table>
    </Host>
  }
}

styled(Table);
Tunnel.injectProps(Table, ['datasourcesData'])
