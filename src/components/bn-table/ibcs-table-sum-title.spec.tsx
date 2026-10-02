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
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { createScopedDb } = require("../../context/scopedDb");

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
import { getStores } from "../../context/context-protocol";
import { IbcsTable } from "./ibcs-table";
import { OrderDirection, TableType } from "./utils/model";
import { I18nMode } from "../../utils/constants";
import { Order, OrderColumn } from "../../utils/model/Order";

// `sumTitle` labels the category cell of the grand-total row (`<tr class="sum">`),
// not the table. When it is left empty the IBCS total symbol (❖) is used instead.
describe("IBCS Table sumTitle", () => {
  const baseRow = {
    setName: "de",
    operation: "+",
    rowGroup: "Umsatz",
    rowGroupIndex: 0,
    subCategory: "",
    subCategoryIndex: 1,
  };

  const rows: any[] = [
    { ...baseRow, category: "Berlin", categoryIndex: 1, ac1: 50, pp1: 40 },
    { ...baseRow, category: "Hamburg", categoryIndex: 2, ac1: 30, pp1: 25 },
  ];

  const i18n = new Map([["SUM_TOTAL", "❖"]]);

  // partof marks "Berlin" as a part of the total, which makes DataQuery prefix
  // the total row's label with the ❖ symbol when the table is not grouped.
  const partof = [{ rowGroup: "", category: "Berlin", subCategory: "", partOf: "" }];

  beforeAll(() => {
    getStores(null).db.db.tables["sumTitleData"] = { data: rows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          scenarios={["ac1", "pp1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.ASC,
            } as Order
          }
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="sumTitleData"
          {...extraProps}
        ></ibcs-table>
      ),
    });

  const sumRowLabel = (page: SpecPage): string =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"))
      .find((row) => row.getAttribute("class")?.includes("sum"))
      ?.querySelector("td")
      ?.textContent.trim();

  it("falls back to the IBCS total symbol when no sumTitle is given", async () => {
    const page = await renderTable();

    expect(sumRowLabel(page)).toEqual("❖");
  });

  it("uses a custom sumTitle verbatim as the total row label", async () => {
    const page = await renderTable({ "sum-title": "Gesamt" });

    expect(sumRowLabel(page)).toEqual("Gesamt");
  });

  it("prefixes the total symbol to a custom sumTitle when partof is active and the table is not grouped", async () => {
    const page = await renderTable({ partof, grouped: false, "sum-title": "Gesamt" });

    expect(sumRowLabel(page)).toEqual("❖ Gesamt");
  });

  // Regression: the empty sumTitle is substituted with the `SUM_TOTAL` i18n KEY
  // upstream, so prefixing it produced the literal string "❖ SUM_TOTAL" - the key
  // no longer matched the translation guard and was rendered raw.
  it("does not prefix the total symbol onto the untranslated SUM_TOTAL key when sumTitle is empty", async () => {
    const page = await renderTable({ partof, grouped: false });

    expect(sumRowLabel(page)).toEqual("❖");
  });
});
