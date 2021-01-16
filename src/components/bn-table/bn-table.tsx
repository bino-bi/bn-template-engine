import {Component, Element, h, Host, Prop} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import Tunnel from "../bn-context/tunnel";

@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {
  // @ts-ignore
  @Element() private element: HTMLElement;

  @Prop() tableTitle: string;
  @Prop() scenarios: string;
  @Prop() grouped: boolean;
  @Prop() type: string;
  @Prop() showGroupTitle: boolean;
  @Prop() limit?: number;
  @Prop() thereof?: string;
  @Prop() order?: string;
  @Prop() orderDirection?: string;
  @Prop() datasource: string

  @Prop() datasourcesData: any

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
      console.log("inner", data);
      temp = explode(groupByKey([...data], 'setname'))
    }

    return <Host>
      <ibcs-table
        table-title={this.tableTitle}
        scenarios={this.scenarios.split(",")}
        grouped={this.grouped}
        show-group-title={this.showGroupTitle}
        type={this.type}
        i18n-mode={"NONE"}
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
