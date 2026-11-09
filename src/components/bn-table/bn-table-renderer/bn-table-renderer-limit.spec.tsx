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

// Regression tests for https://github.com/bino-bi/example-reports/issues/102 --
// the REST row (aggregate of rows beyond `limit`) must cover ALL configured
// scenarios, not just the formerly hardcoded ac1/pp1 set.
describe("IBCS Table limit REST row", () => {
  const baseRow = {
    setName: "de",
    operation: "+",
    rowGroup: "Umsatz",
    rowGroupIndex: 0,
    subCategory: "",
    subCategoryIndex: 1,
  };

  // order ac1 desc + limit 2 shows Berlin and Hamburg; REST = München + Köln
  const limitRows: any[] = [
    { ...baseRow, category: "Berlin", categoryIndex: 1, ac1: 50, pp1: 40, pl1: 45, fc1: 48 },
    { ...baseRow, category: "Hamburg", categoryIndex: 2, ac1: 30, pp1: 25, pl1: 28, fc1: 29 },
    { ...baseRow, category: "München", categoryIndex: 3, ac1: 20, pp1: 16, pl1: 19, fc1: 21 },
    { ...baseRow, category: "Köln", categoryIndex: 4, ac1: 10, pp1: 12, pl1: 11, fc1: 9 },
  ];

  // fc1 is null for every row beyond the limit -> REST fc1 must render as no-data
  const limitRowsNullFc: any[] = limitRows.map((row) =>
    row.category === "München" || row.category === "Köln" ? { ...row, fc1: null } : row,
  );

  const i18n = new Map([["SUM_TOTAL", "Summe"]]);

  beforeAll(() => {
    getStores(null).db.db.tables["limitData"] = { data: limitRows };
    getStores(null).db.db.tables["limitDataNullFc"] = { data: limitRowsNullFc };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1", "pl1", "fc1", "dpp1_ac1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.AC1],
              direction: OrderDirection.DESC,
            } as Order
          }
          limit={2}
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="limitData"
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

  it("aggregates all configured scenarios in the REST row, including pl1 and fc1", async () => {
    const page = await renderTable();

    const restRow = findRowByFirstCell(page, "REST");

    expect(restRow).toBeDefined();
    // columns: category, pp1, pl1, fc1, ac1 (München + Köln summed)
    expect(cellTexts(restRow).slice(0, 5)).toEqual(["REST", "28.0", "30.0", "30.0", "30.0"]);
  });

  it("translates the REST label even in META mode", async () => {
    // REST is engine-generated, not a data value, so it is translated like
    // SUM_TOTAL rather than being gated behind I18nMode.ALL.
    const page = await renderTable({
      i18n: new Map([
        ["SUM_TOTAL", "Summe"],
        ["REST", "Übrige"],
      ]),
    });

    const restRow = findRowByFirstCell(page, "Übrige");

    expect(restRow).toBeDefined();
    expect(cellTexts(restRow)[0]).toEqual("Übrige");
    expect(findRowByFirstCell(page, "Berlin")).toBeDefined();
  });

  it("computes absolute and relative variances in the REST row", async () => {
    const page = await renderTable();

    const restRow = findRowByFirstCell(page, "REST");

    // drac1_pp1_pos = ((20+10) - (16+12)) / (16+12) = 7.14%; dpp1_ac1_pos = (16+12) - (20+10) = -2
    // drac1_pp1 (reference PP) sorts before dpp1_ac1 (reference AC)
    expect(cellTexts(restRow).slice(5, 7)).toEqual(["7.14%", "-2.0"]);
  });

  it("renders no-data for a scenario that is null in every row beyond the limit", async () => {
    const page = await renderTable({ tableName: "limitDataNullFc" });

    const restRow = findRowByFirstCell(page, "REST");

    // fc1 is null for München and Köln -> REST fc1 has no contributing rows
    expect(cellTexts(restRow)[3]).toEqual("-");
    // the other scenarios still aggregate
    expect(cellTexts(restRow).slice(0, 3)).toEqual(["REST", "28.0", "30.0"]);
  });

  it("keeps the total sum row aggregating all rows, not just the visible ones", async () => {
    const page = await renderTable();

    const sumRow = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.getAttribute("class")?.includes("sum"),
    );

    expect(sumRow).toBeDefined();
    // pp1=93, pl1=103, fc1=107, ac1=110 over all four categories
    expect(cellTexts(sumRow).slice(1, 5)).toEqual(["93.0", "103.0", "107.0", "110.0"]);
  });
});
