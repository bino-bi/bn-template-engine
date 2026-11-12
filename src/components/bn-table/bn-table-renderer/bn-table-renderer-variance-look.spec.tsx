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
import { absoluteBarGeometry, estimateLabelWidth, relativePinGeometry } from "../utils/helper/barColumnGeometry";

const EM = 13.3333; // SYSTEM_STYLE_DEFAULTS.global.fontSizePx, scaleFactor 1
const LABEL_FONT = EM * 0.85;
const BAR_COLUMN_WIDTH = 30; // default bar column width in em
const HEAD = 10; // pin head side at scaleFactor 1
const AXIS_WIDTH = 0.25 * EM;
const labelWidth = (text: string): number => estimateLabelWidth(text, LABEL_FONT);

/**
 * IBCS: the bar pattern and the pin head follow the minuend, the colour the sentiment,
 * and the axis is drawn in the look of the reference (subtrahend) scenario.
 */
describe("IBCS Table variance look", () => {
  // ΔPL of ac1 is +20 / -20 / 0; ΔPL of fc1, ΔFC of ac1 and ΔPY of pl1 are +10 / -10 / 0
  const rows: any[] = [
    { operation: "+", category: "A Up", categoryIndex: 1, ac1: 120, fc1: 110, pl1: 100, pp1: 90 },
    { operation: "+", category: "B Down", categoryIndex: 2, ac1: 80, fc1: 90, pl1: 100, pp1: 110 },
    { operation: "+", category: "C Flat", categoryIndex: 3, ac1: 100, fc1: 100, pl1: 100, pp1: 100 },
  ];

  // ΔPL of ac1 is -20 / 0, so a pin column has no positive side
  const negativeRows: any[] = [
    { operation: "+", category: "A Down", categoryIndex: 1, ac1: 80, pl1: 100 },
    { operation: "+", category: "B Flat", categoryIndex: 2, ac1: 100, pl1: 100 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["lookData"] = { data: rows };
    getStores(null).db.db.tables["lookNegativeData"] = { data: negativeRows };
  });

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
          tableName="lookData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const svgOf = (page: SpecPage, category: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"))
      .find((row) => row.querySelector("td")?.textContent.trim() === category)
      .querySelector("svg");

  const children = (svg: Element): Element[] => Array.from(svg.children);
  const directChildren = (svg: Element, tag: string): Element[] =>
    children(svg).filter((el) => el.tagName.toLowerCase() === tag);
  const num = (el: Element, attr: string): number => parseFloat(el.getAttribute(attr));

  describe("relative variance pins", () => {
    // 20% x 0.5 em per pp x the label font: about 113 px, inside the pin area
    const percentageScaling = 0.5;
    const pinLength = 20 * percentageScaling * LABEL_FONT;
    // the labels are +20.00%, -20.00% and 0.00%
    const sides = { neg: labelWidth("-20.00%"), pos: labelWidth("+20.00%") };
    const { axisX, maxPinLength, labelGap, totalWidth } = relativePinGeometry(BAR_COLUMN_WIDTH, EM, sides, HEAD);

    it("ends in a square head under the line and the axis, in the AC look for an AC minuend", async () => {
      const svg = svgOf(await renderColumn("drac1_pl1_pos", { percentageScaling }), "A Up");

      expect(svg.querySelector("circle")).toBeNull();
      const [head] = directChildren(svg, "rect");
      expect(num(head, "width")).toBe(HEAD);
      expect(num(head, "height")).toBe(HEAD);
      expect(num(head, "x") + HEAD / 2).toBeCloseTo(axisX + pinLength, 3);
      expect(head.getAttribute("fill")).toBe("#404040");
      expect(head.getAttribute("stroke")).toBe("#404040");

      const pinLine = directChildren(svg, "line").find((line) => line.getAttribute("y1") !== "0");
      expect(pinLine.getAttribute("stroke")).toBe("#008f96");
      // the line ends visibly in the centre of the head, and a head near zero does not cover the axis
      expect(num(pinLine, "x2")).toBeCloseTo(num(head, "x") + HEAD / 2, 3);
      expect(children(svg).indexOf(pinLine)).toBeGreaterThan(children(svg).indexOf(head));
      const axis = svg.querySelector("g.variance-axis");
      expect(children(svg).indexOf(axis)).toBeGreaterThan(children(svg).indexOf(pinLine));
    });

    it("puts the label beside the head like an absolute bar label", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling });

      const up = svgOf(page, "A Up").querySelector("text");
      expect(up.getAttribute("text-anchor")).toBe("start");
      expect(num(up, "x")).toBeCloseTo(axisX + pinLength + HEAD / 2 + labelGap, 3);

      const down = svgOf(page, "B Down").querySelector("text");
      expect(down.getAttribute("text-anchor")).toBe("end");
      expect(num(down, "x")).toBeCloseTo(axisX - pinLength - HEAD / 2 - labelGap, 3);
    });

    it("draws only the head on the axis for a zero variance", async () => {
      const svg = svgOf(await renderColumn("drac1_pl1_pos", { percentageScaling }), "C Flat");

      const [head] = directChildren(svg, "rect");
      expect(num(head, "x") + HEAD / 2).toBeCloseTo(axisX, 3);
    });

    it("prints a zero variance without a sign, as a pin and as a bar label", async () => {
      expect(svgOf(await renderColumn("drac1_pl1_pos", { percentageScaling }), "C Flat").textContent).toBe("0.00%");
      expect(svgOf(await renderColumn("dac1_pl1_pos", { unitScaling: 0.05 }), "C Flat").textContent).toBe("0.0");
    });

    it("puts a zero label in the left gutter of a column without positive values", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling, tableName: "lookNegativeData" });
      const negative = relativePinGeometry(BAR_COLUMN_WIDTH, EM, { neg: labelWidth("-20.00%") }, HEAD);

      const label = svgOf(page, "B Flat").querySelector("text");
      expect(label.getAttribute("text-anchor")).toBe("end");
      expect(num(label, "x")).toBeCloseTo(negative.axisX - HEAD / 2 - negative.labelGap, 3);
      expect(num(label, "x")).toBeLessThanOrEqual(negative.totalWidth);
    });

    it("fills the outlined head of a PL minuend white so the pin line does not show through", async () => {
      const svg = svgOf(await renderColumn("drpl1_pp1_pos", { percentageScaling }), "A Up");

      const [head] = directChildren(svg, "rect");
      expect(head.getAttribute("fill")).toBe("#ffffff");
      expect(head.getAttribute("stroke")).toBe("#404040");
    });

    it("hatches the head of an FC minuend, with an outline and the pattern in its own svg", async () => {
      const svg = svgOf(await renderColumn("drfc1_pl1_pos", { percentageScaling }), "A Up");

      const [head] = directChildren(svg, "rect");
      expect(head.getAttribute("fill")).toBe("url(#pattern-fc-404040)");
      expect(head.getAttribute("stroke")).toBe("#404040");
      expect(num(head, "stroke-width")).toBeGreaterThan(0);
      expect(svg.querySelector("pattern#pattern-fc-404040")).not.toBeNull();
    });

    const ARROW = 1.2 * HEAD;
    const BAND_PAD = 0.2 * LABEL_FONT;
    const xsOf = (svg: Element): number[] =>
      svg.querySelector("polygon").getAttribute("points").split(" ").map(parseFloat);
    const ysOf = (svg: Element): number[] =>
      svg
        .querySelector("polygon")
        .getAttribute("points")
        .split(" ")
        .map((point) => parseFloat(point.split(",")[1]));

    it("cuts an outlier with an arrow and puts the label on the line behind the arrow head, on a light band", async () => {
      // 20% x 2 em per pp is far beyond the pin area
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2 });

      const up = svgOf(page, "A Up");
      const upXs = xsOf(up);
      const tipX = Math.max(...upXs);
      expect(tipX).toBeCloseTo(axisX + maxPinLength + HEAD / 2, 3);
      // the arrow head is 1.2 x the square head, in length and in height
      const baseX = Math.min(...upXs);
      expect(tipX - baseX).toBeCloseTo(ARROW, 3);
      expect(Math.max(...ysOf(up)) - Math.min(...ysOf(up))).toBeCloseTo(ARROW, 3);
      expect(num(directChildren(up, "line").pop(), "x2")).toBeCloseTo(baseX, 3);

      const upBands = directChildren(up, "rect");
      expect(upBands.length).toBe(1);
      const [upBand] = upBands;
      expect(upBand.getAttribute("fill")).toBe("#ffffff");
      expect(upBand.getAttribute("fill-opacity")).toBe("0.5");
      expect(num(upBand, "width")).toBeCloseTo(labelWidth("+20.00%") + 2 * BAND_PAD, 3);
      expect(num(upBand, "x") + num(upBand, "width")).toBeCloseTo(baseX - BAND_PAD, 3);
      expect(num(upBand, "x")).toBeGreaterThan(axisX + AXIS_WIDTH / 2);
      // the band is drawn over the line and under the label
      const order = children(up);
      expect(order.indexOf(upBand)).toBeGreaterThan(order.indexOf(up.querySelector("polygon")));
      expect(order.indexOf(upBand)).toBeLessThan(order.indexOf(up.querySelector("text")));

      const upLabel = up.querySelector("text");
      expect(upLabel.textContent).toBe("+20.00%");
      expect(upLabel.getAttribute("text-anchor")).toBe("middle");
      expect(num(upLabel, "x")).toBeCloseTo(num(upBand, "x") + num(upBand, "width") / 2, 3);
      expect(upLabel.getAttribute("paint-order")).toBeNull();

      const down = svgOf(page, "B Down");
      const downXs = xsOf(down);
      const downTipX = Math.min(...downXs);
      expect(downTipX).toBeCloseTo(axisX - maxPinLength - HEAD / 2, 3);
      const downBaseX = Math.max(...downXs);
      expect(downBaseX - downTipX).toBeCloseTo(ARROW, 3);
      const [downBand] = directChildren(down, "rect");
      expect(num(downBand, "x")).toBeCloseTo(downBaseX + BAND_PAD, 3);
      expect(num(downBand, "width")).toBeCloseTo(labelWidth("-20.00%") + 2 * BAND_PAD, 3);
      expect(num(downBand, "x") + num(downBand, "width")).toBeLessThan(axisX - AXIS_WIDTH / 2);
      const downLabel = down.querySelector("text");
      expect(downLabel.textContent).toBe("-20.00%");
      expect(downLabel.getAttribute("text-anchor")).toBe("middle");
      expect(num(downLabel, "x")).toBeCloseTo(num(downBand, "x") + num(downBand, "width") / 2, 3);
    });

    it("draws no band on a pin that is not cut", async () => {
      const up = svgOf(await renderColumn("drac1_pl1_pos", { percentageScaling }), "A Up");

      expect(up.querySelector(".pin-label-band")).toBeNull();
      expect(up.querySelector("text").getAttribute("text-anchor")).toBe("start");
    });

    // w12 fits 2 decimals, w10 only 0, w8 drops the %; at w5 the pins get shorter than 1em
    it.each([
      [12, "+20.00%", "-20.00%"],
      [10, "+20%", "-20%"],
      [8, "+20", "-20"],
      [5, "+20", "-20"],
    ])(
      "puts the labels of cut pins after the tip, inside a w%i column too narrow for a label on the line",
      async (width, upText, downText) => {
        const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2, barColumnMaxWidth: width });

        const up = svgOf(page, "A Up");
        expect(up.querySelector(".pin-label-band")).toBeNull();
        const upLabel = up.querySelector("text");
        expect(upLabel.textContent).toBe(upText);
        expect(upLabel.getAttribute("text-anchor")).toBe("start");
        expect(num(upLabel, "x")).toBeCloseTo(Math.max(...xsOf(up)) + 0.3 * EM, 3);
        expect(num(upLabel, "x") + labelWidth(upText)).toBeLessThanOrEqual(num(up, "width") + 1e-6);

        const down = svgOf(page, "B Down");
        expect(down.querySelector(".pin-label-band")).toBeNull();
        const downLabel = down.querySelector("text");
        expect(downLabel.textContent).toBe(downText);
        expect(downLabel.getAttribute("text-anchor")).toBe("end");
        expect(num(downLabel, "x") - labelWidth(downText)).toBeGreaterThanOrEqual(-1e-6);
      },
    );

    // the line from the axis edge to the arrow head must hold the band and a pad on each side
    it.each([
      [16, false],
      [20, true],
    ])("decides at w%i by the line length if the label stands on it: %s", async (width, onLine) => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2, barColumnMaxWidth: width });

      for (const category of ["A Up", "B Down"]) {
        const svg = svgOf(page, category);
        const xs = xsOf(svg);
        const text = svg.querySelector("text").textContent;
        const lineLength = Math.min(...xs.map((x) => Math.abs(x - num(svg, "width") / 2))) - AXIS_WIDTH / 2;
        expect(lineLength >= labelWidth(text) + 4 * BAND_PAD).toBe(onLine);

        const band = svg.querySelector(".pin-label-band");
        expect(band !== null).toBe(onLine);
        if (!band) continue;
        // the band stays between the axis and the arrow head, so the label never leaves the line
        const from = num(band, "x");
        const to = from + num(band, "width");
        const [lineFrom, lineTo] = [
          num(svg, "width") / 2,
          category === "A Up" ? Math.min(...xs) : Math.max(...xs),
        ].sort((a, b) => a - b);
        expect(from).toBeGreaterThanOrEqual(lineFrom);
        expect(to).toBeLessThanOrEqual(lineTo);
      }
    });

    it("drops the digits for the whole column, also for an auto-scaled one", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0, barColumnMaxWidth: 10 });

      expect(svgOf(page, "A Up").querySelector("text").textContent).toBe("+20%");
      expect(svgOf(page, "B Down").querySelector("text").textContent).toBe("-20%");
      expect(svgOf(page, "C Flat").querySelector("text").textContent).toBe("0%");
    });

    it("never cuts a pin with auto scaling", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0 });

      expect(page.root.shadowRoot.querySelectorAll("svg.relative-variance polygon").length).toBe(0);
    });

    it("auto-scales the longest pin so that its head and its 2-decimal label exactly fill the cell", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0 });

      const up = svgOf(page, "A Up");
      const upLabel = up.querySelector("text");
      expect(upLabel.textContent).toBe("+20.00%");
      expect(num(upLabel, "x") + labelWidth("+20.00%")).toBeCloseTo(totalWidth, 3);

      const downLabel = svgOf(page, "B Down").querySelector("text");
      expect(downLabel.textContent).toBe("-20.00%");
      expect(num(downLabel, "x") - labelWidth("-20.00%")).toBeGreaterThanOrEqual(-1e-6);

      // before, the 3.375em gutters left 146.7 px per side and auto scaling used 80% of it
      const [head] = directChildren(up, "rect");
      const pin = num(head, "x") + HEAD / 2 - axisX;
      expect(pin).toBeCloseTo(maxPinLength, 3);
      expect(pin).toBeGreaterThan(146.7 * 0.8 * 1.15);
    });
  });

  describe("absolute variance bars", () => {
    const unitScaling = 0.05;
    const bar = (svg: Element): Element => directChildren(svg, "rect")[0];

    it("hatches the bars of an FC minuend in the sentiment colour, with an outline", async () => {
      const page = await renderColumn("dfc1_pl1_pos", { unitScaling });

      const up = bar(svgOf(page, "A Up"));
      expect(up.getAttribute("fill")).toBe("url(#pattern-pos-008f96)");
      expect(up.getAttribute("stroke")).toBe("#008f96");
      expect(num(up, "stroke-width")).toBeGreaterThan(0);

      const down = bar(svgOf(page, "B Down"));
      expect(down.getAttribute("fill")).toBe("url(#pattern-neg-ff0000)");
      expect(down.getAttribute("stroke")).toBe("#ff0000");
    });

    it("keeps the bars of an AC minuend solid", async () => {
      const up = bar(svgOf(await renderColumn("dac1_pl1_pos", { unitScaling }), "A Up"));

      expect(up.getAttribute("fill")).toBe("#008f96");
      expect(up.getAttribute("stroke")).toBe("none");
    });

    it("outlines the bars of a PL minuend", async () => {
      const up = bar(svgOf(await renderColumn("dpl1_pp1_pos", { unitScaling }), "A Up"));

      expect(up.getAttribute("fill")).toBe("transparent");
      expect(up.getAttribute("stroke")).toBe("#008f96");
    });

    it("follows the slot a ruleSet colorIndex selects for the minuend", async () => {
      const page = await renderColumn("dpl1_pp1_pos", {
        unitScaling,
        ruleSetConfig: { scenarios: { pl: { colorIndex: 30 } } },
      });

      expect(bar(svgOf(page, "A Up")).getAttribute("fill")).toBe("url(#pattern-pos-008f96)");
    });

    it("keeps the labels of overdrive bars inside the cell", async () => {
      // 20 x 1 em per unit is far beyond the bar area
      const page = await renderColumn("dac1_pl1_pos", { unitScaling: 1, barColumnMaxWidth: 10 });

      const up = svgOf(page, "A Up");
      expect(up.querySelectorAll("path").length).toBe(2); // the zigzag break
      const upLabel = up.querySelector("text");
      expect(num(upLabel, "x") + labelWidth("+20.0")).toBeLessThanOrEqual(num(up, "width") + 1e-6);

      const downLabel = svgOf(page, "B Down").querySelector("text");
      expect(downLabel.textContent).toBe("-20.0");
      expect(num(downLabel, "x") - labelWidth("-20.0")).toBeGreaterThanOrEqual(-1e-6);
    });

    it("starts the bars at the outer edge of the axis without changing their length", async () => {
      const page = await renderColumn("dac1_pl1_pos", { unitScaling });
      const { axisX } = absoluteBarGeometry(BAR_COLUMN_WIDTH, EM, { neg: labelWidth("-20"), pos: labelWidth("+20") });
      const width = 20 * unitScaling * LABEL_FONT;

      const up = bar(svgOf(page, "A Up"));
      expect(num(up, "x")).toBeCloseTo(axisX + AXIS_WIDTH / 2, 3);
      expect(num(up, "width")).toBeCloseTo(width, 3);

      const down = bar(svgOf(page, "B Down"));
      expect(num(down, "x") + num(down, "width")).toBeCloseTo(axisX - AXIS_WIDTH / 2, 3);
    });
  });

  describe("the axis in the look of the reference scenario", () => {
    const axisLines = async (column: string): Promise<Element[]> => {
      const svg = svgOf(await renderColumn(column), "A Up");
      return Array.from(svg.querySelectorAll(`g.variance-axis line`));
    };

    it("is a thick grey line for PY", async () => {
      const lines = await axisLines("dpl1_pp1_pos");

      expect(lines.length).toBe(1);
      expect(lines[0].getAttribute("stroke")).toBe("#A6A6A6");
      expect(num(lines[0], "stroke-width")).toBeCloseTo(AXIS_WIDTH, 3);
    });

    it("is a thick dark line for AC", async () => {
      const lines = await axisLines("dpl1_ac1_pos");

      expect(lines.length).toBe(1);
      expect(lines[0].getAttribute("stroke")).toBe("#404040");
      expect(num(lines[0], "stroke-width")).toBeCloseTo(AXIS_WIDTH, 3);
    });

    it("is a double line for PL", async () => {
      const lines = await axisLines("dac1_pl1_pos");

      expect(lines.length).toBe(2);
      expect(lines.map((line) => line.getAttribute("stroke"))).toEqual(["#404040", "#404040"]);
      expect(num(lines[1], "x1") - num(lines[0], "x1")).toBeCloseTo(AXIS_WIDTH - 1, 3);
    });

    it("is a dashed dark line for FC", async () => {
      const lines = await axisLines("dac1_fc1_pos");

      expect(lines.length).toBe(1);
      expect(lines[0].getAttribute("stroke")).toBe("#404040");
      expect(lines[0].getAttribute("stroke-dasharray")).toBeTruthy();
    });

    it("is drawn for pins too", async () => {
      const svg = svgOf(await renderColumn("drac1_pp1_pos"), "A Up");

      expect(svg.querySelector("g.variance-axis.axis-pp")).not.toBeNull();
    });

    it("keeps the thin axis of a scenario bar column", async () => {
      const svg = svgOf(await renderColumn("pl1"), "A Up");

      expect(svg.querySelector("g.variance-axis")).toBeNull();
      expect(directChildren(svg, "line")[0].getAttribute("stroke")).toBe("#666666");
    });
  });
});
