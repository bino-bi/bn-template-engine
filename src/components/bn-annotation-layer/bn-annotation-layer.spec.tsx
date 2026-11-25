// jest.mock must physically precede the imports (Stencil's transform does not hoist it).
let nextId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${nextId++}` }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const stores = {
    annotationsUnplaced: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
  };
  return { getStores: () => stores, clearStoresCache: () => {}, findContextElement: () => undefined };
});

// mock-doc has none of the observers
(global as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const watched: { target: Node; options: MutationObserverInit }[] = [];
(global as any).MutationObserver = class {
  observe(target: Node, options: MutationObserverInit) {
    watched.push({ target, options });
  }
  disconnect() {}
};

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { AnnotationLayer } from "./bn-annotation-layer";
import { getStores } from "../../context/context-protocol";
import { annotationPageKey } from "../../utils/annotations";
import { ComponentRegister } from "../../utils/componentRegister";

const RECT = { context: { x: 5, y: 5, width: 10, height: 10 }, component: { x: 5, y: 5, width: 10, height: 10 } };
const BAR = { kind: "bar", rect: RECT, point: { part: "element", date: "2024-01-01", scenario: "ac1" } };

const ITEMS = [
  { label: "1", target: "t", point: { date: "2024-01-01", scenario: "ac1" } },
  { label: "2", mark: "frame", target: "t", point: { date: "1999-01-01", scenario: "ac1" } },
  { label: "3", target: "nowhere", point: { date: "2024-01-01" } },
];

/** A page with a stand-in chart whose layout state resolves when the test says so. */
const setup = async (
  items: unknown[] = ITEMS,
): Promise<{ page: SpecPage; layer: HTMLElement; release: () => void; pending: Promise<void> }> => {
  const page = await newSpecPage({
    components: [AnnotationLayer],
    html: `<bn-layout-page>
      <div slot="slot-0" data-bino-annotation-target="t"><bn-chart-time></bn-chart-time></div>
      <bn-annotation-layer slot="annotations"></bn-annotation-layer>
    </bn-layout-page>`,
  });
  const layer = page.body.querySelector("bn-annotation-layer") as HTMLElement;

  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const chart = page.body.querySelector("bn-chart-time") as any;
  chart.getLayoutState = async () => {
    await pending;
    return { elements: [BAR] };
  };

  // mock-doc has no CTM, and no layout to convert
  (layer.shadowRoot!.querySelector("svg") as any).getScreenCTM = () => null;
  (layer as any).items = JSON.stringify(items);
  await page.waitForChanges();
  return { page, layer, release, pending };
};

const until = async (page: SpecPage, condition: () => boolean) => {
  for (let i = 0; i < 200 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await page.waitForChanges();
  }
  expect(condition()).toBe(true);
};

const marks = (layer: HTMLElement) =>
  Array.from(layer.shadowRoot!.querySelectorAll(".mark")).map((mark) => mark.getAttribute("class"));

describe("bn-annotation-layer", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("holds the register until the marks are placed", async () => {
    const { page, layer, release } = await setup(ITEMS.slice(0, 1));

    await new Promise((resolve) => setTimeout(resolve, 60));
    await page.waitForChanges();
    expect(ComponentRegister.componentRegisterStatus().running).toBeGreaterThan(0);
    expect(marks(layer)).toEqual([]);

    release();
    await until(page, () => marks(layer).length === 1);
    await until(page, () => ComponentRegister.componentRegisterStatus().running === 0);
  });

  it("draws what it can place, does not fail, and records the labels of the rest", async () => {
    const { page, layer, release } = await setup();
    release();

    await until(page, () => marks(layer).length === 1);
    expect(marks(layer)).toEqual(["mark marker"]);
    expect(layer.hasAttribute("has-error")).toBe(false);
    expect(getStores(layer).annotationsUnplaced.state[annotationPageKey(layer)]).toEqual(["2", "3"]);
  });

  it("draws a marker as a ring with a coloured number when the style asks for outlined markers", async () => {
    const { page, layer, release } = await setup();
    const styles = getStores(layer).componentStyles;
    styles.set("_default", { "bn-annotation": { markerStyle: "outlined" } } as never);
    try {
      release();
      await until(page, () => marks(layer).length === 1);
      await page.waitForChanges();
      const circle = layer.shadowRoot!.querySelector(".marker circle") as SVGElement;
      expect(circle.style.fill).toBe("#ffffff");
      expect(circle.style.stroke).toContain("#0070c0");
      expect((layer.shadowRoot!.querySelector(".marker .badge-text") as SVGElement).style.fill).toContain("#0070c0");
    } finally {
      styles.set("_default", {} as never);
    }
  });

  it("names an item it could not place in a console warning, once", async () => {
    const { page, release } = await setup();
    release();

    await until(page, () => warn.mock.calls.length === 2);
    expect(warn.mock.calls[0][0]).toContain("frame 2 is not drawn: 0 elements match");
    expect(warn.mock.calls[1][0]).toContain('marker 3 is not drawn: no target "nowhere"');
  });

  it("removes the labels of its page when it leaves the document", async () => {
    const { page, layer, release } = await setup();
    release();
    await until(page, () => marks(layer).length === 1);
    const key = annotationPageKey(layer);

    layer.remove();
    await page.waitForChanges();

    expect(getStores(page.body).annotationsUnplaced.state[key]).toBeUndefined();
  });

  it("places a mark on the chart in one cell of a grid, and watches what can move that chart", async () => {
    const page = await newSpecPage({
      components: [AnnotationLayer],
      html: `<bn-layout-page>
        <div slot="slot-0"><bn-grid>
          <div slot="0-0"><bn-chart-time></bn-chart-time></div>
          <div slot="0-1" data-bino-annotation-target="panel"><bn-chart-time id="second"></bn-chart-time></div>
        </bn-grid></div>
        <bn-annotation-layer slot="annotations"></bn-annotation-layer>
      </bn-layout-page>`,
    });
    const layer = page.body.querySelector("bn-annotation-layer") as HTMLElement;
    const grid = page.body.querySelector("bn-grid") as HTMLElement;
    const root = grid.attachShadow({ mode: "open" });
    const asked: string[] = [];
    page.body.querySelectorAll("bn-chart-time").forEach((chart: any) => {
      chart.getLayoutState = async () => {
        asked.push(chart.id);
        return { elements: [BAR] };
      };
    });
    (layer.shadowRoot!.querySelector("svg") as any).getScreenCTM = () => null;
    watched.length = 0;
    (layer as any).items = JSON.stringify([{ label: "1", target: "panel", point: BAR.point }]);

    await until(page, () => marks(layer).length === 1);
    expect(asked).toEqual(["second"]);
    const styleOf = (target: Node) =>
      watched.some((entry) => entry.target === target && entry.options.attributeFilter?.includes("style"));
    // the grid moves a cell in its shadow root, or through the style of a card in the cell
    expect(styleOf(root)).toBe(true);
    expect(styleOf(grid)).toBe(true);
    expect(styleOf(page.body.querySelector("[data-bino-annotation-target]")!)).toBe(true);
    expect(styleOf(page.body.querySelector("bn-layout-page")!)).toBe(false);
  });

  it("reports items that are not a JSON array", async () => {
    const { page, layer } = await setup();
    (layer as any).items = "not json";
    await page.waitForChanges();

    expect(JSON.parse(layer.getAttribute("has-error")!)[0].id).toBe("ERR_items");
  });

  it("writes the name of an item to data-bino-annotation on its mark", async () => {
    const { page, layer, release } = await setup([
      { ...ITEMS[0], name: "plan_2024" },
      { ...ITEMS[0], label: "4" },
    ]);
    release();

    await until(page, () => marks(layer).length === 2);
    const drawn = Array.from(layer.shadowRoot!.querySelectorAll(".mark"));
    expect(drawn[0].getAttribute("data-bino-annotation")).toBe("plan_2024");
    // an item without a name draws as before
    expect(drawn[1].hasAttribute("data-bino-annotation")).toBe(false);
  });

  describe("names and clicks on each kind of mark", () => {
    const badge = { cx: 5, cy: 5, r: 4, label: "1" };
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const KINDS = [
      { kind: "marker", badge },
      { kind: "frame", x: 0, y: 0, width: 10, height: 10, rx: 2, ry: 2, badge },
      { kind: "difference", lines: [], bar: box, text: { x: 0, y: 0, anchor: "start", value: "+1" }, badge },
      { kind: "pointer", shape: "0,0 1,1 2,0", badge },
      { kind: "bracket", path: "0,0 1,1", badge },
      { kind: "arrow", x1: 0, y1: 0, x2: 20, y2: 20, head: "20,20 18,16 16,18", badge },
    ];

    /** A layer on its own, with the given marks drawn as if they had been placed. */
    const drawn = async (interactive: boolean) => {
      const page = await newSpecPage({
        components: [AnnotationLayer],
        html: `<bn-annotation-layer${interactive ? " interactive" : ""}></bn-annotation-layer>`,
      });
      // let the first placement (nothing to place) finish, then draw the test marks
      await new Promise((resolve) => setTimeout(resolve, 50));
      page.rootInstance.marks = KINDS.map((mark) => ({ ...mark, name: `note_${mark.kind}` }));
      await page.waitForChanges();
      return page.root as HTMLElement;
    };

    it("puts the name on every kind of mark", async () => {
      const layer = await drawn(false);
      for (const { kind } of KINDS) {
        const mark = layer.shadowRoot!.querySelector(`.mark.${kind}`);
        expect(mark?.getAttribute("data-bino-annotation")).toBe(`note_${kind}`);
      }
    });

    it("is not interactive by default and has no hit path on the arrow", async () => {
      const layer = await drawn(false);
      expect(layer.hasAttribute("interactive")).toBe(false);
      expect(layer.shadowRoot!.querySelector(".arrow .hit")).toBeNull();
    });

    it("reflects interactive, and gives the arrow a wide transparent hit line", async () => {
      const layer = await drawn(true);
      expect(layer.hasAttribute("interactive")).toBe(true);
      const hit = layer.shadowRoot!.querySelector(".arrow .hit") as SVGElement;
      expect(hit).not.toBeNull();
      expect(hit.getAttribute("x1")).toBe("0");
      expect(hit.getAttribute("x2")).toBe("20");
      expect(hit.style.stroke).toBe("transparent");
      expect(Number(hit.style.strokeWidth)).toBeGreaterThan(1.5);
      // only the arrow gets one: the other marks are filled shapes or have a badge to click
      expect(layer.shadowRoot!.querySelectorAll(".hit").length).toBe(1);
    });
  });
});
