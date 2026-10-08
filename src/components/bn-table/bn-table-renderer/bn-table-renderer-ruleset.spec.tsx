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
import { RuleSetConfig } from "../../../stores/ruleSets";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

// The ruleSetConfig prop seeds the IBCSRuleSet used for scenario column
// ordering, so a user-adjusted sortIndex must reorder the rendered columns.
describe("IBCS Table ruleset column ordering", () => {
  const baseRow = {
    setName: "de",
    operation: "+",
    rowGroup: "Umsatz",
    rowGroupIndex: 0,
    subCategory: "",
    subCategoryIndex: 1,
  };

  const rows: any[] = [
    { ...baseRow, category: "Berlin", categoryIndex: 1, ac1: 50, pp1: 40, pl1: 45 },
    { ...baseRow, category: "Hamburg", categoryIndex: 2, ac1: 30, pp1: 25, pl1: 28 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["rulesetData"] = { data: rows };
  });

  const renderTable = (ruleSetConfig?: RuleSetConfig): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1", "pl1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.AC1],
              direction: OrderDirection.DESC,
            } as Order
          }
          type={TableType.SUM}
          i18n={new Map([["SUM_TOTAL", "Summe"]])}
          i18n-mode={I18nMode.META}
          tableName="rulesetData"
          ruleSetConfig={ruleSetConfig}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes(text),
    );

  it("orders scenario columns by the default IBCS sort indices (pp < pl < ac)", async () => {
    const page = await renderTable();

    const berlinRow = findRowByFirstCell(page, "Berlin");

    expect(berlinRow).toBeDefined();
    expect(cellTexts(berlinRow).slice(0, 4)).toEqual(["Berlin", "40.0", "45.0", "50.0"]);
  });

  it("reorders scenario columns when the ruleSetConfig overrides a sortIndex", async () => {
    const page = await renderTable({ scenarios: { ac: { sortIndex: 0 } } });

    const berlinRow = findRowByFirstCell(page, "Berlin");

    expect(berlinRow).toBeDefined();
    // ac now sorts before pp and pl
    expect(cellTexts(berlinRow).slice(0, 4)).toEqual(["Berlin", "50.0", "40.0", "45.0"]);
  });
});
