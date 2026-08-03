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

  beforeAll(() => {
    getStores(null).db.db.tables["widthData"] = { data: rows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          scenarios={["ac1"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="widthData"
          {...extraProps}
        ></ibcs-table>
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
});
