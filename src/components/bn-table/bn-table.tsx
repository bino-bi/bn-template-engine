import {Component, Element, h, Host, Prop, State} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
//import {get ,onChange} from '../../data/datasource';

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

  @State() datasouce: any

  unsubscribe: () => void

  componentWillLoad() {
    // this.datasouce= get("test");
    //   this.unsubscribe = onChange("test", (value) => this.datasouce = value);
  }

  disconnectedCallback() {
      this.unsubscribe();
  }

  render() {
    console.dir(["table ",this.datasouce]);
    const tableOrder = {
      columnshierachy: this.order.split(","),
      direction: this.orderDirection
    };

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
        data={[{
        "setname": "de",
        "data": [{
          operation: '+',
          rowgroup: "Umsatz",
          category: "matrices",
          subcategory: "matrices",
          ac: 1,
          py: 7,
          fc: 7,
          pl: 4
        },
          {
            operation: '+',
            rowgroup: "Umsatz",
            category: "Applications",
            subcategory: "Applications-A",
            ac: 1,
            py: 7,
            fc: 15,
            pl: 5
          },
          {
            operation: '+',
            rowgroup: "Umsatz",
            category: "Applications",
            subcategory: "Applications-B",
            ac: 5,
            py: 7,
            fc: 10,
            pl: 5
          },
          {
            operation: '+',
            rowgroup: "Umsatz",
            category: "mission-critical",
            subcategory: "mission-critical",
            ac: 1,
            py: 7,
            fc: 14,
            pl: 11
          },
          {operation: '+', rowgroup: "Umsatz", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 2, pl: 15},
          {
            operation: '+',
            rowgroup: "Umsatz",
            category: "turquoise",
            subcategory: "turquoise",
            ac: 1,
            py: 7,
            fc: 8,
            pl: 6
          },
          {operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3},
          {
            operation: '-',
            rowgroup: "Kosten",
            category: "Buckinghamshire",
            subcategory: "Buckinghamshire",
            ac: -1,
            py: -7,
            fc: -12,
            pl: 0
          },
          {
            operation: '-',
            rowgroup: "Kosten",
            category: "Credit Card Account",
            subcategory: "Credit Card Account",
            ac: -1,
            py: -7,
            fc: -12,
            pl: -12
          },
          {
            operation: '-',
            rowgroup: "Kosten",
            category: "Gorgeous Fresh Mouse",
            subcategory: "Gorgeous Fresh Mouse",
            ac: -1,
            py: -7,
            fc: -10,
            pl: -11
          },
          {operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 6, pl: 13}]
      },
        {
          "setname": "uk",
          "data": [{
            operation: '+',
            rowgroup: "Umsatz",
            category: "matrices",
            subcategory: "matrices",
            ac: 1,
            py: 7,
            fc: 7,
            pl: 4
          },
            {
              operation: '+',
              rowgroup: "Umsatz",
              category: "Applications",
              subcategory: "Applications",
              ac: 1,
              py: 7,
              fc: 15,
              pl: 5
            },
            {
              operation: '+',
              rowgroup: "Umsatz",
              category: "mission-critical",
              subcategory: "mission-critical",
              ac: 1,
              py: 7,
              fc: 14,
              pl: 11
            },
            {
              operation: '+',
              rowgroup: "Umsatz",
              category: "application",
              subcategory: "pplication",
              ac: 1,
              py: 7,
              fc: 2,
              pl: 15
            },
            {
              operation: '+',
              rowgroup: "Umsatz",
              category: "turquoise",
              subcategory: "turquoise",
              ac: 1,
              py: 7,
              fc: 8,
              pl: 6
            },
            {operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3},
            {
              operation: '-',
              rowgroup: "Kosten",
              category: "Buckinghamshire",
              subcategory: "Buckinghamshire",
              ac: -1,
              py: -7,
              fc: -12,
              pl: 0
            },
            {
              operation: '-',
              rowgroup: "Kosten",
              category: "Credit Card Account",
              subcategory: "Credit Card Account",
              ac: -1,
              py: -7,
              fc: -12,
              pl: -12
            },
            {
              operation: '-',
              rowgroup: "Kosten",
              category: "Gorgeous Fresh Mouse",
              subcategory: "Gorgeous Fresh Mouse",
              ac: -1,
              py: -7,
              fc: -10,
              pl: -11
            },
            {operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: -1, py: -7, fc: -6, pl: -13}]
        }
      ]}
    ></ibcs-table>
    </Host>
  }
}

styled(Table);
