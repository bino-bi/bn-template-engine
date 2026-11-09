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
import { absoluteBarGeometry, relativePinGeometry } from "../utils/helper/barColumnGeometry";

const EM = 13.3333; // SYSTEM_STYLE_DEFAULTS.global.fontSizePx, scaleFactor 1
const LABEL_FONT = EM * 0.85;
const BAR_COLUMN_WIDTH = 30; // default bar column width in em
const HEAD = 10; // pin head side at scaleFactor 1
const AXIS_WIDTH = 0.25 * EM;

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

  beforeAll(() => {
    getStores(null).db.db.tables["lookData"] = { data: rows };
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
    // 20% x 0.5 em per pp x the label font: about 113 px, inside the 146.7 px pin area
    const percentageScaling = 0.5;
    const pinLength = 20 * percentageScaling * LABEL_FONT;
    const { axisX, maxPinLength, labelGap } = relativePinGeometry(BAR_COLUMN_WIDTH, EM, true, true);

    it("ends in a square head on top of the line, in the AC look for an AC minuend", async () => {
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
      expect(children(svg).indexOf(head)).toBeGreaterThan(children(svg).indexOf(pinLine));
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

    it("hatches the head of an FC minuend, with an outline and the pattern in its own svg", async () => {
      const svg = svgOf(await renderColumn("drfc1_pl1_pos", { percentageScaling }), "A Up");

      const [head] = directChildren(svg, "rect");
      expect(head.getAttribute("fill")).toBe("url(#pattern-fc-404040)");
      expect(head.getAttribute("stroke")).toBe("#404040");
      expect(num(head, "stroke-width")).toBeGreaterThan(0);
      expect(svg.querySelector("pattern#pattern-fc-404040")).not.toBeNull();
    });

    it("cuts an outlier with an arrow and puts the label inside the pin", async () => {
      // 20% x 2 em per pp is far beyond the pin area
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2 });

      const up = svgOf(page, "A Up");
      expect(directChildren(up, "rect").length).toBe(0);
      const tipX = Math.max(...up.querySelector("polygon").getAttribute("points").split(" ").map(parseFloat));
      expect(tipX).toBeCloseTo(axisX + maxPinLength + HEAD / 2, 3);
      const upLabel = up.querySelector("text");
      expect(upLabel.getAttribute("text-anchor")).toBe("end");
      expect(num(upLabel, "x")).toBeCloseTo(tipX - HEAD - labelGap, 3);
      expect(upLabel.getAttribute("paint-order")).toBe("stroke");

      const down = svgOf(page, "B Down");
      const downTipX = Math.min(...down.querySelector("polygon").getAttribute("points").split(" ").map(parseFloat));
      expect(downTipX).toBeCloseTo(axisX - maxPinLength - HEAD / 2, 3);
      const downLabel = down.querySelector("text");
      expect(downLabel.getAttribute("text-anchor")).toBe("start");
      expect(num(downLabel, "x")).toBeGreaterThan(downTipX + HEAD);
    });

    it("puts an outlier label after the arrow when the pin is too short for it", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 2, barColumnMaxWidth: 5 });
      const narrow = relativePinGeometry(5, EM, true, true);

      const label = svgOf(page, "A Up").querySelector("text");
      expect(label.getAttribute("text-anchor")).toBe("start");
      expect(num(label, "x")).toBeCloseTo(narrow.axisX + narrow.maxPinLength + HEAD / 2 + narrow.labelGap, 3);
      expect(label.getAttribute("paint-order")).toBeNull();
    });

    it("never cuts a pin with auto scaling", async () => {
      const page = await renderColumn("drac1_pl1_pos", { percentageScaling: 0 });

      expect(page.root.shadowRoot.querySelectorAll("svg.relative-variance polygon").length).toBe(0);
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

    it("starts the bars at the outer edge of the axis without changing their length", async () => {
      const page = await renderColumn("dac1_pl1_pos", { unitScaling });
      const { axisX } = absoluteBarGeometry(BAR_COLUMN_WIDTH, EM, true, true);
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
