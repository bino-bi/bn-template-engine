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

describe("IBCS Table no-data label", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["emptyData"] = { data: [] };
  });

  const renderTable = (i18n: Map<string, string>): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.DESC,
            } as Order
          }
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.ALL}
          tableName="emptyData"
        ></bn-table-renderer>
      ),
    });

  it("falls back to plain 'No Data' when the i18n map has no no-data entry", async () => {
    const page = await renderTable(new Map());

    expect(page.root.shadowRoot.textContent.trim()).toEqual("No Data");
  });

  it("renders the message in the empty-state box instead of a table", async () => {
    const page = await renderTable(new Map());

    expect(page.root.classList.contains("no-data")).toBe(true);
    expect(page.root.shadowRoot.querySelector(".empty-state").textContent.trim()).toEqual("No Data");
    expect(page.root.shadowRoot.querySelector("table")).toBeNull();
  });

  it("renders no text when the no-data label is set to an empty string", async () => {
    const page = await renderTable(new Map([["no-data", ""]]));

    expect(page.root.shadowRoot.querySelector(".empty-state")).not.toBeNull();
    expect(page.root.shadowRoot.textContent.trim()).toEqual("");
  });
});
