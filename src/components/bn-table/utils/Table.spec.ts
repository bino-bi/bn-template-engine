import { Table } from "./Table";
// import {IBCSRuleSet} from "../../../utils/ibcsRuleSet";
import { TableComponentConfig } from "./model/TableComponentConfig";
import { Cell, TableRow } from "./elements";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";

describe("Table Class Test", () => {
  // Fixme to DataRow
  const dataSet: any[] = [
    {
      setName: "de",
      operation: "+",
      rowGroup: "Services",
      rowGroupIndex: 0,
      category: "Category A",
      categoryIndex: 1,
      subCategory: "Category - SUB 1",
      subCategoryIndex: 1,
      columnGroup: "DE",
      columnGroupIndex: 1,
      columnSubGroup: "Berlin",
      columnSubGroupIndex: 1,
      ac1: 1,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
  ];

  it("should return default if empty data object runs with default IBCSRuleset", () => {
    const table = new Table(new IBCSRuleSet(), [], new TableComponentConfig());
    table.setData(dataSet, "");
    expect(table.getBody()).toEqual([
      {
        cssStyle: "",
        elements: [
          {
            colSpan: 1,
            cssStyle: "category-w25  base",
            index: 0,
            key: "category",
            mark: undefined,
            measureScale: 1,
            prefix: "",
            prefixStyle: "prefix-first",
            type: "",
            value: "Category A",
          },
        ],
        groupindex: 0,
        index: 0,
        type: "STANDARD",
      },
    ]);
  });

  it("should run with i18n null", () => {
    const table = new Table(new IBCSRuleSet(), [], new TableComponentConfig());
    table.setData(dataSet, "");
    table.setI18n(new Map());
    expect(table.getBody()).toEqual([
      {
        cssStyle: "",
        elements: [
          {
            colSpan: 1,
            cssStyle: "category-w25  base",
            index: 0,
            key: "category",
            mark: undefined,
            measureScale: 1,
            prefix: "",
            prefixStyle: "prefix-first",
            type: "",
            value: "Category A",
          },
        ],
        groupindex: 0,
        index: 0,
        type: "STANDARD",
      },
    ]);
  });

  it("should run the header with default config", () => {
    const table = new Table(new IBCSRuleSet(), [], new TableComponentConfig());
    table.setData(dataSet, "");
    table.update();
    expect(table.getHeader()).toEqual([
      {
        index: 0,
        groupindex: 0,
        type: "HEADER",
        cssStyle: "groupheader",
        elements: [new Cell("category", 0, " ", "headerlabel  base", null, "", "prefix-first", 1, 1)],
      } as TableRow,
      {
        index: 1,
        groupindex: 0,
        type: "SEPERATORLINE",
        cssStyle: "",
        elements: [new Cell("category", 0, null, "category  base", null, "", "prefix-first", 1, 1)],
      } as TableRow,
    ]);
  });

  it("should run the rerunned header with default config", () => {
    const table = new Table(new IBCSRuleSet(), [], new TableComponentConfig());
    table.setData(dataSet, "");
    table.setConfig(new TableComponentConfig());
    expect(table.getHeader()).toEqual([
      {
        index: 0,
        groupindex: 0,
        type: "HEADER",
        cssStyle: "groupheader",
        elements: [new Cell("category", 0, " ", "headerlabel  base", null, "", "prefix-first", 1, 1)],
      } as TableRow,
      {
        index: 1,
        groupindex: 0,
        type: "SEPERATORLINE",
        cssStyle: "",
        elements: [new Cell("category", 0, null, "category  base", null, "", "prefix-first", 1, 1)],
      } as TableRow,
    ]);
  });
});
