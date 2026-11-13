// bn-grid cell span and cell background.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

let nextId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${nextId++}` }));

const observers: { callback: () => void; options: MutationObserverInit[] }[] = [];

(global as any).MutationObserver = class {
  private entry: { callback: () => void; options: MutationObserverInit[] };
  constructor(callback: () => void) {
    this.entry = { callback, options: [] };
    observers.push(this.entry);
  }
  observe(_target: Node, options: MutationObserverInit) {
    this.entry.options.push(options);
  }
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
  const stores = {
    componentStyles: createStore({
      _system: SYSTEM_STYLE_DEFAULTS,
      grey: { "bn-grid": { cellBackground: "#f2f2f2" } },
    }),
  };
  return {
    getStores: () => stores,
    getOrCreateStores: () => stores,
    clearStoresCache: () => {},
    findContextElement: () => undefined,
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { GridCellElement } from "../../utils/layoutState";
import { place } from "../../utils/testing/place";
import { Grid } from "./bn-grid";

const HEADERS = `row-headers='["North","South","West"]' column-headers='["AC","PY","PL"]'`;

const renderGrid = (attrs: string, children = "") =>
  newSpecPage({ components: [Grid], html: `<bn-grid ${HEADERS} ${attrs}>${children}</bn-grid>` });

const cells = (page: SpecPage) => Array.from(page.root!.shadowRoot!.querySelectorAll(".grid-cell")) as HTMLElement[];
const cellOf = (page: SpecPage, slot: string) =>
  cells(page).find((cell) => cell.querySelector("slot")!.getAttribute("name") === slot);
const style = (page: SpecPage, slot: string, property: string) => cellOf(page, slot)!.style.getPropertyValue(property);
const reports = (page: SpecPage) => JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as { id: string }[];
const wrapperOf = (page: SpecPage, slot: string) => cellOf(page, slot)!.querySelector(".grid-slot") as HTMLElement;

const until = async (page: SpecPage, condition: () => boolean) => {
  for (let i = 0; i < 800 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await page.waitForChanges();
  }
  expect(condition()).toBe(true);
};

describe("bn-grid cell span", () => {
  it("keeps today's cells without a span", async () => {
    const plain = cells(await renderGrid("")).map((cell) => cell.getAttribute("style"));
    const page = await renderGrid("", `<div slot="0-0"></div><div slot="1-1" row-span="1" column-span=""></div>`);

    expect(cells(page)).toHaveLength(9);
    expect(cells(page).map((cell) => cell.getAttribute("style"))).toEqual(plain);
    expect(style(page, "1-1", "grid-column")).toBe("3");
    expect(style(page, "1-1", "grid-row")).toBe("3");
    expect(style(page, "1-1", "background-color")).toBe("");
    expect(page.root!.hasAttribute("has-error")).toBe(false);
  });

  it("lets a cell take the positions right of it and below it, and the other cells keep their place", async () => {
    const page = await renderGrid(`chart-title="KPIs"`, `<div slot="0-1" row-span="2" column-span="2"></div>`);

    // title and column headers are rows 1 and 2, the row headers are column 1
    expect(style(page, "0-1", "grid-column")).toBe("3 / span 2");
    expect(style(page, "0-1", "grid-row")).toBe("3 / span 2");
    expect(cells(page).map((cell) => cell.querySelector("slot")!.getAttribute("name"))).toEqual([
      "0-0",
      "0-1",
      "1-0",
      "2-0",
      "2-1",
      "2-2",
    ]);
    expect(style(page, "2-1", "grid-column")).toBe("3");
    expect(style(page, "2-1", "grid-row")).toBe("5");
  });

  it("draws the lines at the edges of a spanned cell and none through it", async () => {
    const page = await renderGrid("", `<div slot="1-0" column-span="2"></div>`);
    const line = "1px solid #A6A6A6";

    // one cell over two columns: a line above it, none inside
    expect(style(page, "1-0", "border-top")).toBe(line);
    expect(style(page, "1-0", "border-left")).toBe("none");
    expect(cellOf(page, "1-1")).toBeUndefined();
    // the cells right of it and below it draw the lines at its other edges
    expect(style(page, "1-2", "border-left")).toBe(line);
    expect(style(page, "2-0", "border-top")).toBe(line);
    expect(style(page, "2-1", "border-top")).toBe(line);
  });

  it("keeps caption, alignment, equal rows and the content mark in a spanned cell", async () => {
    const page = await renderGrid(
      `cell-height="equal" cell-vertical-align="bottom" cell-captions='{"0-0": "Berlin"}'`,
      `<div slot="0-0" row-span="2"></div>`,
    );
    const cell = cellOf(page, "0-0")!;

    expect(cell.querySelector(".grid-caption")!.textContent).toBe("Berlin");
    expect(cell.style.getPropertyValue("justify-content")).toBe("flex-end");
    expect(cell.hasAttribute("data-bn-fit-content")).toBe(true);
    const container = page.root!.shadowRoot!.querySelector(".grid-container") as HTMLElement;
    expect(container.style.getPropertyValue("grid-template-rows")).toBe("auto 1fr 1fr 1fr");
  });

  it("ends a span at the edge of the grid", async () => {
    const page = await renderGrid("", `<div slot="2-2" row-span="3" column-span="3"></div>`);

    expect(cells(page)).toHaveLength(9);
    expect(style(page, "2-2", "grid-column")).toBe("4");
    expect(style(page, "2-2", "grid-row")).toBe("4");
  });

  it("reports a span that is not a whole number from 1", async () => {
    const page = await renderGrid("", `<div slot="0-0" row-span="0" column-span="two"></div>`);

    expect(cells(page)).toHaveLength(9);
    expect(reports(page)).toEqual([
      {
        id: "ERR_cellSpan",
        type: "error",
        message: 'row-span of slot "0-0", column-span of slot "0-0": not a whole number from 1.',
      },
    ]);
  });

  it("warns about a child in a covered position", async () => {
    const page = await renderGrid("", `<div slot="0-0" column-span="2"></div><div slot="0-1"></div>`);

    expect(reports(page)).toEqual([
      {
        id: "WARN_cellSpan",
        type: "warning",
        message: 'a span covers the slot "0-1" (covered by "0-0"): its content is not shown.',
      },
    ]);
  });

  it("follows a span that changes later", async () => {
    const page = await renderGrid("", `<div slot="0-0"></div>`);
    const options = observers[observers.length - 1].options[0];
    expect(options.attributeFilter).toEqual(["slot", "row-span", "column-span", "cell-background"]);

    page.root!.firstElementChild!.setAttribute("row-span", "3");
    observers[observers.length - 1].callback();
    await page.waitForChanges();

    expect(style(page, "0-0", "grid-row")).toBe("2 / span 3");
    expect(cells(page)).toHaveLength(7);
  });

  it("lists the span in the full layout state, and each cell with its own row and column", async () => {
    const page = await renderGrid("", `<div slot="0-0" row-span="2"></div>`);
    const state = await page.rootInstance.getLayoutState({ detail: "full" });
    const listed = (state.elements as GridCellElement[]).filter((e) => e.kind === "gridCell");

    expect(state.metadata.cellCount).toBe(8);
    expect(listed[0]).toMatchObject({ slot: "0-0", rowId: "0", columnId: "0", rowSpan: 2 });
    expect(listed[0].columnSpan).toBeUndefined();
    // row 1 starts in column 1: its first position is covered
    expect(listed[3]).toMatchObject({ slot: "1-1", rowId: "1", columnId: "1" });
    expect(listed[3].rowSpan).toBeUndefined();
  });

  it("leaves a cell over two rows out of the baseline of the rows", async () => {
    const children =
      `<div slot="0-0" row-span="2"><bn-chart-time></bn-chart-time></div>` +
      ["0-1", "0-2"].map((slot) => `<div slot="${slot}"><bn-chart-time></bn-chart-time></div>`).join("");
    const page = await renderGrid(`cell-vertical-align="baseline"`, children);
    place(page.root, { left: 0, top: 0, width: 900, height: 600 });
    const chart = (slot: string, left: number, y: number) => {
      const el = Array.from(page.root!.children).find((child) => child.getAttribute("slot") === slot)!
        .firstElementChild as any;
      el.getBoundingClientRect = () => {
        const top = parseFloat(wrapperOf(page, slot).style.getPropertyValue("padding-top") || "0");
        return { left, top, x: left, y: top, width: 250, height: 300, right: left + 250, bottom: top + 300 };
      };
      el.getBaseline = async () => ({ y });
    };
    // the tall chart has the lowest axis, but it is in no single row
    chart("0-0", 0, 280);
    chart("0-1", 300, 100);
    chart("0-2", 600, 150);

    await until(page, () => wrapperOf(page, "0-1").style.getPropertyValue("padding-top") === "50px");
    expect(wrapperOf(page, "0-2").style.getPropertyValue("padding-top")).toBe("");
    expect(wrapperOf(page, "0-0").style.getPropertyValue("padding-top")).toBe("");
    expect(wrapperOf(page, "0-0").style.getPropertyValue("margin-top")).toBe("");
  });
});

describe("bn-grid cell background", () => {
  it("colours the cell of a child with cell-background", async () => {
    const page = await renderGrid("", `<div slot="1-1" cell-background="#f2f2f2"></div>`);

    expect(style(page, "1-1", "background-color")).toBe("#f2f2f2");
    expect(style(page, "0-0", "background-color")).toBe("");
  });

  it("colours every cell from the style, and the child wins", async () => {
    const page = await renderGrid(
      `selected-style="grey"`,
      `<div slot="0-0" cell-background="white"></div><div slot="0-1" cell-background="transparent"></div>`,
    );

    expect(style(page, "0-0", "background-color")).toBe("white");
    expect(style(page, "0-1", "background-color")).toBe("transparent");
    expect(style(page, "2-2", "background-color")).toBe("#f2f2f2");
  });
});
