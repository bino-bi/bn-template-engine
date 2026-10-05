// bn-tree draws its edges from the measured place of every node. These specs
// check that the tree measures again after every render and that it says so
// when it is larger than its parent.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

const observed: unknown[] = [];
(global as any).ResizeObserver = class {
  constructor() {}
  observe(target: unknown) {
    observed.push(target);
  }
  disconnect() {}
  unobserve() {}
};

// mock-doc has no layout: the parent is a cell of 300 x 200 px that hides its overflow.
jest.mock("../../../utils/parentDimensions", () => ({
  getParentDimensions: () => ({ width: 300, height: 200 }),
  getClippedHeight: (_element: unknown, contentHeight: number) => Math.max(0, contentHeight - 200),
}));

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
    findContextElement: () => undefined,
  };
});

import { forceUpdate } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { ErrorItem } from "../../../utils/withHasError";
import { NodeRect } from "../utils/EdgeRenderer";
import { ChartTree } from "../bn-tree";

const EDGES = '[{"from":"roi","to":"ros","operator":"x"},{"from":"roi","to":"ct"}]';

const renderTree = (edges: string): Promise<SpecPage> =>
  newSpecPage({
    components: [ChartTree],
    html: `<bn-tree edges='${edges}'>
      <div slot="roi">ROI</div>
      <div slot="ros">ROS</div>
      <div slot="ct">Capital Turnover</div>
    </bn-tree>`,
  });

const nodeRects = (page: SpecPage): Map<string, NodeRect> =>
  (page.rootInstance as unknown as { nodeRects: Map<string, NodeRect> }).nodeRects;

/** mock-doc has no layout: every node reports this left edge. */
const stubNodeLeft = (page: SpecPage, left: () => number): void => {
  page.root!.querySelectorAll("[slot]").forEach((node) => {
    (node as HTMLElement).getBoundingClientRect = () =>
      ({ left: left(), top: 0, width: 50, height: 20, right: left() + 50, bottom: 20 }) as DOMRect;
  });
};

const overflowItem = (page: SpecPage): ErrorItem | undefined =>
  (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as ErrorItem[]).find((item) => item.id === "WARN_overflow");

describe("bn-tree measurement", () => {
  it("measures the nodes after the render, without a call from outside", async () => {
    const page = await renderTree(EDGES);
    await page.waitForChanges();

    expect(Array.from(nodeRects(page).keys()).sort()).toEqual(["ct", "roi", "ros"]);
  });

  it("measures a tree that was invalid when it loaded", async () => {
    const page = await renderTree("not json");
    expect(nodeRects(page).size).toBe(0);

    page.root!.setAttribute("edges", EDGES);
    await page.waitForChanges();
    await page.waitForChanges();

    // the grid did not exist at load time, so the tree never measured and drew no edge
    expect(nodeRects(page).size).toBe(3);
    expect(page.root!.shadowRoot!.querySelectorAll("path")).toHaveLength(2);
  });

  it("measures again when the direction changes", async () => {
    let left = 10;
    const page = await renderTree(EDGES);
    stubNodeLeft(page, () => left);
    forceUpdate(page.root!);
    await page.waitForChanges();
    expect(nodeRects(page).get("ros")!.left).toBe(10);

    // the nodes move, their size stays: no resize observer would fire
    left = 400;
    page.root!.setAttribute("direction", "rtl");
    await page.waitForChanges();
    await page.waitForChanges();

    expect(nodeRects(page).get("ros")!.left).toBe(400);
  });

  it("observes every node once", async () => {
    observed.length = 0;
    const page = await renderTree(EDGES);
    forceUpdate(page.root!);
    await page.waitForChanges();

    // the grid, the three nodes and the parent of the tree
    expect(observed).toHaveLength(5);
  });
});

describe("bn-tree overflow", () => {
  const renderSized = async (width: number, height: number): Promise<SpecPage> => {
    const page = await renderTree(EDGES);
    const grid = page.root!.shadowRoot!.querySelector(".tree-grid")!;
    Object.defineProperty(grid, "scrollWidth", { get: () => width, configurable: true });
    Object.defineProperty(grid, "scrollHeight", { get: () => height, configurable: true });
    forceUpdate(page.root!);
    await page.waitForChanges();
    return page;
  };

  it("warns when the tree is wider than its parent", async () => {
    const page = await renderSized(500, 100);

    expect(overflowItem(page)?.type).toBe("warning");
    expect(overflowItem(page)?.message).toContain("width (500px > 300px)");
    expect(overflowItem(page)?.message).not.toContain("height");
  });

  it("warns when the tree is higher than its parent", async () => {
    const page = await renderSized(250, 320);

    expect(overflowItem(page)?.message).toContain("height (320px > 200px)");
  });

  it("does not warn when the tree fits", async () => {
    expect(overflowItem(await renderSized(250, 150))).toBeUndefined();
  });

  it("removes the warning when the edges become invalid", async () => {
    const page = await renderSized(500, 100);
    expect(overflowItem(page)).toBeDefined();

    page.root!.setAttribute("edges", "not json");
    await page.waitForChanges();

    // no grid is drawn any more
    expect(overflowItem(page)).toBeUndefined();
  });
});

describe("bn-tree nodes that come later", () => {
  it("measures a node that is added after the render", async () => {
    const page = await renderTree('[{"from":"roi","to":"ros"},{"from":"roi","to":"ct"},{"from":"ct","to":"capital"}]');
    await page.waitForChanges();
    expect(nodeRects(page).has("capital")).toBe(false);

    const node = page.doc.createElement("div");
    node.setAttribute("slot", "capital");
    page.root!.appendChild(node);
    page.root!.shadowRoot!.dispatchEvent(new Event("slotchange"));
    await page.waitForChanges();

    expect(nodeRects(page).has("capital")).toBe(true);
    expect(page.root!.shadowRoot!.querySelectorAll("path")).toHaveLength(3);
  });

  it("observes its layout again after it was moved in the document", async () => {
    const page = await renderTree(EDGES);
    await page.waitForChanges();
    const tree = page.root!;

    tree.remove();
    observed.length = 0;
    page.body.appendChild(tree);
    await page.waitForChanges();

    // the grid, the three nodes and the new parent of the tree
    expect(observed).toHaveLength(5);
  });
});
