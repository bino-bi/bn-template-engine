import { r as registerInstance, h } from './index-947c0ad3.js';
import { T as TableType, I as I18nMode } from './model-06841a6d.js';

const TestRunner = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    render() {
        return (h("div", null, h("ibcs-table", { "table-title": "\uD83D\uDE0ESven ist der Papa von Phineas und Max", scenarios: ["ac", "py"], grouped: false, type: TableType.LIST, "i18n-mode": I18nMode.NONE, data: [{
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
            ] })));
    }
};

export { TestRunner as test_runner };
