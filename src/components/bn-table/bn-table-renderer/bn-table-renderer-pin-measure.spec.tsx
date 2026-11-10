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
import { estimateLabelWidth } from "../utils/helper/barColumnGeometry";

const EM = 13.3333; // SYSTEM_STYLE_DEFAULTS.global.fontSizePx, scaleFactor 1
const LABEL_FONT = EM * 0.85;
const HEAD = 10; // pin head side at scaleFactor 1
/** Every glyph of the stubbed font is 0.45 em wide, narrower than the estimate. */
const GLYPH_EM = 0.45;
/** What labelWidth returns for a measured label: the width plus its pad. */
const measured = (text: string): number => text.length * GLYPH_EM * LABEL_FONT + 0.15 * LABEL_FONT;

/**
 * In the browser the labels are measured on a canvas with their own font; the spec tests
 * stub that canvas. Digits stay as long as the measured labels fit.
 */
describe("IBCS Table pin labels measured on a canvas", () => {
  const fonts: string[] = [];
  /** Glyph width of the stubbed font; a web font that loads late can change it. */
  let glyphEm = GLYPH_EM;

  // ΔPL% is +20% / -20% / 0%
  const rows: any[] = [
    { operation: "+", category: "A Up", categoryIndex: 1, ac1: 120, pl1: 100 },
    { operation: "+", category: "B Down", categoryIndex: 2, ac1: 80, pl1: 100 },
    { operation: "+", category: "C Flat", categoryIndex: 3, ac1: 100, pl1: 100 },
  ];

  // ΔPL% is +40% / -10%
  const skewedRows: any[] = [
    { operation: "+", category: "A Up", categoryIndex: 1, ac1: 140, pl1: 100 },
    { operation: "+", category: "B Down", categoryIndex: 2, ac1: 90, pl1: 100 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["measureData"] = { data: rows };
    getStores(null).db.db.tables["measureSkewedData"] = { data: skewedRows };
    const ctx = {
      font: "",
      measureText(text: string) {
        fonts.push(this.font);
        return { width: text.length * glyphEm * parseFloat(this.font.replace(/italic |bold /g, "")) };
      },
    };
    // newSpecPage makes a new document per page, so the stub goes on their prototype
    const proto = Object.getPrototypeOf(document);
    const createElement = proto.createElement;
    jest.spyOn(proto, "createElement").mockImplementation(function (this: Document, tag: string) {
      return tag === "canvas" ? { getContext: () => ctx } : createElement.call(this, tag);
    });
  });

  afterAll(() => jest.restoreAllMocks());
  afterEach(() => (glyphEm = GLYPH_EM));

  const renderColumn = (column: string, extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", column]}
          barColumns={[column]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="measureData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const svgOf = (page: SpecPage, category: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"))
      .find((row) => row.querySelector("td")?.textContent.trim() === category)
      .querySelector("svg");
  const num = (el: Element, attr: string): number => parseFloat(el.getAttribute(attr));

  const expectInside = (svg: Element) => {
    const label = svg.querySelector("text");
    const x = num(label, "x");
    const width = measured(label.textContent);
    if (label.getAttribute("text-anchor") === "end") expect(x - width).toBeGreaterThanOrEqual(-1e-6);
    else expect(x + width).toBeLessThanOrEqual(num(svg, "width") + 1e-6);
  };

  it("measures pin labels in italic and bar labels upright, in the label font", async () => {
    fonts.length = 0;
    await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 10 });
    expect(fonts.length).toBeGreaterThan(0);
    expect(new Set(fonts)).toEqual(new Set([`italic ${LABEL_FONT}px 'Noto Sans', sans-serif`]));

    fonts.length = 0;
    await renderColumn("dac1_pl1_pos", { unitScaling: 0, barColumnMaxWidth: 10 });
    expect(new Set(fonts)).toEqual(new Set([`${LABEL_FONT}px 'Noto Sans', sans-serif`]));
  });

  it("measures waterfall labels upright, the sum row in bold, and fits the column to them", async () => {
    fonts.length = 0;
    const page = await renderColumn("ac1", { scenarios: ["ac1"], type: TableType.SUM, barColumnMaxWidth: 15 });

    const font = `${LABEL_FONT}px 'Noto Sans', sans-serif`;
    expect(new Set(fonts)).toEqual(new Set([font, `bold ${font}`]));
    // all bars point right: no room on the left, the label of the total ends at the right edge
    const total = page.root.shadowRoot.querySelector("tbody tr.sum svg.waterfall-bar");
    expect(num(svgOf(page, "A Up").querySelector("rect:not(pattern rect)"), "x")).toBeCloseTo(0, 6);
    expect(num(total.querySelector("text"), "x") + measured("300.0")).toBeCloseTo(num(total, "width"), 3);
  });

  // the estimate drops the digits at w10, the measured labels fit: 2 x (5 + 4 + 37.4) + 2 x 1em <= 126.7
  it("keeps the digits at w10 because the measured labels fit", async () => {
    const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 10 });

    expect(svgOf(page, "A Up").querySelector("text").textContent).toBe("+20.00%");
    expect(svgOf(page, "B Down").querySelector("text").textContent).toBe("-20.00%");
    expect(svgOf(page, "C Flat").querySelector("text").textContent).toBe("0.00%");
    for (const category of ["A Up", "B Down", "C Flat"]) expectInside(svgOf(page, category));
  });

  // at w8 neither 2 nor 1 digit leaves 1em of pin per side, 0 digits do
  it("drops the digits only when the measured labels do not fit", async () => {
    const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 8 });

    expect(svgOf(page, "A Up").querySelector("text").textContent).toBe("+20%");
    expect(svgOf(page, "B Down").querySelector("text").textContent).toBe("-20%");
    for (const category of ["A Up", "B Down"]) expectInside(svgOf(page, category));
  });

  // a 20% pin is 20.4 px at 0.09; the room per side is 16.95 px with 2 digits and 22.05 px with 1
  it("gives the room of the shorter negative pins to the positive ones", async () => {
    const page = await renderColumn("drac1_pl1_pos", {
      percentageScaling: 0,
      barColumnMaxWidth: 10,
      tableName: "measureSkewedData",
    });

    const up = svgOf(page, "A Up");
    const down = svgOf(page, "B Down");
    // the pin line starts on the axis; the axis lines sit in their own group
    const child = (svg: Element, tag: string) =>
      Array.from(svg.children).find((el) => el.tagName.toLowerCase() === tag);
    const pinLine = (svg: Element) => child(svg, "line");
    const axisX = num(pinLine(up), "x1");
    expect(num(pinLine(down), "x1")).toBeCloseTo(axisX, 6);
    const upPin = num(child(up, "rect"), "x") + HEAD / 2 - axisX;
    const downPin = axisX - num(child(down, "rect"), "x") - HEAD / 2;
    // one scale: 40% is four times 10%
    expect(upPin).toBeCloseTo(4 * downPin, 3);
    // the longest pins and their labels fill the cell on both sides
    expect(num(up.querySelector("text"), "x") + measured("+40.00%")).toBeCloseTo(num(up, "width"), 3);
    expect(num(down.querySelector("text"), "x") - measured("-10.00%")).toBeCloseTo(0, 3);
    // longer than with an equal split, where 40% would get half the room
    const room = num(up, "width") - measured("+40.00%") - measured("-10.00%") - 2 * (HEAD / 2 + 0.3 * EM);
    expect(upPin).toBeCloseTo(room * 0.8, 3);
    expect(page.root.shadowRoot.querySelectorAll("svg.relative-variance polygon").length).toBe(0);
  });

  // a fixed scale of 2 em per pp cuts both pins; at w16 the line holds the measured label, not the estimated one
  it("puts the label of a cut pin on the line when its measured width fits", async () => {
    const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2, barColumnMaxWidth: 16 });

    const up = svgOf(page, "A Up");
    const baseX = Math.min(...up.querySelector("polygon").getAttribute("points").split(" ").map(parseFloat));
    const lineLength = baseX - num(up, "width") / 2 - (0.25 * EM) / 2;
    const pad = 0.2 * LABEL_FONT;
    expect(lineLength).toBeGreaterThanOrEqual(measured("+20.00%") + 4 * pad);
    expect(lineLength).toBeLessThan(estimateLabelWidth("+20.00%", LABEL_FONT) + 4 * pad);

    const band = up.querySelector(".pin-label-band");
    expect(num(band, "width")).toBeCloseTo(measured("+20.00%") + 2 * pad, 3);
    expect(num(band, "x") + num(band, "width")).toBeCloseTo(baseX - pad, 3);
    expect(up.querySelector("text").getAttribute("text-anchor")).toBe("middle");
  });

  it("keeps the label of a cut pin after the tip when its measured width does not fit the line", async () => {
    const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2, barColumnMaxWidth: 15 });

    for (const category of ["A Up", "B Down"]) {
      const svg = svgOf(page, category);
      expect(svg.querySelector("polygon")).not.toBeNull();
      expect(svg.querySelector(".pin-label-band")).toBeNull();
      expectInside(svg);
    }
  });

  describe("and web fonts", () => {
    // mock-doc has no document.fonts
    const listeners = new Set<() => void>();
    const fontSet = {
      addEventListener: (type: string, listener: () => void) => type === "loadingdone" && listeners.add(listener),
      removeEventListener: (type: string, listener: () => void) => type === "loadingdone" && listeners.delete(listener),
    };

    beforeEach(() => {
      listeners.clear();
      Object.defineProperty(document, "fonts", { value: fontSet, configurable: true });
    });

    afterEach(() => {
      // @ts-ignore - only set for these tests
      delete document.fonts;
    });

    it("measures the labels again when a web font has loaded", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 10 });
      expect(svgOf(page, "A Up").querySelector("text").textContent).toBe("+20.00%");
      expect(listeners.size).toBe(1);

      // the loaded font is wider than the fallback: the digits no longer fit
      glyphEm = 0.7;
      listeners.forEach((listener) => listener());
      await page.waitForChanges();

      expect(svgOf(page, "A Up").querySelector("text").textContent).toBe("+20%");
    });

    it("lays out a waterfall column again when a web font has loaded", async () => {
      const page = await renderColumn("ac1", { scenarios: ["ac1"], type: TableType.SUM, barColumnMaxWidth: 15 });
      const total = () => page.root.shadowRoot.querySelector("tbody tr.sum svg.waterfall-bar text");
      const before = num(total(), "x");

      // the loaded font is wider: the labels need more room, the bars get shorter
      glyphEm = 0.7;
      listeners.forEach((listener) => listener());
      await page.waitForChanges();

      expect(num(total(), "x")).toBeLessThan(before - 1);
      const width = (5 * 0.7 + 0.15) * LABEL_FONT;
      expect(num(total(), "x") + width).toBeCloseTo(num(total().closest("svg"), "width"), 3);
    });

    it("stops listening when it leaves the document", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 10 });

      page.root.remove();

      expect(listeners.size).toBe(0);
    });
  });
});
