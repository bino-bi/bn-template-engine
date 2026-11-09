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
import { OrderDirection, TableType } from "../utils/model";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

// income statement: entry rows unsigned, "-" rows subtract in the sums
const statement = (): any[] => {
  const row = (
    rowGroup: string,
    rowGroupIndex: number,
    category: string,
    categoryIndex: number,
    operation: string,
    pp1: number,
    ac1: number,
  ) => ({
    rowGroup,
    rowGroupIndex,
    category,
    categoryIndex,
    operation,
    pp1,
    ac1,
  });
  return [
    row("Operating result", 1, "Licences", 1, "+", 713.3, 896.4),
    row("Operating result", 1, "Consulting", 2, "+", 72.0, 90.0),
    row("Operating result", 1, "Maintenance", 3, "+", 22.0, 20.4),
    row("Operating result", 1, "Other revenue", 4, "+", 15.0, 24.4),
    row("Operating result", 1, "Other op. income", 5, "+", 45.0, 38.8),
    row("Operating result", 1, "Purchases", 6, "-", 344.2, 379.2),
    row("Operating result", 1, "Material expenses", 7, "-", 11.0, 15.8),
    row("Operating result", 1, "Personnel expenses", 8, "-", 76.0, 87.6),
    row("Operating result", 1, "Amortization", 9, "-", 56.0, 44.4),
    row("Operating result", 1, "Other op. expenses", 10, "-", 78.0, 75.6),
    row("Financial result", 2, "Investment income", 11, "+", 43.0, 53.0),
    row("Financial result", 2, "Financial income, net", 12, "+", 73.0, 69.6),
    row("Taxes", 3, "Income tax", 13, "-", 132.1, 111.1),
    row("Minorities", 4, "Profit to other investors", 14, "-", 50.0, 56.7),
  ];
};

describe("IBCS Table opt variances", () => {
  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["optStatement"] = { data: statement() };
    // a group of only "-" rows
    tables["optExpenses"] = {
      data: statement().map((r) =>
        r.operation === "-" && r.rowGroup === "Operating result" ? { ...r, rowGroup: "Operating expenses" } : r,
      ),
    };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          data-format-digits-decimal={1}
          data-format-digits-percent={0}
          order={{ hierarchy: [OrderColumn.CATEGORYINDEX], direction: OrderDirection.ASC } as Order}
          type={TableType.OPT}
          grouped={true}
          sum-title="Group result"
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="optStatement"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const rowTexts = (page: SpecPage): string[][] =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim()),
    );

  const row = (page: SpecPage, operation: string, label: string): string[] =>
    rowTexts(page).find((cells) => cells[0] === operation && cells[1] === label);

  it("signs the variances of group sums and the grand total", async () => {
    const page = await renderTable();

    // 467.4 - 302.1, the sum of the signed entry variances 208.9 - 6.2 - 37.4
    expect(row(page, "=", "Operating result")).toEqual(["=", "Operating result", "302.1", "467.4", "165.3", "54.72%"]);
    expect(row(page, "=", "Taxes")).toEqual(["=", "Taxes", "-132.1", "-111.1", "21.0", "15.90%"]);
    expect(row(page, "=", "Group result")).toEqual(["=", "Group result", "236.0", "422.2", "186.2", "78.90%"]);
  });

  it("keeps entry rows unsigned", async () => {
    const page = await renderTable();

    expect(row(page, "-", "Purchases")).toEqual(["-", "Purchases", "344.2", "379.2", "35.0", "10.17%"]);
    expect(row(page, "+", "Licences")).toEqual(["+", "Licences", "713.3", "896.4", "183.1", "25.67%"]);
  });

  it("gives a group of only - rows a negative variance", async () => {
    const page = await renderTable({ tableName: "optExpenses" });

    expect(row(page, "=", "Operating expenses")).toEqual([
      "=",
      "Operating expenses",
      "-565.2",
      "-602.6",
      "-37.4",
      "-6.62%",
    ]);
  });

  it("signs the sum rows of optnototal", async () => {
    const page = await renderTable({ type: TableType.OPTNOTOTAL });

    expect(row(page, "=", "Operating result")).toEqual(["=", "Operating result", "302.1", "467.4", "165.3", "54.72%"]);
    expect(row(page, "=", "Group result")).toBeUndefined();
  });

  const classesOf = (page: SpecPage, operation: string, label: string, column: number): string[] => {
    const tr = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((candidate) => {
      const tds = candidate.querySelectorAll("td");
      return tds[0]?.textContent.trim() === operation && tds[1]?.textContent.trim() === label;
    });
    return (tr.querySelectorAll("td")[column].getAttribute("class") || "").split(" ");
  };

  // column 4 is the absolute variance, column 5 the relative one
  it("colours op by the row operation", async () => {
    const page = await renderTable({ scenarios: ["pp1", "ac1", "dac1_pp1_op", "drac1_pp1_op"] });

    // a rising cost is bad, rising revenue and a rising result are good
    expect(classesOf(page, "-", "Purchases", 4)).toContain("pos_neg");
    expect(classesOf(page, "-", "Amortization", 4)).toContain("neg_neg");
    expect(classesOf(page, "+", "Licences", 4)).toContain("pos_pos");
    expect(classesOf(page, "+", "Other op. income", 5)).toContain("neg_pos");
    expect(classesOf(page, "=", "Operating result", 4)).toContain("pos_pos");
    expect(classesOf(page, "=", "Taxes", 4)).toContain("pos_pos");
    expect(classesOf(page, "=", "Group result", 5)).toContain("pos_pos");
  });

  it("colours opinv as the inverse of op", async () => {
    const page = await renderTable({ scenarios: ["pp1", "ac1", "dac1_pp1_opinv"] });

    expect(classesOf(page, "-", "Purchases", 4)).toContain("pos_pos");
    expect(classesOf(page, "+", "Licences", 4)).toContain("pos_neg");
    expect(classesOf(page, "=", "Operating result", 4)).toContain("pos_neg");
  });

  it("gives thereof rows the operation of their parent", async () => {
    getStores(null).db.db.tables["optThereof"] = {
      data: [
        {
          category: "Revenue",
          categoryIndex: 1,
          subCategory: "Licences",
          subCategoryIndex: 1,
          operation: "+",
          pp1: 100,
          ac1: 120,
        },
        {
          category: "Costs",
          categoryIndex: 2,
          subCategory: "Purchases",
          subCategoryIndex: 1,
          operation: "-",
          pp1: 40,
          ac1: 50,
        },
        {
          category: "Costs",
          categoryIndex: 2,
          subCategory: "Personnel",
          subCategoryIndex: 2,
          operation: "-",
          pp1: 30,
          ac1: 35,
        },
      ],
    };
    const page = await renderTable({
      tableName: "optThereof",
      grouped: false,
      scenarios: ["pp1", "ac1", "dac1_pp1_op"],
      thereof: [{ rowGroup: "", category: "Costs", subCategory: "", partOf: "" }],
    });

    const drillRows = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr.ofit"));
    expect(drillRows.length).toBe(2);
    for (const drillRow of drillRows) {
      expect((drillRow.querySelectorAll("td")[4].getAttribute("class") || "").split(" ")).toContain("pos_neg");
    }
  });

  it("treats op like pos and opinv like neg in sum and list tables", async () => {
    for (const type of [TableType.SUM, TableType.LIST]) {
      const op = await renderTable({
        type,
        grouped: false,
        scenarios: ["pp1", "ac1", "dac1_pp1_op", "dac1_pp1_opinv"],
      });
      const pos = await renderTable({
        type,
        grouped: false,
        scenarios: ["pp1", "ac1", "dac1_pp1_pos", "dac1_pp1_neg"],
      });
      const classes = (page: SpecPage) =>
        Array.from(page.root.shadowRoot.querySelectorAll("tbody td")).map((td) => td.getAttribute("class"));
      expect(classes(op)).toEqual(classes(pos));
    }
  });

  it("draws bars and pins of op like pos on + rows and like neg on - rows", async () => {
    const bars = async (sentiment: string) => {
      const scenarios = ["pp1", "ac1", `dac1_pp1_${sentiment}`, `drac1_pp1_${sentiment}`];
      const page = await renderTable({ scenarios, barColumns: scenarios.slice(2) });
      const html = (operation: string, label: string) => {
        const tr = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find(
          (candidate) =>
            candidate.querySelectorAll("td")[0]?.textContent.trim() === operation &&
            candidate.querySelectorAll("td")[1]?.textContent.trim() === label,
        );
        return [4, 5].map((column) => tr.querySelectorAll("td")[column].innerHTML);
      };
      return { purchases: html("-", "Purchases"), licences: html("+", "Licences") };
    };

    const op = await bars("op");
    const opinv = await bars("opinv");
    const pos = await bars("pos");
    const neg = await bars("neg");

    expect(op.licences).toEqual(pos.licences);
    expect(op.purchases).toEqual(neg.purchases);
    expect(opinv.licences).toEqual(neg.licences);
    expect(opinv.purchases).toEqual(pos.purchases);
    expect(op.purchases).not.toEqual(pos.purchases);
  });

  it("colours a REST row of only - rows like a - row", async () => {
    const page = await renderTable({ tableName: "optExpenses", limit: 2, scenarios: ["pp1", "ac1", "dac1_pp1_op"] });

    const restRows = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).filter(
      (tr) => tr.querySelectorAll("td")[1]?.textContent.trim() === "REST",
    );
    const restOf = (index: number) =>
      (restRows[index].querySelectorAll("td")[4].getAttribute("class") || "").split(" ");
    // groups in order: Operating result (+ only), Operating expenses (- only); Financial result has 2 rows, no REST
    expect(restRows[0].querySelectorAll("td")[0].textContent.trim()).toBe("");
    expect(restOf(0)).toContain("pos_pos");
    expect(restOf(1)).toContain("neg_neg");
  });
});
