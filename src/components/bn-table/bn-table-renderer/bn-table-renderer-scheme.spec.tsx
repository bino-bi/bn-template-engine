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
    componentStyles: createStore({
      _system: SYSTEM_STYLE_DEFAULTS,
      scheme: {
        "bn-chart-time": {
          barStyles: { ac: { negativeFill: "#808080" } },
          varianceStyles: { pos: { outlineFill: "#cce9ea", outlineStroke: "#404040" } },
        },
        "bn-table": { relativeItalic: false },
      },
    }),
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

// A small calculation scheme: two sales lines and their result, one cost line and the running result.
describe("IBCS Table calculation scheme: one scale, sum bars, parts and ratios", () => {
  // prettier-ignore
  const rows: any[] = [
    { operation: "+", rowGroup: "Sales", rowGroupIndex: 1, category: "A", categoryIndex: 1, pp1: 8, ac1: 12, fc1: 30, pl1: 10 },
    { operation: "+", rowGroup: "Sales", rowGroupIndex: 1, category: "B", categoryIndex: 2, pp1: 2, ac1: 3, fc1: 6, pl1: 4 },
    { operation: "-", rowGroup: "Result", rowGroupIndex: 2, category: "C", categoryIndex: 3, pp1: 4, ac1: 9, fc1: 20, pl1: 5 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["schemeData"] = { data: rows };
  });

  const i18n = new Map([["SUM_TOTAL", "Total"]]);

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          barColumns={["pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.OPTNOTOTAL}
          grouped={true}
          showGroupTitle={false}
          runningSum={true}
          unitScaling={0}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="schemeData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const bodyRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));
  const rowOf = (page: SpecPage, text: string): Element =>
    bodyRows(page).find((row) => Array.from(row.querySelectorAll("td")).some((td) => td.textContent.trim() === text));
  const COLUMNS = ["operation", "category", "pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"];
  // a variance cell has no class with its column name, so the cell is found by its place
  const cellOf = (row: Element, key: string, columns = COLUMNS): Element =>
    row.querySelectorAll("td")[columns.indexOf(key)];
  const svgOf = (row: Element, key: string, columns = COLUMNS): Element | null =>
    cellOf(row, key, columns)?.querySelector("svg") ?? null;
  const barOf = (svg: Element): Element =>
    Array.from(svg.children).find((el) => el.tagName.toLowerCase() === "rect" && !el.getAttribute("class"));
  const width = (el: Element): number => parseFloat(el.getAttribute("width"));

  it("gives every column its own scale by default", async () => {
    const page = await renderTable();
    const a = rowOf(page, "A");
    // PY 8 and AC 12 both fill their column, so a unit is longer in PY
    expect(width(barOf(svgOf(a, "pp1"))) / 8).toBeGreaterThan(width(barOf(svgOf(a, "ac1"))) / 12 + 1e-3);
  });

  it("draws all waterfalls and the variance bars at one scale with waterfallScaling unit", async () => {
    const page = await renderTable({ waterfallScaling: "unit" });
    const a = rowOf(page, "A");
    const perUnit = width(barOf(svgOf(a, "ac1"))) / 12;
    expect(width(barOf(svgOf(a, "pp1"))) / 8).toBeCloseTo(perUnit, 6);
    // the variance of A is +4
    expect(width(barOf(svgOf(a, "dac1_pp1_pos"))) / 4).toBeCloseTo(perUnit, 6);
  });

  it("makes a fixed unit scaling coarser for the whole table when a walk does not fit, with a warning", async () => {
    const errors = { addOrReplace: jest.fn(), remove: jest.fn() };
    // 5 em per unit: the AC walk of 15 units would need 75 em of a column of 30 em
    const page = await renderTable({ waterfallScaling: "unit", unitScaling: 5, errors });
    const a = rowOf(page, "A");
    expect(width(barOf(svgOf(a, "pp1"))) / 8).toBeCloseTo(width(barOf(svgOf(a, "ac1"))) / 12, 6);
    expect(errors.addOrReplace).toHaveBeenCalledWith(expect.objectContaining({ id: "WARN_waterfallScaling" }));
  });

  it("draws variance bars and pins on the sum rows only with sumBars", async () => {
    const plain = await renderTable();
    const sales = rowOf(plain, "Sales");
    expect(svgOf(sales, "dac1_pp1_pos")).toBeNull();
    expect(svgOf(sales, "drac1_pp1_pos")).toBeNull();

    const page = await renderTable({ sumBars: true });
    const sum = rowOf(page, "Sales");
    expect(svgOf(sum, "dac1_pp1_pos")).not.toBeNull();
    expect(svgOf(sum, "drac1_pp1_pos")).not.toBeNull();
  });

  it("joins the steps of a scenario waterfall with connectors", async () => {
    const page = await renderTable();
    const connectors = (key: string) =>
      bodyRows(page).flatMap((row) => Array.from(svgOf(row, key)?.querySelectorAll("line.waterfall-connector") ?? []));
    expect(connectors("pp1").length).toBeGreaterThan(0);
    expect(connectors("ac1").length).toBeGreaterThan(0);
  });

  it("fills a step that goes down with the negativeFill of the scenario", async () => {
    const page = await renderTable({ selectedStyle: "scheme" });
    expect(barOf(svgOf(rowOf(page, "C"), "ac1")).getAttribute("fill")).toBe("#808080");
    expect(barOf(svgOf(rowOf(page, "A"), "ac1")).getAttribute("fill")).toBe("#404040");
  });

  it("prints the pin labels upright and without the percent sign when asked", async () => {
    const page = await renderTable({
      selectedStyle: "scheme",
      dataFormatDigits: { percent: 0, decimal: 0, percentSign: false },
    });
    const label = svgOf(rowOf(page, "A"), "drac1_pp1_pos").querySelector("text");
    expect(label.textContent).toBe("+50");
    expect(label.getAttribute("font-style")).toBe("normal");
    expect(page.root.shadowRoot.querySelector("table").getAttribute("class")).toContain("relative-upright");
  });

  it("fills an outlined variance with the outline look of the style", async () => {
    const page = await renderTable({
      selectedStyle: "scheme",
      scenarios: ["pp1", "pl1", "dpl1_pp1_pos"],
      barColumns: ["pp1", "pl1", "dpl1_pp1_pos"],
    });
    const bar = barOf(svgOf(rowOf(page, "A"), "dpl1_pp1_pos", ["operation", "category", "pp1", "pl1", "dpl1_pp1_pos"]));
    expect(bar.getAttribute("fill")).toBe("#cce9ea");
    expect(bar.getAttribute("stroke")).toBe("#404040");
  });

  it("gives a bar column its own width with barColumnWidths", async () => {
    const page = await renderTable({ barColumnMaxWidth: 10, barColumnWidths: { ac1: 20 } });
    const a = rowOf(page, "A");
    const width = (svg: Element) => parseFloat(svg.getAttribute("width"));
    // the cell padding is the same in both, so the drawing is a bit more than twice as wide
    const ratio = width(svgOf(a, "ac1")) / width(svgOf(a, "pp1"));
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(2.1);
  });

  it("draws a part of another scenario inside the bars and names it in the header", async () => {
    const page = await renderTable({
      scenarios: ["pp1", "fc1"],
      barColumns: ["pp1", "fc1"],
      barColumnParts: { fc1: "ac1" },
    });
    const columns = ["operation", "category", "pp1", "fc1"];
    const a = svgOf(rowOf(page, "A"), "fc1", columns);
    const part = a.querySelector("rect.waterfall-part");
    // AC 12 of FC 30, from the start of the bar
    expect(width(part) / width(barOf(a))).toBeCloseTo(12 / 30, 6);
    expect(parseFloat(part.getAttribute("x"))).toBeCloseTo(parseFloat(barOf(a).getAttribute("x")), 6);
    // C goes down: its part starts at the right end of the bar
    const c = svgOf(rowOf(page, "C"), "fc1", columns);
    const right = (el: Element) => parseFloat(el.getAttribute("x")) + width(el);
    expect(right(c.querySelector("rect.waterfall-part"))).toBeCloseTo(right(barOf(c)), 6);
    // the part has no column of its own
    expect(page.root.shadowRoot.querySelector("td.ac1")).toBeNull();
    expect(page.root.shadowRoot.querySelector("th .bar-part-name").textContent).toBe("AC");
  });

  it("keeps the order of several ratios of one result and leaves a cell without a value empty", async () => {
    const page = await renderTable({
      ratios: [
        { name: "First", numerator: "Result", denominator: "Sales" },
        { name: "Second", numerator: "Result", denominator: "Nothing" },
      ],
    });
    const ratios = bodyRows(page).filter((row) => (row.getAttribute("class") || "").includes("ratio"));
    expect(ratios.map((row) => row.querySelectorAll("td")[1].textContent.trim())).toEqual(["First"]);

    const both = await renderTable({
      ratios: [
        { name: "First", numerator: "Result", denominator: "Sales" },
        { name: "Second", numerator: "Result", denominator: "Result" },
      ],
    });
    const rows2 = bodyRows(both).filter((row) => (row.getAttribute("class") || "").includes("ratio"));
    expect(rows2.map((row) => row.querySelectorAll("td")[1].textContent.trim())).toEqual(["First", "Second"]);
    // a variance cell of a ratio row stays empty, not 0%
    expect(cellOf(rows2[0], "drac1_pp1_pos").textContent.trim()).toBe("");
  });

  it("puts a ratio row after its result, with the walk line through it", async () => {
    const page = await renderTable({
      ratios: [{ name: "Margin", numerator: "Result", denominator: "Sales" }],
      dataFormatDigits: { percent: 0, decimal: 0 },
    });
    const rowsNow = bodyRows(page);
    const ratio = rowsNow.find((row) => (row.getAttribute("class") || "").includes("ratio"));
    expect(ratio).toBeDefined();
    expect(rowsNow[rowsNow.indexOf(ratio) - 1]).toBe(rowOf(page, "Result"));
    // AC: (15 - 9) / 15
    const ac = svgOf(ratio, "ac1");
    expect(ac.querySelector("text").textContent).toBe("40%");
    // the zero axis and the line of the walk
    expect(ac.querySelectorAll("line").length).toBe(2);
    // no variance in a ratio row, only the axis of the column
    expect(cellOf(ratio, "dac1_pp1_pos").textContent.trim()).toBe("");
    expect(cellOf(ratio, "dac1_pp1_pos").querySelector("svg.axis-only")).not.toBeNull();
  });
});
