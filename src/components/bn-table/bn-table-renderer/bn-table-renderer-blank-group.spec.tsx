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
import { ErrorDispatcher } from "../../../utils/withHasError";

describe("IBCS Table blank row group", () => {
  const baseRow = { setName: "de", operation: "+", rowGroupIndex: 2, subCategory: "", subCategoryIndex: 1 };

  // the three blank variants: null, empty text, no rowGroup key at all
  const blankRows: any[] = [
    { ...baseRow, rowGroup: "Hardware", rowGroupIndex: 1, category: "Laptops", categoryIndex: 1, ac1: 100, pp1: 90 },
    { ...baseRow, rowGroup: "Hardware", rowGroupIndex: 1, category: "Phones", categoryIndex: 2, ac1: 50, pp1: 40 },
    { ...baseRow, rowGroup: null, category: "Freight", subCategory: "Sea", categoryIndex: 3, ac1: 30, pp1: 20 },
    { ...baseRow, rowGroup: "", category: "Discounts", categoryIndex: 4, ac1: 20, pp1: 10 },
    { ...baseRow, category: "Other", categoryIndex: 5, ac1: 10, pp1: 5 },
  ];

  // the blank group has values in 2023 and 2024, Hardware only in 2023
  const datedRows: any[] = [
    ...blankRows.map((row) => ({ ...row, date: "2023-03-10" })),
    { ...baseRow, rowGroup: null, category: "Freight", categoryIndex: 3, date: "2024-03-10", ac1: 3, pp1: 2 },
    { ...baseRow, rowGroup: "", category: "Discounts", categoryIndex: 4, date: "2024-03-10", ac1: 2, pp1: 1 },
    { ...baseRow, category: "Other", categoryIndex: 5, date: "2024-03-10", ac1: 1, pp1: 1 },
  ];

  // Freight sits under all three blank variants, two of them in 2024
  const mixedRows: any[] = [
    // prettier-ignore
    { ...baseRow, rowGroup: "Hardware", rowGroupIndex: 1, category: "Laptops", categoryIndex: 1, date: "2023-03-10", ac1: 100, pp1: 90 },
    // prettier-ignore
    { ...baseRow, rowGroup: null, category: "Freight", subCategory: "Sea", categoryIndex: 3, date: "2023-05-10", ac1: 30, pp1: 20 },
    // prettier-ignore
    { ...baseRow, rowGroup: "", category: "Freight", subCategory: "Sea", categoryIndex: 3, date: "2024-05-10", ac1: 7, pp1: 3 },
    // prettier-ignore
    { ...baseRow, category: "Freight", subCategory: "Sea", categoryIndex: 3, date: "2024-05-10", ac1: 3, pp1: 2 },
    { ...baseRow, rowGroup: "", category: "Other", categoryIndex: 5, date: "2023-05-10", ac1: 10, pp1: 5 },
  ];

  const numericRows: any[] = [
    // prettier-ignore
    { ...baseRow, rowGroup: 2024, rowGroupIndex: 1, category: "A", categoryIndex: 1, date: "2023-03-10", ac1: 100, pp1: 90 },
    // prettier-ignore
    { ...baseRow, rowGroup: 2024, rowGroupIndex: 1, category: "B", categoryIndex: 2, date: "2024-03-10", ac1: 50, pp1: 40 },
    { ...baseRow, rowGroup: 2025, category: "A", categoryIndex: 1, date: "2024-03-10", ac1: 30, pp1: 20 },
  ];

  const blankWarning = {
    id: "WARN_blankRowGroup",
    type: "warning",
    message: "grouped: rows with blank rowGroup found, they are grouped under '-'.",
  };

  const errors = {
    clear: jest.fn(),
    replace: jest.fn(),
    add: jest.fn(),
    addOrReplace: jest.fn(),
    remove: jest.fn(),
  } as unknown as ErrorDispatcher;

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["blankData"] = { data: blankRows };
    tables["blankDatedData"] = { data: datedRows };
    tables["blankMixedData"] = { data: mixedRows };
    tables["numericGroupData"] = { data: numericRows };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1"]}
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.SUM}
          grouped
          showGroupTitle
          i18n={
            new Map([
              ["SUM_TOTAL", "Summe"],
              ["thereof", "davon"],
              ["part_of", "in % von"],
            ])
          }
          i18n-mode={I18nMode.META}
          dataFormatDigits={{ percent: 2, decimal: 0 }}
          tableName="blankData"
          errors={errors}
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  // cells are [label, pp1, ac1], with interval="year" [label, 2023 pp1, 2023 ac1, 2024 pp1, 2024 ac1]
  const rows = (page: SpecPage, selector: string = "tbody tr", cells: number = 3): string[][] =>
    Array.from(page.root.shadowRoot.querySelectorAll(selector)).map((row) => cellTexts(row).slice(0, cells));

  it("shows rows with a blank rowGroup once, in one group labelled -", async () => {
    const page = await renderTable();

    expect(rows(page)).toEqual([
      ["Hardware", "", ""],
      ["Laptops", "90", "100"],
      ["Phones", "40", "50"],
      ["Hardware", "130", "150"],
      ["-", "", ""],
      ["Discounts", "10", "20"],
      ["Freight", "20", "30"],
      ["Other", "5", "10"],
      // pp1: 10 + 20 + 5 = 35, ac1: 20 + 30 + 10 = 60
      ["-", "35", "60"],
      ["Summe", "165", "210"],
    ]);
  });

  it("group sums add up to the total", async () => {
    const page = await renderTable();

    const sumRows = rows(page, "tbody tr.sum");
    const total = sumRows[sumRows.length - 1];
    const groupSums = sumRows.slice(0, -1);
    const add = (column: number): number => groupSums.reduce((sum, cells) => sum + Number(cells[column]), 0);

    // pp1: 130 + 35 = 165, ac1: 150 + 60 = 210
    expect([add(1), add(2)]).toEqual([165, 210]);
    expect([add(1), add(2)]).toEqual([Number(total[1]), Number(total[2])]);
  });

  it("reports the blank rowGroup as a warning", async () => {
    await renderTable();

    expect(errors.addOrReplace).toHaveBeenCalledWith(blankWarning);
  });

  it("does not warn when the filter removes the blank rows", async () => {
    const page = await renderTable({ filter: "rowGroup = 'Hardware'" });

    expect(rows(page, "tbody tr.groupheader").map((cells) => cells[0])).toEqual(["Hardware"]);
    expect(errors.addOrReplace).not.toHaveBeenCalledWith(blankWarning);
    expect(errors.remove).toHaveBeenCalledWith("WARN_blankRowGroup");
  });

  it("builds the REST row of a blank group", async () => {
    const page = await renderTable({ limit: 1 });

    // REST of the blank group is Freight + Other: pp1 20 + 5 = 25, ac1 30 + 10 = 40
    expect(rows(page).slice(4, 8)).toEqual([
      ["-", "", ""],
      ["Discounts", "10", "20"],
      ["REST", "25", "40"],
      ["-", "35", "60"],
    ]);
  });

  it("prints the part-of row of a blank group against the sum of that group", async () => {
    const page = await renderTable({ partof: [{ category: "Freight" }] });

    // pp1: 20 / 35 = 57.14%, ac1: 30 / 60 = 50.00%
    expect(rows(page).slice(6, 8)).toEqual([
      ["Freight", "20", "30"],
      ["in % von -", "57.14%", "50.00%"],
    ]);
  });

  it("keeps the thereof row of a blank group under its category", async () => {
    const page = await renderTable({ thereof: [{ category: "Freight" }] });

    expect(rows(page).slice(6, 8)).toEqual([
      ["Freight", "20", "30"],
      ["davon Sea", "20", "30"],
    ]);
  });

  it("fills the interval columns of a blank group", async () => {
    const page = await renderTable({ tableName: "blankDatedData", interval: "year" });

    expect(rows(page, "tbody tr", 5).slice(4, 9)).toEqual([
      ["-", "", "", "", ""],
      ["Discounts", "10", "20", "1", "2"],
      ["Freight", "20", "30", "2", "3"],
      ["Other", "5", "10", "1", "1"],
      // 2024: pp1 1 + 2 + 1 = 4, ac1 2 + 3 + 1 = 6
      ["-", "35", "60", "4", "6"],
    ]);
  });

  it("builds the REST row of a blank group per interval", async () => {
    const page = await renderTable({ tableName: "blankDatedData", interval: "year", limit: 1 });

    // REST is Freight + Other, 2024: pp1 2 + 1 = 3, ac1 3 + 1 = 4
    expect(rows(page, "tbody tr", 5).slice(5, 8)).toEqual([
      ["Discounts", "10", "20", "1", "2"],
      ["REST", "25", "40", "3", "4"],
      ["-", "35", "60", "4", "6"],
    ]);
  });

  it("prints the part-of row of a blank group per interval", async () => {
    const page = await renderTable({
      tableName: "blankDatedData",
      interval: "year",
      partof: [{ category: "Freight" }],
    });

    // 2024: pp1 2 / 4 = 50.00%, ac1 3 / 6 = 50.00%
    expect(rows(page, "tbody tr", 5)[7]).toEqual(["in % von -", "57.14%", "50.00%", "50.00%", "50.00%"]);
  });

  it("shows a category once when its rows carry different blank variants", async () => {
    const page = await renderTable({ tableName: "blankMixedData" });

    // Freight: pp1 20 + 3 + 2 = 25, ac1 30 + 7 + 3 = 40
    expect(rows(page).slice(3)).toEqual([
      ["-", "", ""],
      ["Freight", "25", "40"],
      ["Other", "5", "10"],
      ["-", "30", "50"],
      ["Summe", "120", "150"],
    ]);
  });

  it("fills the interval columns of a category with different blank variants once", async () => {
    const page = await renderTable({ tableName: "blankMixedData", interval: "year" });

    // Freight 2024: pp1 3 + 2 = 5, ac1 7 + 3 = 10
    expect(rows(page, "tbody tr", 5).slice(4, 7)).toEqual([
      ["Freight", "20", "30", "5", "10"],
      ["Other", "5", "10", "-", "-"],
      ["-", "25", "40", "5", "10"],
    ]);
  });

  it("puts the rows after the limit into REST when a category has different blank variants", async () => {
    const page = await renderTable({ tableName: "blankMixedData", limit: 1 });

    expect(rows(page).slice(4, 7)).toEqual([
      ["Freight", "25", "40"],
      ["REST", "5", "10"],
      ["-", "30", "50"],
    ]);
  });

  it("shows one thereof row for a category with different blank variants", async () => {
    const page = await renderTable({
      tableName: "blankMixedData",
      interval: "year",
      thereof: [{ category: "Freight" }],
    });

    expect(rows(page, "tbody tr", 5).slice(4, 7)).toEqual([
      ["Freight", "20", "30", "5", "10"],
      ["davon Sea", "20", "30", "5", "10"],
      ["Other", "5", "10", "-", "-"],
    ]);
  });

  it("shows one part-of row for a category with different blank variants", async () => {
    const page = await renderTable({ tableName: "blankMixedData", partof: [{ category: "Freight" }] });

    // pp1: 25 / 30 = 83.33%, ac1: 40 / 50 = 80.00%
    expect(rows(page).slice(4, 7)).toEqual([
      ["Freight", "25", "40"],
      ["in % von -", "83.33%", "80.00%"],
      ["Other", "5", "10"],
    ]);
  });

  it("fills the interval columns of the group sums when the rowGroup is a number", async () => {
    const page = await renderTable({ tableName: "numericGroupData", interval: "year" });

    expect(rows(page, "tbody tr.sum", 5)).toEqual([
      ["2024", "90", "100", "40", "50"],
      ["2025", "-", "-", "20", "30"],
      ["Summe", "90", "100", "60", "80"],
    ]);
  });

  it("prints the part-of row when the rowGroup is a number", async () => {
    const page = await renderTable({ tableName: "numericGroupData", partof: [{ category: "A" }] });

    // group 2024, pp1: 90 / 130 = 69.23%, ac1: 100 / 150 = 66.67%
    expect(rows(page).slice(1, 3)).toEqual([
      ["A", "90", "100"],
      ["in % von 2024", "69.23%", "66.67%"],
    ]);
  });

  it("keeps an ungrouped table unfiltered and without warning", async () => {
    const page = await renderTable({ grouped: false });

    expect(rows(page)).toEqual([
      ["Discounts", "10", "20"],
      ["Freight", "20", "30"],
      ["Laptops", "90", "100"],
      ["Other", "5", "10"],
      ["Phones", "40", "50"],
      ["Summe", "165", "210"],
    ]);
    expect(errors.addOrReplace).not.toHaveBeenCalledWith(blankWarning);
  });
});
