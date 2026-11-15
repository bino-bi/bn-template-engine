// bn-context hands out its notation: font, scenario looks, variance colours
// and scaling groups, and tells when they change.
//
// The stores are the real ones: the context, the styles and the scaling
// groups have to meet in them.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

// mock-doc has no MutationObserver. The fake lets a spec report a new body
// of a bn-component-style.
import { installMutationObserverFake, notifyChildListChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

import { newSpecPage } from "@stencil/core/testing";
import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { IBCS_LINE_STYLES, Notation, SCENARIO_AREA_STYLES } from "../../utils/notation";
import { ComponentStyle } from "../bn-component-style/bn-component-style";
import { ScalingGroup } from "../bn-scaling-group/bn-scaling-group";
import { Context } from "./bn-context";

type ContextElement = HTMLElement & { getNotation(styleName?: string): Promise<Notation> };

const render = async (body: string) => {
  const page = await newSpecPage({
    components: [Context, ComponentStyle, ScalingGroup],
    html: `<bn-context>${body}</bn-context>`,
  });
  return { page, context: page.root as ContextElement };
};

const SYSTEM_TIME = SYSTEM_STYLE_DEFAULTS["bn-chart-time"];

describe("bn-context getNotation: styles", () => {
  it("returns the system values without any style", async () => {
    const { context } = await render("");

    expect(await context.getNotation()).toEqual({
      apiVersion: 1,
      fontFamily: SYSTEM_STYLE_DEFAULTS.global.fontFamily,
      fontSizePx: SYSTEM_STYLE_DEFAULTS.global.fontSizePx,
      scenarios: {
        ac: {
          bar: SYSTEM_TIME.barStyles.ac,
          line: { color: "#000000" },
          marker: { fill: "#000000", stroke: "#000000" },
          area: { fill: "#000000", opacity: 0.3, lineColor: "#000000" },
        },
        pp: {
          bar: SYSTEM_TIME.barStyles.pp,
          line: { color: "#999999" },
          marker: { fill: "#999999", stroke: "#999999" },
          area: { fill: "#999999", opacity: 0.3, lineColor: "#999999" },
        },
        fc: {
          bar: SYSTEM_TIME.barStyles.fc,
          line: { color: "#000000", dashArray: "4,4" },
          marker: { fill: "#ffffff", stroke: "#000000" },
          area: { fill: "#000000", opacity: 0.2, lineColor: "#000000", dashArray: "4,4" },
        },
        pl: {
          bar: SYSTEM_TIME.barStyles.pl,
          line: { color: "#000000" },
          marker: { fill: "#ffffff", stroke: "#000000" },
          area: { fill: "#000000", opacity: 0.1, lineColor: "#000000" },
        },
      },
      variance: SYSTEM_TIME.varianceStyles,
      scalingGroups: {},
    });
  });

  it("puts _default on top of _system when no name is given", async () => {
    const { context } = await render(
      `<bn-component-style>{"global": {"fontSizePx": 11}, "bn-chart-time": {"varianceStyles": {"pos": {"fill": "#00aa00"}}}}</bn-component-style>
       <bn-component-style name="brand">{"bn-chart-time": {"barStyles": {"ac": {"fill": "#123456"}}}}</bn-component-style>`,
    );

    const notation = await context.getNotation();

    expect(notation.fontSizePx).toBe(11);
    expect(notation.fontFamily).toBe(SYSTEM_STYLE_DEFAULTS.global.fontFamily);
    expect(notation.variance.pos).toEqual({ ...SYSTEM_TIME.varianceStyles.pos, fill: "#00aa00" });
    // the named style is not part of it
    expect(notation.scenarios.ac.bar).toEqual(SYSTEM_TIME.barStyles.ac);
  });

  it("puts the named style on top of _default and _system", async () => {
    const { context } = await render(
      `<bn-component-style>{"global": {"fontSizePx": 11, "fontFamily": "Arial"}}</bn-component-style>
       <bn-component-style name="brand">{"global": {"fontSizePx": 9}, "bn-chart-time": {"barStyles": {"ac": {"fill": "#123456"}}}}</bn-component-style>`,
    );

    const notation = await context.getNotation("brand");

    expect(notation.scenarios.ac.bar).toEqual({ ...SYSTEM_TIME.barStyles.ac, fill: "#123456" });
    expect(notation.scenarios.fc.bar).toEqual(SYSTEM_TIME.barStyles.fc);
    expect(notation.fontSizePx).toBe(9);
    expect(notation.fontFamily).toBe("Arial");
  });

  it("returns the values of _system and _default for a name that no style has", async () => {
    const { context } = await render(`<bn-component-style>{"global": {"fontSizePx": 11}}</bn-component-style>`);

    expect(await context.getNotation("missing")).toEqual(await context.getNotation());
  });

  it("has the line, marker and area looks the time chart draws with", async () => {
    const { context } = await render("");

    const { scenarios } = await context.getNotation();

    for (const key of ["ac", "pp", "fc", "pl"] as const) {
      const line = IBCS_LINE_STYLES[key];
      expect(scenarios[key].line.color).toBe(line.lineColor);
      expect(scenarios[key].line.dashArray).toBe(line.lineDashArray);
      expect(scenarios[key].marker).toEqual({ fill: line.markerFill, stroke: line.markerStroke });
      expect(scenarios[key].area).toEqual(SCENARIO_AREA_STYLES[key]);
    }
  });

  it("returns copies: a change of the result does not reach the charts", async () => {
    const { context } = await render("");

    const notation = await context.getNotation();
    notation.scenarios.ac.area.fill = "#ff0000";
    notation.scenarios.ac.bar.fill = "#ff0000";

    expect(SCENARIO_AREA_STYLES.ac.fill).toBe("#000000");
    expect((await context.getNotation()).scenarios.ac.bar.fill).toBe(SYSTEM_TIME.barStyles.ac.fill);
  });
});

describe("bn-context getNotation: scaling groups", () => {
  it("has a scaling group that was there before the call", async () => {
    const { context } = await render(
      `<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>
       <bn-scaling-group name="share" value="2.5"></bn-scaling-group>`,
    );

    expect((await context.getNotation()).scalingGroups).toEqual({ revenue: 250000, share: 2.5 });
  });

  it("waits for a scaling group that is in the context but has not loaded yet", async () => {
    const { page, context } = await render("");
    const group = page.doc.createElement("bn-scaling-group");
    group.setAttribute("name", "late");
    group.setAttribute("value", "1M");
    context.appendChild(group);

    // the group has not loaded at this point, so it has not written its value
    const pending = context.getNotation();
    expect(group.classList.contains("hydrated")).toBe(false);
    // the spec page loads a component only when its queue is flushed
    await page.waitForChanges();

    expect((await pending).scalingGroups).toEqual({ late: 1e6 });
  });

  it("leaves out a scaling group that was removed", async () => {
    const { page, context } = await render(`<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>`);

    context.querySelector("bn-scaling-group")!.remove();
    await page.waitForChanges();

    expect((await context.getNotation()).scalingGroups).toEqual({});
  });
});

describe("bn-context bnNotationChange", () => {
  const listen = (context: HTMLElement): jest.Mock => {
    const listener = jest.fn();
    context.addEventListener("bnNotationChange", listener);
    return listener;
  };

  it("fires when the value of a scaling group changes", async () => {
    const { page, context } = await render(`<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>`);
    const listener = listen(context);

    context.querySelector("bn-scaling-group")!.setAttribute("value", "500k");
    await page.waitForChanges();

    expect(listener).toHaveBeenCalledTimes(1);
    expect((await context.getNotation()).scalingGroups).toEqual({ revenue: 500000 });
  });

  it("does not fire when a scaling group is set to the value it has", async () => {
    const { page, context } = await render(`<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>`);
    const listener = listen(context);

    context.querySelector("bn-scaling-group")!.setAttribute("value", "250000");
    await page.waitForChanges();

    expect(listener).not.toHaveBeenCalled();
  });

  it("fires when a scaling group is added and when it is removed", async () => {
    const { page, context } = await render("");
    const listener = listen(context);

    const group = page.doc.createElement("bn-scaling-group");
    group.setAttribute("name", "revenue");
    group.setAttribute("value", "250k");
    context.appendChild(group);
    await page.waitForChanges();
    expect(listener).toHaveBeenCalledTimes(1);

    group.remove();
    await page.waitForChanges();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("fires when the body of a component style changes", async () => {
    const { page, context } = await render(
      `<bn-component-style name="brand">{"global": {"fontSizePx": 11}}</bn-component-style>`,
    );
    const listener = listen(context);

    const style = context.querySelector("bn-component-style")!;
    style.textContent = `{"global": {"fontSizePx": 12}}`;
    notifyChildListChange(style);
    await page.waitForChanges();

    expect(listener).toHaveBeenCalledTimes(1);
    expect((await context.getNotation("brand")).fontSizePx).toBe(12);
  });

  it("fires when a component style is added", async () => {
    const { page, context } = await render("");
    const listener = listen(context);

    const style = page.doc.createElement("bn-component-style");
    style.textContent = `{"global": {"fontSizePx": 12}}`;
    context.appendChild(style);
    await page.waitForChanges();

    expect(listener).toHaveBeenCalledTimes(1);
    expect((await context.getNotation()).fontSizePx).toBe(12);
  });

  it("does not fire after the context has left the document", async () => {
    const { page, context } = await render(`<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>`);
    const listener = listen(context);
    const group = context.querySelector("bn-scaling-group")!;

    context.remove();
    await page.waitForChanges();
    listener.mockClear();
    group.setAttribute("value", "500k");
    await page.waitForChanges();

    expect(listener).not.toHaveBeenCalled();
  });
});
