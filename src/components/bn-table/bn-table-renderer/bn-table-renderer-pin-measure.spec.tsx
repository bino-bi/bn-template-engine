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
        return { width: text.length * GLYPH_EM * parseFloat(this.font.replace("italic ", "")) };
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
});
