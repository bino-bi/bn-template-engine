// Mock MutationObserver for withComponentStyle mixin
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../../stores/internationalization");
  const { createScopedDb } = require("../../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { h } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../../context/context-protocol";
import { BnTableRenderer } from "./bn-table-renderer";
import { OrderDirection, TableType, ThereofPosition } from "../utils/model";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

// IBCS income statement: each rowGroup ends in a result, Operating expenses has components
const statement = (): any[] => {
  const row = (
    rowGroup: string,
    rowGroupIndex: number,
    category: string,
    categoryIndex: number,
    operation: string,
    pp1: number,
    pl1: number,
    ac1: number,
    subCategory?: string,
    subCategoryIndex?: number,
  ) => ({ rowGroup, rowGroupIndex, category, categoryIndex, subCategory, subCategoryIndex, operation, pp1, pl1, ac1 });
  const expense = (subCategory: string, subCategoryIndex: number, pp1: number, pl1: number, ac1: number) =>
    row("Operating result", 2, "Operating expenses", 6, "-", pp1, pl1, ac1, subCategory, subCategoryIndex);
  return [
    row("Sales revenue", 1, "Licences", 1, "+", 713.3, 749.0, 896.4),
    row("Sales revenue", 1, "Consulting", 2, "+", 72.0, 75.6, 90.0),
    row("Sales revenue", 1, "Maintenance", 3, "+", 22.0, 22.0, 20.4),
    row("Sales revenue", 1, "Other revenue", 4, "+", 15.0, 25.0, 24.4),
    row("Operating result", 2, "Other op. income", 5, "+", 45.0, 35.0, 38.8),
    expense("Purchases", 1, 344.2, 361.4, 379.2),
    expense("Material expenses", 2, 11.0, 11.6, 15.8),
    expense("Personnel expenses", 3, 76.0, 79.8, 87.6),
    expense("Amortization", 4, 56.0, 56.0, 44.4),
    expense("Other op. expenses", 5, 78.0, 76.0, 75.6),
    row("Result before tax", 3, "Investment income", 7, "+", 43.0, 39.0, 53.0),
    row("Result before tax", 3, "Financial income, net", 8, "+", 73.0, 66.0, 69.6),
    row("Result after tax", 4, "Income tax", 9, "-", 132.1, 115.0, 111.1),
    row("Group result", 5, "Profit to other investors", 10, "-", 50.0, 52.0, 56.7),
  ];
};

const expenses = [{ rowGroup: "Operating result", category: "Operating expenses", subCategory: "", partOf: "" }];

describe("IBCS Table running sums and thereof rows above their parent", () => {
  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["calcStatement"] = { data: statement() };
    tables["calcBlankGroup"] = {
      data: statement().map((r) => (r.rowGroup === "Sales revenue" ? { ...r, rowGroup: "" } : r)),
    };
    // the first half of every value in January, the rest in February; Income tax only in February
    tables["calcMonths"] = {
      data: statement().flatMap((r) =>
        r.category === "Income tax"
          ? [{ ...r, setname: "Feb" }]
          : [
              { ...r, setname: "Jan", pp1: r.pp1 / 2, pl1: r.pl1 / 2, ac1: r.ac1 / 2 },
              { ...r, setname: "Feb", pp1: r.pp1 / 2, pl1: r.pl1 / 2, ac1: r.ac1 / 2 },
            ],
      ),
    };
    // group A has no previous year at all
    const leading = [
      { rowGroup: "A", rowGroupIndex: 1, category: "a1", categoryIndex: 1, operation: "+", ac1: 10 },
      { rowGroup: "B", rowGroupIndex: 2, category: "b1", categoryIndex: 2, operation: "+", ac1: 5, pp1: 4 },
    ];
    // a category named like its rowGroup: its thereof rows do not all follow their parent
    const sameName = (category: string, categoryIndex: number, ac1: number, subCategory?: string) => ({
      rowGroup: "Revenue",
      rowGroupIndex: 1,
      category,
      categoryIndex,
      subCategory,
      operation: "+",
      ac1,
    });
    tables["calcSameName"] = {
      data: [
        sameName("Revenue", 1, 700, "Cloud"),
        sameName("Revenue", 1, 100, "OnPrem"),
        sameName("Consulting", 2, 50),
        sameName("Maintenance", 3, 30),
      ],
    };
    tables["calcNoReference"] = { data: leading };
    tables["calcNoReferenceMonths"] = { data: leading.map((r) => ({ ...r, setname: "Jan" })) };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["pp1", "pl1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          dataFormatDigits={{ percent: 0, decimal: 1 }}
          order={{ hierarchy: [OrderColumn.CATEGORYINDEX], direction: OrderDirection.ASC } as Order}
          type={TableType.OPTNOTOTAL}
          grouped={true}
          showGroupTitle={false}
          runningSum={true}
          i18n={new Map([["thereof", "thereof"]])}
          i18n-mode={I18nMode.META}
          tableName="calcStatement"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const rows = (page: SpecPage): HTMLElement[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));

  const rowTexts = (page: SpecPage): string[][] =>
    rows(page).map((row) => Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim()));

  const row = (page: SpecPage, operation: string, label: string): string[] =>
    rowTexts(page).find((cells) => cells[0] === operation && cells[1] === label);

  const rowClass = (page: SpecPage, label: string): string =>
    rows(page)
      .find((tr) => tr.querySelectorAll("td")[1]?.textContent.trim() === label)
      .getAttribute("class") ?? "";

  describe("income statement", () => {
    const renderStatement = () => renderTable({ thereof: expenses, thereofPosition: ThereofPosition.ABOVE });

    // columns: operation, label, PY, PL, AC, dPY, dPY%
    it("prints the row structure of the IBCS income statement", async () => {
      const page = await renderStatement();

      expect(rowTexts(page).map((cells) => cells.slice(0, 5))).toEqual([
        ["+", "Licences", "713.3", "749.0", "896.4"],
        ["+", "Consulting", "72.0", "75.6", "90.0"],
        ["+", "Maintenance", "22.0", "22.0", "20.4"],
        ["+", "Other revenue", "15.0", "25.0", "24.4"],
        ["=", "Sales revenue", "822.3", "871.6", "1,031.2"],
        ["+", "Other op. income", "45.0", "35.0", "38.8"],
        ["", "Purchases", "344.2", "361.4", "379.2"],
        ["", "Material expenses", "11.0", "11.6", "15.8"],
        ["", "Personnel expenses", "76.0", "79.8", "87.6"],
        ["", "Amortization", "56.0", "56.0", "44.4"],
        ["", "Other op. expenses", "78.0", "76.0", "75.6"],
        ["-", "Operating expenses", "565.2", "584.8", "602.6"],
        ["=", "Operating result", "302.1", "321.8", "467.4"],
        ["+", "Investment income", "43.0", "39.0", "53.0"],
        ["+", "Financial income, net", "73.0", "66.0", "69.6"],
        ["=", "Result before tax", "418.1", "426.8", "590.0"],
        ["-", "Income tax", "132.1", "115.0", "111.1"],
        ["=", "Result after tax", "286.0", "311.8", "478.9"],
        ["-", "Profit to other investors", "50.0", "52.0", "56.7"],
        ["=", "Group result", "236.0", "259.8", "422.2"],
      ]);
    });

    it("gives the parent row and the running result their variances", async () => {
      const page = await renderStatement();

      expect(row(page, "-", "Operating expenses").slice(5)).toEqual(["37.4", "7%"]);
      expect(row(page, "=", "Operating result").slice(5)).toEqual(["165.3", "55%"]);
      expect(row(page, "=", "Group result").slice(5)).toEqual(["186.2", "79%"]);
    });

    it("styles the components as normal rows and the parent as a subtotal", async () => {
      const page = await renderStatement();

      expect(rowClass(page, "Purchases")).toBe("ofit-above");
      expect(rowClass(page, "Other op. expenses")).toBe("ofit-above");
      expect(rowClass(page, "Operating expenses")).toBe("ofit-sum");
      expect(rowClass(page, "Other op. income")).toBe("");
      expect(rowClass(page, "Operating result")).toBe("sum");
      expect(page.root.shadowRoot.querySelectorAll("tbody tr.ofit").length).toBe(0);
    });
  });

  describe("runningSum", () => {
    it("keeps own group sums without it", async () => {
      const page = await renderTable({ runningSum: false });

      expect(row(page, "=", "Operating result").slice(2)).toEqual(["-520.2", "-549.8", "-563.8", "-43.6", "-8%"]);
      expect(row(page, "=", "Group result").slice(2)).toEqual(["-50.0", "-52.0", "-56.7", "-6.7", "-13%"]);
    });

    it("keeps the total row of opt, which repeats the last running result", async () => {
      const page = await renderTable({ type: TableType.OPT, sumTitle: "Total" });

      expect(row(page, "=", "Group result").slice(2)).toEqual(["236.0", "259.8", "422.2", "186.2", "79%"]);
      expect(row(page, "=", "Total").slice(2)).toEqual(["236.0", "259.8", "422.2", "186.2", "79%"]);
    });

    it("accumulates the group sums of a sum table", async () => {
      const page = await renderTable({ type: TableType.SUMNOTOTAL, scenarios: ["ac1", "dac1_pp1_pos"] });
      const sums = rowTexts(page).filter((cells) => rowClassOf(page, cells[0]) === "sum");

      expect(sums).toEqual([
        ["Sales revenue", "1,031.2", "208.9"],
        ["Operating result", "467.4", "165.3"],
        ["Result before tax", "590.0", "171.9"],
        ["Result after tax", "478.9", "192.9"],
        ["Group result", "422.2", "186.2"],
      ]);
    });

    const rowClassOf = (page: SpecPage, label: string): string =>
      rows(page)
        .find((tr) => tr.querySelectorAll("td")[0]?.textContent.trim() === label)
        ?.getAttribute("class");

    it("has no effect on an ungrouped table", async () => {
      // a new page replaces the one before it, so each one is read before the next is made
      const off = rowTexts(await renderTable({ grouped: false, type: TableType.OPT, runningSum: false }));
      const on = rowTexts(await renderTable({ grouped: false, type: TableType.OPT }));

      expect(on).toEqual(off);
      expect(on.length).toBe(11);
    });

    it("has no effect on a list table", async () => {
      const off = rowTexts(await renderTable({ type: TableType.LIST, runningSum: false }));
      const on = rowTexts(await renderTable({ type: TableType.LIST }));

      expect(off.length).toBe(15);
      expect(on).toEqual(off);
    });

    it("runs on from a blank rowGroup", async () => {
      const page = await renderTable({ tableName: "calcBlankGroup" });

      // the blank group has no rowGroupIndex of its own here, so only the values are checked
      expect(row(page, "=", "-").slice(2, 5)).toEqual(["822.3", "871.6", "1,031.2"]);
      expect(row(page, "=", "Operating result").slice(2, 5)).toEqual(["302.1", "321.8", "467.4"]);
      expect(row(page, "=", "Group result").slice(2, 5)).toEqual(["236.0", "259.8", "422.2"]);
    });

    it("keeps the group titles and the rows below them", async () => {
      const page = await renderTable({
        showGroupTitle: true,
        thereof: expenses,
        thereofPosition: ThereofPosition.ABOVE,
      });
      const labels = rowTexts(page).map((cells) => cells[1]);

      expect(labels.slice(6, 15)).toEqual([
        "Operating result",
        "Other op. income",
        "Purchases",
        "Material expenses",
        "Personnel expenses",
        "Amortization",
        "Other op. expenses",
        "Operating expenses",
        "Operating result",
      ]);
      expect(rows(page)[6].getAttribute("class")).toBe("groupheader");
      expect(row(page, "=", "Operating result").slice(2)).toEqual(["302.1", "321.8", "467.4", "165.3", "55%"]);
      expect(row(page, "=", "Group result").slice(2, 5)).toEqual(["236.0", "259.8", "422.2"]);
    });

    it("keeps partof shares on the own group sum", async () => {
      const partof = [{ rowGroup: "Result before tax", category: "Investment income" }];
      const share = (page: SpecPage) => rows(page).find((tr) => tr.getAttribute("class") === "partof").textContent;
      const off = share(await renderTable({ partof, scenarios: ["ac1"], runningSum: false }));
      const on = share(await renderTable({ partof, scenarios: ["ac1"] }));

      // 53.0 of 122.6, not of the running 590.0
      expect(on).toContain("43");
      expect(on).toEqual(off);
    });

    it("accumulates the interval buckets too", async () => {
      const page = await renderTable({ tableName: "calcMonths", interval: "setname", scenarios: ["ac1"] });

      // Jan | Feb; the January half has no income tax, so its results stay higher from there on
      expect(row(page, "=", "Sales revenue").slice(2)).toEqual(["515.6", "515.6"]);
      expect(row(page, "=", "Operating result").slice(2)).toEqual(["233.7", "233.7"]);
      expect(row(page, "=", "Result before tax").slice(2)).toEqual(["295.0", "295.0"]);
      expect(row(page, "=", "Result after tax").slice(2)).toEqual(["295.0", "183.9"]);
      expect(row(page, "=", "Group result").slice(2)).toEqual(["266.7", "155.6"]);
    });

    it("accumulates the variances of the interval buckets, relative to the running reference", async () => {
      const page = await renderTable({
        tableName: "calcMonths",
        interval: "setname",
        scenarios: ["pp1", "ac1", "dac1_pp1_op", "drac1_pp1_op"],
      });

      // per bucket: PY, AC, dPY, dPY%; the income tax of February is 132.1 and 111.1, 16% of its own group
      expect(row(page, "=", "Operating result").slice(2)).toEqual([
        ...["151.0", "233.7", "82.7", "55%"],
        ...["151.0", "233.7", "82.7", "55%"],
      ]);
      expect(row(page, "=", "Result after tax").slice(2)).toEqual([
        ...["209.0", "295.0", "86.0", "41%"],
        ...["76.9", "183.9", "107.0", "139%"],
      ]);
      expect(row(page, "=", "Group result").slice(2)).toEqual([
        ...["184.0", "266.7", "82.6", "45%"],
        ...["51.9", "155.6", "103.6", "199%"],
      ]);
    });

    it("follows the printed order of groups sorted by a value", async () => {
      const page = await renderTable({
        scenarios: ["ac1"],
        order: { hierarchy: ["ac1"], direction: OrderDirection.DESC } as Order,
      });
      const sums = rowTexts(page).filter((cells) => cells[0] === "=");

      // own sums: 1,031.2, 122.6, -56.7, -111.1, -563.8
      expect(sums).toEqual([
        ["=", "Sales revenue", "1,031.2"],
        ["=", "Result before tax", "1,153.8"],
        ["=", "Group result", "1,097.1"],
        ["=", "Result after tax", "986.0"],
        ["=", "Operating result", "422.2"],
      ]);
    });

    describe("a leading group without the reference of a variance", () => {
      const scenarios = ["ac1", "dac1_pp1_pos", "drac1_pp1_pos"];
      const props = { tableName: "calcNoReference", type: TableType.SUMNOTOTAL, scenarios };

      it("keeps the variance of its sum row empty, as without runningSum", async () => {
        const sums = async (runningSum: boolean) =>
          rowTexts(await renderTable({ ...props, runningSum })).filter((cells) => ["A", "B"].includes(cells[0]));

        expect(await sums(false)).toEqual([
          ["A", "10.0", "-", "-"],
          ["B", "5.0", "1.0", "25%"],
        ]);
        expect(await sums(true)).toEqual([
          ["A", "10.0", "-", "-"],
          ["B", "15.0", "1.0", "25%"],
        ]);
      });

      it("keeps it empty in an interval bucket too", async () => {
        const sums = async (runningSum: boolean) =>
          rowTexts(
            await renderTable({ ...props, tableName: "calcNoReferenceMonths", interval: "setname", runningSum }),
          ).filter((cells) => ["A", "B"].includes(cells[0]));

        const off = await sums(false);
        expect(off[0].slice(1)).toEqual(["10.0", "-", "-"]);
        expect(await sums(true)).toEqual([off[0], ["B", "15.0", "1.0", "25%"]]);
      });
    });

    it("draws the result as an anchor bar and walks on from it", async () => {
      const page = await renderTable({ scenarios: ["ac1"], barColumns: ["ac1"] });
      const barOf = (label: string) => {
        const tr = rows(page).find((candidate) => candidate.querySelectorAll("td")[1]?.textContent.trim() === label);
        // the bar rect is a direct child of the svg; pattern rects live inside <defs>
        const rect = Array.from(tr.querySelectorAll("svg.waterfall-bar rect")).find(
          (candidate) => (candidate.parentNode as Element).tagName?.toLowerCase() === "svg",
        );
        return { x: parseFloat(rect.getAttribute("x")), width: parseFloat(rect.getAttribute("width")) };
      };

      const sales = barOf("Sales revenue");
      const income = barOf("Other op. income");
      const result = barOf("Operating result");
      const investment = barOf("Investment income");
      // Other op. income starts where the Sales revenue bar ends, Investment income where Operating result ends
      expect(income.x).toBeCloseTo(sales.x + sales.width, 1);
      expect(result.x).toBeCloseTo(sales.x, 1);
      expect(investment.x).toBeCloseTo(result.x + result.width, 1);
    });
  });

  describe("thereofPosition above", () => {
    const flat = [{ rowGroup: "", category: "Operating expenses", subCategory: "", partOf: "" }];
    const labels = (page: SpecPage) => rowTexts(page).map((cells) => cells[1]);

    it("keeps the rows below the parent by default", async () => {
      const page = await renderTable({ thereof: expenses });

      expect(labels(page).slice(5, 9)).toEqual([
        "Other op. income",
        "Operating expenses",
        "thereof Purchases",
        "thereof Material expenses",
      ]);
      expect(rowClass(page, "Operating expenses")).toBe("");
      expect(page.root.shadowRoot.querySelectorAll("tbody tr.ofit").length).toBe(5);
    });

    it("keeps the sentiment of the parent operation on the moved rows", async () => {
      const page = await renderTable({
        thereof: expenses,
        thereofPosition: ThereofPosition.ABOVE,
        scenarios: ["pp1", "ac1", "dac1_pp1_op"],
      });
      const variance = (label: string) =>
        rows(page)
          .find((tr) => tr.querySelectorAll("td")[1]?.textContent.trim() === label)
          .querySelectorAll("td")[4]
          .getAttribute("class")
          .split(" ");

      // a rising cost is bad, a falling one good, although the row above them is a "+" row
      expect(variance("Purchases")).toContain("pos_neg");
      expect(variance("Amortization")).toContain("neg_neg");
      expect(variance("Operating expenses")).toContain("pos_neg");
    });

    it.each([
      ["category asc", [OrderColumn.CATEGORY], OrderDirection.ASC],
      ["category desc", [OrderColumn.CATEGORY], OrderDirection.DESC],
      ["categoryindex desc", [OrderColumn.CATEGORYINDEX], OrderDirection.DESC],
      ["ac1 desc", ["ac1"], OrderDirection.DESC],
      ["subcategoryindex asc", ["subcategoryindex"], OrderDirection.ASC],
    ])("puts the same rows in the same order before the parent with order %s", async (_name, hierarchy, direction) => {
      const order = { hierarchy, direction } as Order;
      for (const grouped of [true, false]) {
        const props = { order, grouped, type: TableType.OPT, thereof: grouped ? expenses : flat, scenarios: ["ac1"] };
        const below = labels(await renderTable(props));
        const above = labels(await renderTable({ ...props, thereofPosition: ThereofPosition.ABOVE }));

        const parent = below.indexOf("Operating expenses");
        const children = below.slice(parent + 1, parent + 6).map((label) => label.replace("thereof ", ""));
        expect(children.slice().sort()).toEqual(
          ["Amortization", "Material expenses", "Other op. expenses", "Personnel expenses", "Purchases"].sort(),
        );
        expect(above).toEqual([
          ...below.slice(0, parent),
          ...children,
          "Operating expenses",
          ...below.slice(parent + 6),
        ]);
      }
    });

    it("moves a thereof row only above its own parent", async () => {
      const props = {
        tableName: "calcSameName",
        scenarios: ["ac1"],
        showGroupTitle: true,
        thereof: [{ rowGroup: "Revenue", category: "Revenue", subCategory: "", partOf: "" }],
      };
      const printed = async (thereofPosition: ThereofPosition) => {
        const page = await renderTable({ ...props, thereofPosition });
        return rows(page).map((tr, index) => [tr.getAttribute("class") ?? "", ...rowTexts(page)[index]].join("|"));
      };
      const below = await printed(ThereofPosition.BELOW);
      const above = await printed(ThereofPosition.ABOVE);

      // no row here follows its parent, so none is moved, none loses its label and no row turns into a subtotal
      expect(below.filter((line) => line.includes("thereof")).length).toBe(4);
      expect(above).toEqual(below);
    });

    it("keeps the thereof geometry of a waterfall on the parent bar", async () => {
      const props = { thereof: expenses, scenarios: ["ac1"], barColumns: ["ac1"] };
      const labels = ["Operating result", "Purchases", "Other op. expenses", "Operating expenses"];
      // bars as [start, length] in lengths of the Operating result bar, which starts at the axis:
      // the bold parent label takes a little more room above, so only the scale may differ
      const bars = (page: SpecPage): number[][] => {
        const rects = labels.map((label) =>
          Array.from(
            rows(page)
              .find((tr) => tr.querySelectorAll("td")[1]?.textContent.trim().replace("thereof ", "") === label)
              .querySelectorAll("svg.waterfall-bar rect"),
          ).find((rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg"),
        );
        const [x, width] = ["x", "width"].map((name) => rects.map((rect) => parseFloat(rect.getAttribute(name))));
        return rects.map((_, index) => [(x[index] - x[0]) / width[0], width[index] / width[0]]);
      };
      const below = bars(await renderTable(props));
      const above = bars(await renderTable({ ...props, thereofPosition: ThereofPosition.ABOVE }));

      expect(below[1][1]).toBeGreaterThan(0);
      above.flat().forEach((value, index) => expect(value).toBeCloseTo(below.flat()[index], 6));
    });
  });
});
