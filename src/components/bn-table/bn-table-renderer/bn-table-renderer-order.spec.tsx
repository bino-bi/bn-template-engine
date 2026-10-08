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

describe("IBCS Table order", () => {
  const baseRow = { setName: "de", operation: "+", subCategory: "", subCategoryIndex: 1 };

  // first appearance (Services, Products, Licences) differs from the index order and from the sum order
  // group sums: Services 50, Products 90, Licences 100, total 240
  const orderRows: any[] = [
    { ...baseRow, rowGroup: "Services", rowGroupIndex: 2, category: "Consulting", categoryIndex: 1, ac1: 40 },
    { ...baseRow, rowGroup: "Services", rowGroupIndex: 2, category: "Support", categoryIndex: 2, ac1: 10 },
    { ...baseRow, rowGroup: "Products", rowGroupIndex: 1, category: "Hardware", categoryIndex: 3, ac1: 30 },
    { ...baseRow, rowGroup: "Products", rowGroupIndex: 1, category: "Software", categoryIndex: 4, ac1: 60 },
    { ...baseRow, rowGroup: "Licences", rowGroupIndex: 3, category: "Renewals", categoryIndex: 5, ac1: 100 },
  ];

  const drillBase = { setName: "de", operation: "+", rowGroup: "G", rowGroupIndex: 1 };
  const orderDrillRows: any[] = [
    { ...drillBase, category: "Alpha", categoryIndex: 1, subCategory: "s10", subCategoryIndex: 1, ac1: 10, pp1: 1 },
    { ...drillBase, category: "Alpha", categoryIndex: 1, subCategory: "s5", subCategoryIndex: 2, ac1: 5, pp1: 3 },
    { ...drillBase, category: "Alpha", categoryIndex: 1, subCategory: "s20", subCategoryIndex: 3, ac1: 20, pp1: 2 },
    { ...drillBase, category: "Beta", categoryIndex: 2, subCategory: "b", subCategoryIndex: 1, ac1: 50, pp1: 2 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["orderData"] = { data: orderRows };
    getStores(null).db.db.tables["orderDrillData"] = { data: orderDrillRows };
  });

  const renderTable = (
    hierarchy: OrderColumn[],
    direction: OrderDirection,
    extraProps: Record<string, unknown> = {},
  ): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          order={{ hierarchy, direction } as Order}
          type={TableType.SUM}
          grouped
          showGroupTitle
          i18n={new Map([["SUM_TOTAL", "Summe"]])}
          i18n-mode={I18nMode.META}
          dataFormatDigits={{ percent: 2, decimal: 0 }}
          tableName="orderData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const rows = (page: SpecPage, selector: string): string[][] =>
    Array.from(page.root.shadowRoot.querySelectorAll(selector)).map(cellTexts);

  const heads = (page: SpecPage): string[] => rows(page, "tbody tr.groupheader").map((cells) => cells[0]);

  it("sorts row groups by rowGroupIndex when the order list has no group level entry", async () => {
    const page = await renderTable([OrderColumn.CATEGORY], OrderDirection.ASC);

    expect(heads(page)).toEqual(["Products", "Services", "Licences"]);
  });

  it("sorts row groups by their group sum when the order list names a scenario", async () => {
    const page = await renderTable([OrderColumn.AC1], OrderDirection.DESC);

    expect(heads(page)).toEqual(["Licences", "Products", "Services"]);
    // group sums 100, 60 + 30 = 90, 40 + 10 = 50, then the total 240
    expect(rows(page, "tbody tr.sum").map((cells) => cells.slice(0, 2))).toEqual([
      ["Licences", "100"],
      ["Products", "90"],
      ["Services", "50"],
      ["Summe", "240"],
    ]);
  });

  it("applies the direction to every order column at group level", async () => {
    const page = await renderTable([OrderColumn.ROWGROUP, OrderColumn.CATEGORY], OrderDirection.DESC);

    expect(heads(page)).toEqual(["Services", "Products", "Licences"]);
  });

  it("applies the direction to every order column at row level", async () => {
    const page = await renderTable([OrderColumn.AC1, OrderColumn.CATEGORY], OrderDirection.DESC, {
      grouped: false,
      type: TableType.LIST,
    });

    expect(rows(page, "tbody tr").map((cells) => cells[0])).toEqual([
      "Renewals",
      "Software",
      "Consulting",
      "Hardware",
      "Support",
    ]);
  });

  it("inverts every order column for thereof rows", async () => {
    const thereofAc1 = async (direction: OrderDirection): Promise<string[]> => {
      const page = await renderTable([OrderColumn.PP1, OrderColumn.AC1], direction, {
        grouped: false,
        type: TableType.LIST,
        scenarios: ["ac1", "pp1"],
        thereof: [{ category: "Alpha" }],
        tableName: "orderDrillData",
      });
      // columns: category, pp1, ac1
      return rows(page, "tbody tr.ofit").map((cells) => cells[2]);
    };

    // asc inverts to pp1 desc, ac1 desc: pp1 3, 2, 1
    expect(await thereofAc1(OrderDirection.ASC)).toEqual(["5", "20", "10"]);
    // desc inverts to pp1 asc, ac1 asc: pp1 1, 2, 3
    expect(await thereofAc1(OrderDirection.DESC)).toEqual(["10", "20", "5"]);
  });
});
