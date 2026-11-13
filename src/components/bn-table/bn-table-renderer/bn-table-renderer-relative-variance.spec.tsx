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
import { I18nMode, TableCategoryWidth } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { estimateLabelWidth, relativePinGeometry } from "../utils/helper/barColumnGeometry";

const EM = 13.3333; // SYSTEM_STYLE_DEFAULTS.global.fontSizePx, scaleFactor 1
const BAR_COLUMN_WIDTH = 30; // default bar column width in em

describe("IBCS Table relative variance", () => {
  const baseRow = { operation: "+" };

  const rows: any[] = [
    { ...baseRow, category: "A Growth", categoryIndex: 1, ac1: 120, pp1: 100 },
    { ...baseRow, category: "B New", categoryIndex: 2, ac1: 50, pp1: 0 },
    { ...baseRow, category: "C Loss", categoryIndex: 3, ac1: -80, pp1: -100 },
    { ...baseRow, category: "D Idle", categoryIndex: 4, ac1: 0, pp1: 0 },
  ];

  const missingRows: any[] = [
    { ...baseRow, category: "E NoActual", categoryIndex: 1, ac1: null, pp1: 100 },
    { ...baseRow, category: "F NoReference", categoryIndex: 2, ac1: 10, pp1: null },
  ];

  // A and B in 2023, C and D in 2024
  const intervalRows: any[] = rows.map((row, index) => ({ ...row, date: index < 2 ? "2023-06-01" : "2024-06-01" }));

  // pp1 of B sums to -8.5e-14: 0 up to float rounding
  const roundingRows: any[] = [
    { ...baseRow, category: "A Growth", categoryIndex: 1, ac1: 120, pp1: 100 },
    { ...baseRow, category: "B Adjustments", categoryIndex: 2, ac1: 30, pp1: 1234.56 },
    { ...baseRow, category: "B Adjustments", categoryIndex: 2, ac1: 0, pp1: -1000.1 },
    { ...baseRow, category: "B Adjustments", categoryIndex: 2, ac1: 0, pp1: -234.46 },
  ];

  const i18n = new Map([["SUM_TOTAL", "Summe"]]);

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["relData"] = { data: rows };
    tables["relMissing"] = { data: missingRows };
    tables["relInterval"] = { data: intervalRows };
    tables["relRounding"] = { data: roundingRows };
    tables["relRoundingGuard"] = { data: roundingRows.slice(0, 1) };
    tables["relLabel"] = { data: [{ ...baseRow, category: "n/a", categoryIndex: 1, ac1: 120, pp1: 100 }] };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="relData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const cells = (row: Element): Element[] => Array.from(row.querySelectorAll("td"));

  const cellTexts = (row: Element): string[] => cells(row).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find(
      (row) => row.querySelector("td")?.textContent.trim() === text,
    );

  // the relative variance is the last column
  const relativeCell = (page: SpecPage, category: string): Element => cells(findRowByFirstCell(page, category)).pop();

  const relativeText = (page: SpecPage, category: string): string => relativeCell(page, category).textContent.trim();

  const classesOf = (cell: Element): string[] => (cell.getAttribute("class") || "").split(" ");

  // positive pins only, the widest label is +20.00%
  const fullPinScaling = (): number => {
    const labels = { pos: estimateLabelWidth("+20.00%", EM * 0.85) };
    const { maxPinLength } = relativePinGeometry(BAR_COLUMN_WIDTH, EM, labels, 8);
    return maxPinLength / (20 * EM * 0.85);
  };

  it("divides by the absolute reference and prints n/a for a zero reference", async () => {
    const page = await renderTable();

    // (120 - 100) / |100| = 20%
    expect(relativeText(page, "A Growth")).toBe("20.00%");
    // 50 against 0
    expect(relativeText(page, "B New")).toBe("n/a");
    // (-80 + 100) / |-100| = 20%, better than the reference
    expect(relativeText(page, "C Loss")).toBe("20.00%");
    // 0 against 0
    expect(relativeText(page, "D Idle")).toBe("n/a");
    // total: ac1 90 against pp1 0
    expect(relativeText(page, "Summe")).toBe("n/a");

    expect(classesOf(relativeCell(page, "C Loss"))).toContain("pos_pos");
    for (const category of ["B New", "D Idle", "Summe"]) {
      expect(classesOf(relativeCell(page, category))).not.toContain("pos_pos");
      expect(classesOf(relativeCell(page, category))).not.toContain("neg_pos");
    }
  });

  it("keeps the class of a category that reads n/a", async () => {
    const page = await renderTable({ tableName: "relLabel", categoryWidth: TableCategoryWidth.W20 });

    expect(classesOf(cells(findRowByFirstCell(page, "n/a"))[0])).toContain("category-w20");
    expect(relativeText(page, "n/a")).toBe("20.00%");
  });

  it("keeps - for missing data", async () => {
    const page = await renderTable({ tableName: "relMissing" });

    expect(relativeText(page, "E NoActual")).toBe("-");
    expect(relativeText(page, "F NoReference")).toBe("-");
  });

  it("applies it to the REST row", async () => {
    const page = await renderTable({ type: TableType.LIST, limit: 1 });

    // REST is B, C and D: ac1 -30 against pp1 -100, 70 / |-100| = 70%
    expect(relativeText(page, "REST")).toBe("70.00%");
  });

  it("applies it per interval bucket", async () => {
    const page = await renderTable({ tableName: "relInterval", interval: "year" });

    // per year: pp1, ac1, absolute variance, relative variance
    expect(cellTexts(findRowByFirstCell(page, "A Growth"))[4]).toBe("20.00%");
    expect(cellTexts(findRowByFirstCell(page, "B New"))[4]).toBe("n/a");
    expect(cellTexts(findRowByFirstCell(page, "C Loss"))[8]).toBe("20.00%");
    // the 2024 total: ac1 -80 against pp1 -100
    expect(cellTexts(findRowByFirstCell(page, "Summe"))[8]).toBe("20.00%");
  });

  it("shows n/a without a bar and keeps the auto scaling finite", async () => {
    const reportAutoScaling = jest.fn();
    const page = await renderTable({
      type: TableType.LIST,
      barColumns: ["drac1_pp1_pos"],
      percentageScaling: 0,
      reportAutoScaling,
    });

    expect(page.root.shadowRoot.querySelectorAll("svg.relative-variance").length).toBe(2);
    for (const category of ["B New", "D Idle"]) {
      expect(relativeCell(page, category).querySelector("svg")).toBeNull();
      expect(relativeText(page, category)).toBe("n/a");
    }

    // the largest pin (20%) fills the pin area, 0.85 em is the label font
    const { percentage } = reportAutoScaling.mock.calls.pop()[0];
    expect(percentage).toBeCloseTo(fullPinScaling(), 6);
  });

  it("prints n/a for a reference that is 0 up to float rounding", async () => {
    const page = await renderTable({ tableName: "relRounding", type: TableType.LIST });

    expect(cellTexts(findRowByFirstCell(page, "B Adjustments"))).toEqual([
      "B Adjustments",
      "0.0",
      "30.0",
      "30.0",
      "n/a",
    ]);
    expect(relativeText(page, "A Growth")).toBe("20.00%");
  });

  it("keeps a reference that is 0 up to float rounding out of the auto scaling", async () => {
    const scalingOf = async (tableName: string): Promise<number> => {
      const reportAutoScaling = jest.fn();
      await renderTable({
        tableName,
        type: TableType.LIST,
        barColumns: ["drac1_pp1_pos"],
        percentageScaling: 0,
        reportAutoScaling,
      });
      return reportAutoScaling.mock.calls.pop()[0].percentage;
    };

    const percentage = await scalingOf("relRounding");

    // the same as without the B row: the 20% pin fills the pin area
    expect(percentage).toBeCloseTo(fullPinScaling(), 6);
    expect(percentage).toBeCloseTo(await scalingOf("relRoundingGuard"), 6);
  });
});
