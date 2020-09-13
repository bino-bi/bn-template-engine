import { r as registerInstance, h, e as Host, g as getElement } from './index-947c0ad3.js';
import { s as styled } from './styled-89a75ade.js';
import { g as get, o as onChange } from './datasource-c851b622.js';

const bnTableCss = "bn-table{overflow:hidden}";

const Table = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    componentWillLoad() {
        this.datasouce = get("test");
        this.unsubscribe = onChange("test", (value) => this.datasouce = value);
    }
    componentDidUnload() {
        this.unsubscribe();
    }
    render() {
        console.dir(["XX", this.datasouce]);
        const tableOrder = {
            columnshierachy: this.order.split(","),
            direction: this.orderDirection
        };
        return h(Host, null, h("ibcs-table", { "table-title": this.tableTitle, scenarios: this.scenarios.split(","), grouped: this.grouped, "show-group-title": this.showGroupTitle, type: this.type, "i18n-mode": "NONE", limit: this.limit, thereof: this.thereof ? JSON.parse(this.thereof) : undefined, order: tableOrder, i18n: new Map([
                ["title1", "🤩"]
            ]), data: [{
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
                        { operation: '+', rowgroup: "Umsatz", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 2, pl: 15 },
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
                        { operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3 },
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
                        { operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: 1, py: 7, fc: 6, pl: 13 }]
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
                        { operation: '+', rowgroup: "Umsatz", category: "Frozen", subcategory: "Frozen", ac: 1, py: 7, fc: 14, pl: 3 },
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
                        { operation: '-', rowgroup: "Kosten", category: "lime", subcategory: "lime", ac: -1, py: -7, fc: -6, pl: -13 }]
                }
            ] }));
    }
    get element() { return getElement(this); }
};
styled(Table);
Table.style = bnTableCss;

export { Table as bn_table };
