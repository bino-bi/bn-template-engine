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

describe("IBCS Table number locale", () => {
  const rows: any[] = [
    {
      setName: "de",
      operation: "+",
      rowGroup: "Umsatz",
      rowGroupIndex: 0,
      category: "Berlin",
      categoryIndex: 1,
      subCategory: "",
      subCategoryIndex: 1,
      ac1: 1234.5,
      pp1: 1000,
    },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["localeData"] = { data: rows };
  });

  afterEach(() => {
    getStores(null).context.state.locale = "en";
  });

  const renderTable = (): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "drac1_pp1_pos"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.AC1],
              direction: OrderDirection.DESC,
            } as Order
          }
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="localeData"
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes(text),
    );

  it("prints English numbers when the context locale is en", async () => {
    const page = await renderTable();

    // (1234.5 - 1000) / 1000 = 23.45%
    expect(cellTexts(findRowByFirstCell(page, "Berlin")).slice(1)).toEqual(["1,234.5", "23.45%"]);
  });

  it("prints German numbers when the context locale is de", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable();

    expect(cellTexts(findRowByFirstCell(page, "Berlin")).slice(1)).toEqual(["1.234,5", "23,45%"]);
  });
});
