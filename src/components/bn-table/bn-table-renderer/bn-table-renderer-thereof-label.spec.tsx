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

describe("IBCS Table thereof labels", () => {
  const revenue = { operation: "+", rowGroupIndex: 1, category: "Revenue", categoryIndex: 1 };
  const cost = { operation: "+", rowGroupIndex: 1, category: "Cost", categoryIndex: 2 };

  // Online appears twice under Revenue, Staff has no rowGroup
  const thereofRows: any[] = [
    { ...revenue, rowGroup: "Europe", subCategory: "Retail", subCategoryIndex: 1, ac1: 20 },
    { ...revenue, rowGroup: "Europe", subCategory: "Online", subCategoryIndex: 2, ac1: 10 },
    { ...revenue, rowGroup: "Asia", subCategory: "Online", subCategoryIndex: 2, ac1: 5 },
    { ...cost, rowGroup: null, subCategory: "Staff", subCategoryIndex: 1, ac1: 7 },
    { ...cost, rowGroup: "Europe", subCategory: "Rent", subCategoryIndex: 2, ac1: 3 },
  ];

  // Other appears once under each parent
  const parentRows: any[] = [
    { ...revenue, rowGroup: "Europe", subCategory: "Other", subCategoryIndex: 1, ac1: 4 },
    { ...revenue, rowGroup: "Europe", subCategory: "Retail", subCategoryIndex: 2, ac1: 6 },
    { ...cost, rowGroup: "Asia", subCategory: "Other", subCategoryIndex: 1, ac1: 2 },
    { ...cost, rowGroup: "Asia", subCategory: "Rent", subCategoryIndex: 2, ac1: 3 },
  ];

  // Staff appears twice under Cost, once without a rowGroup
  const dupBlankRows: any[] = [
    { ...cost, setname: "x", rowGroup: null, subCategory: "Staff", subCategoryIndex: 1, ac1: 7 },
    { ...cost, setname: "x", rowGroup: "Europe", subCategory: "Staff", subCategoryIndex: 1, ac1: 2 },
    { ...cost, setname: "x", rowGroup: "Europe", subCategory: "Rent", subCategoryIndex: 2, ac1: 3 },
  ];

  const berlin = { columnGroup: "DE", columnGroupIndex: 1, columnSubGroup: "Berlin", columnSubGroupIndex: 1 };

  // Staff and Rent appear in both row groups
  const twoGroupRows: any[] = [
    { ...cost, ...berlin, rowGroup: "Europe", subCategory: "Staff", subCategoryIndex: 1, ac1: 2 },
    { ...cost, ...berlin, rowGroup: "Europe", subCategory: "Rent", subCategoryIndex: 2, ac1: 3 },
    { ...cost, ...berlin, rowGroup: "Asia", subCategory: "Staff", subCategoryIndex: 1, ac1: 7 },
    { ...cost, ...berlin, rowGroup: "Asia", subCategory: "Rent", subCategoryIndex: 2, ac1: 11 },
  ];

  // a rowGroup of 0 is a value, not a blank
  const zeroGroupRows: any[] = [
    { ...cost, rowGroup: 0, subCategory: "Staff", subCategoryIndex: 1, ac1: 1 },
    { ...cost, rowGroup: 1, subCategory: "Staff", subCategoryIndex: 1, ac1: 2 },
  ];

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["thereofData"] = { data: thereofRows };
    tables["thereofParents"] = { data: parentRows };
    tables["dupBlank"] = { data: dupBlankRows };
    tables["dupBlankColumns"] = { data: dupBlankRows.map((row) => ({ ...row, ...berlin })) };
    tables["twoGroups"] = { data: twoGroupRows };
    tables["zeroGroup"] = { data: zeroGroupRows };
  });

  const thereof = (category: string) => ({ rowGroup: "", category, subCategory: "", partOf: "" });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.SUM}
          grouped={false}
          i18n={
            new Map([
              ["SUM_TOTAL", "Summe"],
              ["there_of", "davon"],
            ])
          }
          i18n-mode={I18nMode.META}
          dataFormatDigits={{ percent: 2, decimal: 0 }}
          thereof={[thereof("Revenue"), thereof("Cost")]}
          tableName="thereofData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const bodyRows = (page: SpecPage): string[][] =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim()),
    );

  it("adds the rowGroup only to duplicate subCategory names under one parent", async () => {
    const page = await renderTable();

    // Cost 7 + 3 = 10, Revenue 20 + 10 + 5 = 35, total 45
    expect(bodyRows(page)).toEqual([
      ["Cost", "10"],
      ["davon Staff", "7"],
      ["davon Rent", "3"],
      ["Revenue", "35"],
      ["davon Retail", "20"],
      ["davon Online (Europe)", "10"],
      ["davon Online (Asia)", "5"],
      ["Summe", "45"],
    ]);
  });

  it("does not add the rowGroup for the same name under different parents", async () => {
    const page = await renderTable({ tableName: "thereofParents" });

    // Cost 2 + 3 = 5, Revenue 4 + 6 = 10, total 15
    expect(bodyRows(page)).toEqual([
      ["Cost", "5"],
      ["davon Other", "2"],
      ["davon Rent", "3"],
      ["Revenue", "10"],
      ["davon Other", "4"],
      ["davon Retail", "6"],
      ["Summe", "15"],
    ]);
  });

  it("never adds a blank rowGroup, and keeps the interval values of such a row", async () => {
    const page = await renderTable({ tableName: "dupBlank", interval: "setname", thereof: [thereof("Cost")] });

    // one bucket "x": Cost 7 + 2 + 3 = 12
    expect(bodyRows(page)).toEqual([
      ["Cost", "12"],
      ["davon Staff", "7"],
      ["davon Staff (Europe)", "2"],
      ["davon Rent", "3"],
      ["Summe", "12"],
    ]);
  });

  it("keeps the interval values of a duplicate name in a grouped table", async () => {
    const page = await renderTable({
      tableName: "dupBlank",
      interval: "setname",
      grouped: true,
      thereof: [thereof("Cost")],
    });

    // blank group: Cost 7, Europe: Cost 2 + 3 = 5
    expect(bodyRows(page)).toEqual([
      ["-", ""],
      ["Cost", "7"],
      ["davon Staff", "7"],
      ["-", "7"],
      ["Europe", ""],
      ["Cost", "5"],
      ["davon Staff", "2"],
      ["davon Rent", "3"],
      ["Europe", "5"],
      ["Summe", "12"],
    ]);
  });

  it("adds a rowGroup of 0, it is not blank", async () => {
    const page = await renderTable({ tableName: "zeroGroup", thereof: [thereof("Cost")] });

    expect(bodyRows(page)).toEqual([
      ["Cost", "3"],
      ["davon Staff (0)", "1"],
      ["davon Staff (1)", "2"],
      ["Summe", "3"],
    ]);
  });

  describe("with thereof columns", () => {
    // columns: DE, thereof Berlin, REST, AC
    const categorythereof = new Map([["ac1", [{ name: "DE", subGroups: ["Berlin"] }]]]);
    const thereofRowsOf = (page: SpecPage) => bodyRows(page).filter((row) => row[0].startsWith("davon"));

    it("keeps the column values of a duplicate name with a blank rowGroup", async () => {
      const page = await renderTable({ tableName: "dupBlankColumns", categorythereof, thereof: [thereof("Cost")] });

      // every row is in DE / Berlin, so REST is 0
      expect(thereofRowsOf(page)).toEqual([
        ["davon Staff", "7", "7", "0", "7"],
        ["davon Staff (Europe)", "2", "2", "0", "2"],
        ["davon Rent", "3", "3", "0", "3"],
      ]);
    });

    it("takes the column values of a thereof row from its own rowGroup", async () => {
      const page = await renderTable({
        tableName: "twoGroups",
        categorythereof,
        thereof: [{ ...thereof("Cost"), rowGroup: "Europe" }],
      });

      // Staff and Rent of Asia (7 and 11) must not show up
      expect(thereofRowsOf(page)).toEqual([
        ["davon Staff", "2", "2", "0", "2"],
        ["davon Rent", "3", "3", "0", "3"],
      ]);
    });
  });
});
