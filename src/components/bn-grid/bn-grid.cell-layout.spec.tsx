// bn-grid cell size, alignment, baseline and captions.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

let nextId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${nextId++}` }));

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

(global as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
};

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const stores = { componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }) };
  return {
    getStores: () => stores,
    getOrCreateStores: () => stores,
    clearStoresCache: () => {},
    findContextElement: () => undefined,
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { GridCellElement } from "../../utils/layoutState";
import { ComponentRegister } from "../../utils/componentRegister";
import { place } from "../../utils/testing/place";
import { Grid } from "./bn-grid";

const HEADERS = `row-headers='["North","South"]' column-headers='["AC","PY"]'`;

const renderGrid = (attrs: string, children = "") =>
  newSpecPage({ components: [Grid], html: `<bn-grid ${HEADERS} ${attrs}>${children}</bn-grid>` });

const container = (page: SpecPage) => page.root!.shadowRoot!.querySelector(".grid-container") as HTMLElement;
const cells = (page: SpecPage) => Array.from(page.root!.shadowRoot!.querySelectorAll(".grid-cell")) as HTMLElement[];
const errors = (page: SpecPage) => JSON.parse(page.root!.getAttribute("has-error") ?? "[]").map((e: any) => e.id);

const until = async (page: SpecPage, condition: () => boolean) => {
  for (let i = 0; i < 200 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await page.waitForChanges();
  }
  expect(condition()).toBe(true);
};

describe("bn-grid cell size and alignment", () => {
  it("keeps today's output by default", async () => {
    const page = await renderGrid(`chart-title="KPIs"`);

    expect(container(page).style.getPropertyValue("grid-template-rows")).toBe("auto auto auto auto");
    expect(container(page).style.getPropertyValue("grid-template-columns")).toBe("auto auto auto");
    for (const cell of cells(page)) {
      expect(cell.style.getPropertyValue("display")).toBe("");
      expect(cell.querySelector(".grid-slot, .grid-caption")).toBeNull();
      expect(Array.from(cell.children).map((child) => child.localName)).toEqual(["slot"]);
    }
    expect(page.root!.hasAttribute("has-error")).toBe(false);
  });

  it("makes data rows and columns equal, and keeps title, header and row-header tracks", async () => {
    const page = await renderGrid(`chart-title="KPIs" row-header-width="80px" cell-height="equal" cell-width="equal"`);

    expect(container(page).style.getPropertyValue("grid-template-rows")).toBe("auto auto 1fr 1fr");
    expect(container(page).style.getPropertyValue("grid-template-columns")).toBe("80px 1fr 1fr");
  });

  it("maps bottom and right to a flex column", async () => {
    const page = await renderGrid(`cell-vertical-align="bottom" cell-horizontal-align="right"`);
    const style = cells(page)[0].style;

    expect(style.getPropertyValue("display")).toBe("flex");
    expect(style.getPropertyValue("flex-direction")).toBe("column");
    expect(style.getPropertyValue("justify-content")).toBe("flex-end");
    expect(style.getPropertyValue("align-items")).toBe("flex-end");
  });

  it("maps center, and stretches for left so a chart keeps its width", async () => {
    const page = await renderGrid(`cell-vertical-align="center"`);
    const style = cells(page)[0].style;

    expect(style.getPropertyValue("justify-content")).toBe("center");
    expect(style.getPropertyValue("align-items")).toBe("stretch");
  });

  it("reports invalid values and renders the defaults", async () => {
    const page = await renderGrid(
      `cell-height="tall" cell-width="wide" cell-vertical-align="middle" cell-horizontal-align="start" cell-captions="nope"`,
    );

    expect(errors(page)).toEqual([
      "ERR_cellHeight",
      "ERR_cellWidth",
      "ERR_cellVerticalAlign",
      "ERR_cellHorizontalAlign",
      "ERR_cellCaptions",
    ]);
    expect(container(page).style.getPropertyValue("grid-template-rows")).toBe("auto auto auto");
    expect(cells(page)[0].style.getPropertyValue("display")).toBe("");
    expect(page.root!.shadowRoot!.querySelector(".grid-caption")).toBeNull();
  });
});

describe("bn-grid captions", () => {
  it("draws a caption in the named cells only", async () => {
    const page = await renderGrid(`cell-captions='{"0-0": "Berlin", "1-1": "O&apos;Hare"}'`);
    const captions = cells(page).map((cell) => cell.querySelector(".grid-caption")?.textContent ?? null);

    expect(captions).toEqual(["Berlin", null, null, "O'Hare"]);
  });

  it("keeps the caption at the top when the content moves down", async () => {
    const page = await renderGrid(`cell-vertical-align="bottom" cell-captions='{"0-0": "Berlin"}'`);
    const [caption, wrapper] = Array.from(cells(page)[0].children) as HTMLElement[];

    expect(caption.className).toBe("grid-caption");
    expect(caption.style.getPropertyValue("align-self")).toBe("flex-start");
    expect(wrapper.className).toBe("grid-slot");
    expect(wrapper.style.getPropertyValue("margin-top")).toBe("auto");
    expect(wrapper.querySelector("slot")!.getAttribute("name")).toBe("0-0");
  });

  it("lists the captions in the full layout state", async () => {
    const page = await renderGrid(`cell-captions='{"0-1": "Cologne"}'`);
    const state = await page.rootInstance.getLayoutState({ detail: "full" });
    const captions = (state.elements as GridCellElement[]).filter((e) => e.kind === "gridCaption");

    expect(captions.map((c) => [c.slot, c.label])).toEqual([["0-1", "Cologne"]]);
  });
});

/**
 * A stand-in chart in a slot. Its box moves with the padding of its cell's
 * wrapper, as a laid-out chart would.
 */
const chart = (page: SpecPage, slot: string, box: { left: number; top: number; width: number; height: number }) => {
  const el = page.root!.querySelector(`[slot="${slot}"] > *`) as any;
  const pad = (side: "top" | "left") => {
    const wrapper = page.root!.shadowRoot!.querySelector(`.grid-slot[data-slot="${slot}"]`) as HTMLElement | null;
    return parseFloat(wrapper?.style.getPropertyValue(`padding-${side}`) || "0");
  };
  el.getBoundingClientRect = () => {
    const left = box.left + pad("left");
    const top = box.top + pad("top");
    return { ...box, left, top, x: left, y: top, right: left + box.width, bottom: top + box.height };
  };
  return el;
};

const CHILDREN = ["0-0", "0-1", "1-0", "1-1"]
  .map((slot) => `<div slot="${slot}"><bn-chart-time></bn-chart-time></div>`)
  .join("");

const padding = (page: SpecPage, slot: string) => {
  const wrapper = page.root!.shadowRoot!.querySelector(`.grid-slot[data-slot="${slot}"]`) as HTMLElement;
  return {
    top: wrapper.style.getPropertyValue("padding-top"),
    left: wrapper.style.getPropertyValue("padding-left"),
    marginTop: wrapper.style.getPropertyValue("margin-top"),
  };
};

describe("bn-grid baseline", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("lines up the axes of a row, also when a chart has negative values", async () => {
    const page = await renderGrid(`cell-vertical-align="baseline"`, CHILDREN);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    // a short chart with the axis at its bottom, and a tall one whose axis is higher up (negative values)
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 150 }).getBaseline = async () => ({ y: 140 });
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 260 }).getBaseline = async () => ({ y: 180 });
    chart(page, "1-0", { left: 0, top: 300, width: 300, height: 200 }).getBaseline = async () => ({ y: 190 });
    chart(page, "1-1", { left: 400, top: 300, width: 300, height: 200 }).getBaseline = async () => ({ y: 190 });

    await until(page, () => padding(page, "0-0").top === "40px");
    expect(padding(page, "0-1").top).toBe("");
    expect(padding(page, "1-0").top).toBe("");
    expect(padding(page, "1-1").top).toBe("");
  });

  it("lines up the vertical axes of a column", async () => {
    const page = await renderGrid(`cell-horizontal-align="baseline"`, CHILDREN);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 200 }).getBaseline = async () => ({ x: 90 });
    chart(page, "1-0", { left: 0, top: 300, width: 300, height: 200 }).getBaseline = async () => ({ x: 60 });
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 200 }).getBaseline = async () => ({ x: 20 });
    chart(page, "1-1", { left: 400, top: 300, width: 300, height: 200 }).getBaseline = async () => ({ x: 20 });

    await until(page, () => padding(page, "1-0").left === "30px");
    expect(padding(page, "0-0").left).toBe("");
    expect(padding(page, "0-1").left).toBe("");
  });

  it("sends a component without a baseline to the bottom", async () => {
    const children = `<div slot="0-0"><bn-chart-time></bn-chart-time></div><div slot="0-1"><bn-text></bn-text></div>`;
    const page = await renderGrid(`cell-vertical-align="baseline"`, children);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 150 }).getBaseline = async () => ({ y: 140 });
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 40 });
    (page.rootInstance as any).schedule();

    await until(page, () => padding(page, "0-1").marginTop === "auto");
    expect(padding(page, "0-0").top).toBe("");
  });

  it("holds the register until the baselines are aligned", async () => {
    const page = await renderGrid(`cell-vertical-align="baseline"`, CHILDREN);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 150 }).getBaseline = async () => {
      await pending;
      return { y: 140 };
    };
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 260 }).getBaseline = async () => ({ y: 180 });

    (page.rootInstance as any).schedule();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await page.waitForChanges();
    expect(ComponentRegister.componentRegisterStatus().running).toBeGreaterThan(0);

    release();
    await until(page, () => padding(page, "0-0").top === "40px");
    await until(page, () => ComponentRegister.componentRegisterStatus().running === 0);
  });

  it("aligns again after a child redraws", async () => {
    const page = await renderGrid(`cell-vertical-align="baseline"`, CHILDREN);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 150 }).getBaseline = async () => ({ y: 140 });
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 260 }).getBaseline = async () => ({ y: 180 });
    await until(page, () => padding(page, "0-0").top === "40px");

    // the tall chart draws again with its axis lower down
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 260 }).getBaseline = async () => ({ y: 230 });
    (page.rootInstance as any).schedule();

    await until(page, () => padding(page, "0-0").top === "90px");
  });

  it("stops and warns when a baseline runs away from its offset", async () => {
    const page = await renderGrid(`cell-vertical-align="baseline"`, CHILDREN);
    place(page.root, { left: 0, top: 0, width: 800, height: 600 });
    // a component that does not move with its padding: every pass would pad it further
    const stuck = page.root!.querySelector(`[slot="0-0"] > *`) as any;
    place(stuck, { left: 0, top: 0, width: 300, height: 150 });
    let y = 140;
    stuck.getBaseline = async () => ({ y: (y -= 10) });
    chart(page, "0-1", { left: 400, top: 0, width: 300, height: 260 }).getBaseline = async () => ({ y: 180 });
    (page.rootInstance as any).schedule();

    await until(page, () => (console.warn as jest.Mock).mock.calls.length > 0);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain("did not settle");
    await until(page, () => ComponentRegister.componentRegisterStatus().running === 0);
  });

  it("does nothing without baseline alignment", async () => {
    const page = await renderGrid(`cell-vertical-align="bottom"`, CHILDREN);
    const getBaseline = jest.fn(async () => ({ y: 10 }));
    chart(page, "0-0", { left: 0, top: 0, width: 300, height: 150 }).getBaseline = getBaseline;

    await new Promise((resolve) => setTimeout(resolve, 60));
    await page.waitForChanges();
    expect(getBaseline).not.toHaveBeenCalled();
    expect(page.root!.shadowRoot!.querySelector(".grid-slot")).toBeNull();
  });
});
