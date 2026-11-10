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
import { absoluteBarGeometry, estimateLabelWidth } from "../utils/helper/barColumnGeometry";

/**
 * `bar-column-width="wN"` must render exactly as wide as `category-width="wN"`.
 * `.category-wN` is a border-box of `N em`; a bar cell is its SVG plus the `0.5em`
 * of padding from `td:has(.cell-bar-chart)`, so the SVG must be `(N - 0.5) em`.
 */
const EM = 13.3333; // SYSTEM_STYLE_DEFAULTS.global.fontSizePx, scaleFactor 1
const LABEL_FONT = EM * 0.85; // the unchanged unitScaling / percentageScaling basis
const expectedSvgWidth = (n: number) => (n - 0.5) * EM;

describe("IBCS Table bar column width", () => {
  // dac1_pp1 is +20 / -20 (two-sided); dac1_pl1 is +20 / +20 (positive only)
  const rows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, ac1: 120, pp1: 100, pl1: 100 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, ac1: 80, pp1: 100, pl1: 60 },
  ];

  // dac1_pp1 is +10 / +20, the total row +30
  const statsRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, ac1: 110, pp1: 100 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, ac1: 120, pp1: 100 },
  ];

  // dac1_pp1 is +10 / +20 / -5 (two-sided)
  const cutRows: any[] = [
    ...statsRows,
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Gamma", categoryIndex: 3, ac1: 95, pp1: 100 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["widthData"] = { data: rows };
    getStores(null).db.db.tables["statsData"] = { data: statsRows };
    getStores(null).db.db.tables["cutData"] = { data: cutRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="widthData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const svgsOf = (page: SpecPage, cssClass: string): Element[] =>
    Array.from(page.root.shadowRoot.querySelectorAll(`svg.${cssClass}`));

  const widthOf = (el: Element): number => parseFloat(el.getAttribute("width"));

  describe("every bar flavour fills exactly the requested column width", () => {
    it.each([5, 15, 30])("absolute variance bars, two-sided data, w%i", async (n) => {
      const page = await renderTable({
        scenarios: ["ac1", "dac1_pp1_pos"],
        barColumns: ["dac1_pp1_pos"],
        barColumnMaxWidth: n,
      });

      const svgs = svgsOf(page, "absolute-variance");
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => expect(widthOf(svg)).toBeCloseTo(expectedSvgWidth(n), 3));
    });

    it("absolute variance bars, positive-only data", async () => {
      const page = await renderTable({
        scenarios: ["ac1", "dac1_pl1_pos"],
        barColumns: ["dac1_pl1_pos"],
        barColumnMaxWidth: 15,
      });

      const svgs = svgsOf(page, "absolute-variance");
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => expect(widthOf(svg)).toBeCloseTo(expectedSvgWidth(15), 3));
    });

    it.each([5, 15, 30])("relative variance pins, w%i", async (n) => {
      const page = await renderTable({
        scenarios: ["ac1", "drac1_pp1_pos"],
        barColumns: ["drac1_pp1_pos"],
        barColumnMaxWidth: n,
      });

      const svgs = svgsOf(page, "relative-variance");
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => expect(widthOf(svg)).toBeCloseTo(expectedSvgWidth(n), 3));
    });

    it.each([5, 15, 30])("waterfall bars, w%i", async (n) => {
      const page = await renderTable({
        scenarios: ["ac1"],
        barColumns: ["ac1"],
        grouped: true,
        type: TableType.SUM,
        barColumnMaxWidth: n,
      });

      const svgs = svgsOf(page, "waterfall-bar");
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => expect(widthOf(svg)).toBeCloseTo(expectedSvgWidth(n), 3));
    });
  });

  it("does not change the unitScaling basis: bar length stays |value| x unitScaling x 0.85em", async () => {
    const unitScaling = 0.05;
    const page = await renderTable({
      scenarios: ["ac1", "dac1_pp1_pos"],
      barColumns: ["dac1_pp1_pos"],
      barColumnMaxWidth: 15,
      unitScaling,
    });

    // the base bar is a direct child of the svg; pattern rects live inside <defs>
    const bar = svgsOf(page, "absolute-variance")
      .flatMap((svg) => Array.from(svg.querySelectorAll("rect")))
      .find((rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg");

    expect(bar).toBeDefined();
    expect(widthOf(bar)).toBeCloseTo(20 * unitScaling * LABEL_FONT, 3);
  });

  it("auto-fits the bars to the rows that draw one: a total row does not shrink them", async () => {
    const page = await renderTable({
      tableName: "statsData",
      type: TableType.SUM,
      scenarios: ["ac1", "dac1_pp1_pos"],
      barColumns: ["dac1_pp1_pos"],
      barColumnMaxWidth: 15,
      unitScaling: 0,
    });

    // the total row (30) draws no bar
    const svgs = svgsOf(page, "absolute-variance");
    expect(svgs.length).toBe(2);

    const [alpha, beta] = svgs.map((svg) =>
      Array.from(svg.querySelectorAll("rect")).find(
        (rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg",
      ),
    );

    // the largest drawn bar (Beta, 20) gets 80% of the bar area beside the +20.0 label
    const { maxBarWidth, cutWidth } = absoluteBarGeometry(15, EM, { pos: estimateLabelWidth("+20.0", LABEL_FONT) });
    const target = Math.min(maxBarWidth * 0.8, cutWidth);
    expect(widthOf(beta)).toBeCloseTo(target, 3);
    expect(widthOf(alpha)).toBeCloseTo(target / 2, 3); // 10 is half of 20
  });

  it("draws the largest auto-fitted bar in one piece when it ends exactly on the overdrive cut", async () => {
    const page = await renderTable({
      tableName: "cutData",
      type: TableType.SUM,
      scenarios: ["ac1", "dac1_pp1_pos"],
      barColumns: ["dac1_pp1_pos"],
      barColumnMaxWidth: 10,
      unitScaling: 0,
    });

    const svgs = svgsOf(page, "absolute-variance");
    expect(svgs.length).toBe(3);

    // no zigzag break, and one bar per row (pattern rects live inside <defs>)
    const bars = svgs.map((svg) => {
      expect(svg.querySelectorAll("path").length).toBe(0);
      const rects = Array.from(svg.querySelectorAll("rect")).filter(
        (rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg",
      );
      expect(rects.length).toBe(1);
      return rects[0];
    });

    // two-sided w10: 80% of the side is more than the cut, so the largest bar (Beta, 20) ends on the cut
    const labels = { neg: estimateLabelWidth("-5.0", LABEL_FONT), pos: estimateLabelWidth("+20.0", LABEL_FONT) };
    const { cutWidth } = absoluteBarGeometry(10, EM, labels);
    expect(widthOf(bars[1])).toBeCloseTo(cutWidth, 3);
    expect(widthOf(bars[0])).toBeCloseTo(cutWidth / 2, 3); // 10 is half of 20
  });
});
