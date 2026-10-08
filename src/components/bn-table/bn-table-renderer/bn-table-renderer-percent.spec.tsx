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
import { DataFormat, I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

describe("IBCS Table percent format", () => {
  const baseRow = {
    setName: "de",
    operation: "+",
    rowGroup: "",
    rowGroupIndex: 0,
    subCategory: "",
    subCategoryIndex: 1,
  };

  // the values are fractions: 0.031 is 3.10%
  const rows: any[] = [
    { ...baseRow, category: "Margin", categoryIndex: 1, ac1: 0.031, pp1: 0.052 },
    { ...baseRow, category: "Return rate", categoryIndex: 2, ac1: 0.125, pp1: 0.1 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["pctData"] = { data: rows };
  });

  afterEach(() => {
    getStores(null).context.state.locale = "en";
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          scenariosDataFormat={DataFormat.PERCENT}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.ASC,
            } as Order
          }
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="pctData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes(text),
    );

  it("prints an absolute variance as percentage points", async () => {
    const page = await renderTable();

    const margin = findRowByFirstCell(page, "Margin");

    // 3.10 - 5.20 = -2.10 points; -0.021 / 0.052 = -40.38%
    expect(cellTexts(margin)).toEqual(["Margin", "5.20%", "3.10%", "-2.10", "-40.38%"]);
    // 12.50 - 10.00 = 2.50 points; 0.025 / 0.1 = 25%
    expect(cellTexts(findRowByFirstCell(page, "Return rate"))).toEqual([
      "Return rate",
      "10.00%",
      "12.50%",
      "2.50",
      "25.00%",
    ]);

    const classes = margin.querySelectorAll("td")[3].getAttribute("class").split(" ");

    expect(classes).toContain("percentpoint");
    expect(classes).not.toContain("decimal");
  });

  it("prints German separators for de", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable();

    expect(cellTexts(findRowByFirstCell(page, "Margin")).slice(2, 4)).toEqual(["3,10%", "-2,10"]);
  });

  it("does not apply the measure scale to percentage points", async () => {
    const page = await renderTable({ "measure-scale": "k" });

    expect(cellTexts(findRowByFirstCell(page, "Margin"))[3]).toBe("-2.10");
  });

  it("leaves part-of rows unchanged", async () => {
    const page = await renderTable({
      type: TableType.SUM,
      partof: [{ rowGroup: "", category: "Margin", subCategory: "", partOf: "" }],
    });

    const partRow = page.root.shadowRoot.querySelector("tbody tr.partof");

    expect(partRow).not.toBeNull();
    // share of the variance in the total variance: -0.021 / (-0.021 + 0.025) = -525%
    expect(cellTexts(partRow)).toEqual(["in % von ❖", "-", "-", "-525.00%", "-"]);
  });
});
