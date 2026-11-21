// The `scale` of bn-tree: the factor goes to the nodes, `auto` fits the tree
// to its parent, and parents that share a child keep their distance.
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
import { ChartTree } from "../bn-tree";

const EDGES = '[{"from":"roi","to":"ros","operator":"x"},{"from":"roi","to":"ct"}]';

const renderTree = (attrs: string, edges: string = EDGES, nodes?: string): Promise<SpecPage> =>
  newSpecPage({
    components: [ChartTree],
    html: `<bn-tree edges='${edges}' ${attrs}>${
      nodes ??
      `<div slot="roi"><bn-chart-time></bn-chart-time></div>
      <div slot="ros"><bn-chart-time scale="0.9"></bn-chart-time></div>
      <div slot="ct"><div><bn-table></bn-table></div><span>text</span></div>`
    }</bn-tree>`,
  });

const scaleOf = (page: SpecPage, slot: string): string | null =>
  page.root!.querySelector(`[slot="${slot}"] bn-chart-time, [slot="${slot}"] bn-table`)!.getAttribute("scale");

const overflowItem = (page: SpecPage): ErrorItem | undefined =>
  (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as ErrorItem[]).find((item) => item.id === "WARN_overflow");

/** mock-doc has no layout: the tree reports this size, divided by nothing. */
const sizeTree = async (page: SpecPage, size: () => { width: number; height: number }) => {
  const grid = page.root!.shadowRoot!.querySelector(".tree-grid")!;
  Object.defineProperty(grid, "scrollWidth", { get: () => size().width, configurable: true });
  Object.defineProperty(grid, "scrollHeight", { get: () => size().height, configurable: true });
  forceUpdate(page.root!);
  await page.waitForChanges();
};

const settle = async (page: SpecPage, ms = 200) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await page.waitForChanges();
};

const factor = (page: SpecPage): number => (page.rootInstance as unknown as { fitFactor: number }).fitFactor;

describe("bn-tree scale", () => {
  it("leaves the nodes alone without a scale", async () => {
    const page = await renderTree("");
    expect(scaleOf(page, "roi")).toBeNull();
    expect(scaleOf(page, "ros")).toBe("0.9");
  });

  it("hands a fixed factor to the nodes without a scale of their own", async () => {
    const page = await renderTree('scale="0.5"');
    expect(scaleOf(page, "roi")).toBe("0.5");
    expect(scaleOf(page, "ct")).toBe("0.5");
    // the node set its own
    expect(scaleOf(page, "ros")).toBe("0.9");
  });

  it("scales the spacings with the factor", async () => {
    const page = await renderTree('scale="0.5" level-spacing="60" node-spacing="20"');
    const style = page.root!.shadowRoot!.querySelector(".tree-grid")!.getAttribute("style") ?? "";
    expect(style).toContain("30px");
    expect(style).toContain("10px");
  });

  it("takes the factor back when the scale is removed", async () => {
    const page = await renderTree('scale="0.5"');
    page.root!.removeAttribute("scale");
    await page.waitForChanges();
    expect(scaleOf(page, "roi")).toBeNull();
    expect(scaleOf(page, "ros")).toBe("0.9");
  });

  it("warns about a value that is no scale", async () => {
    const page = await renderTree('scale="big"');
    const items = JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as ErrorItem[];
    expect(items.some((item) => item.id === "WARN_scale")).toBe(true);
    expect(scaleOf(page, "roi")).toBeNull();
  });
});

describe("bn-tree scale auto", () => {
  it("stays at 1 when the tree fits", async () => {
    const page = await renderTree('scale="auto"');
    await sizeTree(page, () => ({ width: 250, height: 150 }));
    await settle(page);
    expect(factor(page)).toBe(1);
    expect(scaleOf(page, "roi")).toBe("1");
  });

  it("shrinks until the tree fits, by the side that is cut most", async () => {
    const page = await renderTree('scale="auto"');
    // the parent is 300 x 200 px, the tree follows its factor
    await sizeTree(page, () => ({ width: 600 * factor(page), height: 250 * factor(page) }));
    expect(overflowItem(page)).toBeUndefined();
    await settle(page);
    await settle(page);

    expect(factor(page)).toBe(0.5);
    expect(scaleOf(page, "roi")).toBe("0.5");
    expect(scaleOf(page, "ros")).toBe("0.9");
    expect(overflowItem(page)).toBeUndefined();
  });

  it("waits until the nodes have stopped changing before it takes a step", async () => {
    const page = await renderTree('scale="auto"');
    await sizeTree(page, () => ({ width: 600, height: 100 }));
    // measured again and again within the wait: still no step
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      forceUpdate(page.root!);
      await page.waitForChanges();
    }
    expect(factor(page)).toBe(1);
  });

  it("solves for the part of the tree that does not follow the factor", async () => {
    const page = await renderTree('scale="auto"');
    // 100 px of the width stay, 500 px follow the factor: 300 = 100 + 500 * 0.4
    await sizeTree(page, () => ({ width: 100 + 500 * factor(page), height: 100 }));
    for (let i = 0; i < 4; i++) {
      await settle(page);
    }
    expect(factor(page)).toBe(0.4);
    expect(overflowItem(page)).toBeUndefined();
  });

  it("goes back to 1 and warns when no factor makes the tree fit", async () => {
    const page = await renderTree('scale="auto"');
    await sizeTree(page, () => ({ width: 600, height: 100 }));
    for (let i = 0; i < 4; i++) {
      await settle(page);
    }
    expect(factor(page)).toBe(1);
    expect(scaleOf(page, "roi")).toBe("1");
    expect(overflowItem(page)?.message).toContain("width (600px > 300px)");
  });

  it("fits anew when the tree changes", async () => {
    const page = await renderTree('scale="auto"');
    let wide = true;
    await sizeTree(page, () => ({ width: (wide ? 600 : 200) * factor(page), height: 100 }));
    await settle(page);
    await settle(page);
    expect(factor(page)).toBe(0.5);

    wide = false;
    page.root!.setAttribute("direction", "ttb");
    await page.waitForChanges();
    await settle(page);
    expect(factor(page)).toBe(1);
  });
});

describe("bn-tree in a node of a tree", () => {
  const NESTED = `<div slot="roi"><bn-chart-time></bn-chart-time></div>
    <div slot="ros"><bn-tree edges='[{"from":"a","to":"b"}]'>
      <div slot="a"><bn-chart-time id="inner"></bn-chart-time></div><div slot="b">b</div>
    </bn-tree></div>
    <div slot="ct">ct</div>`;

  it("hands the factor to the inner tree, which hands it to its nodes", async () => {
    const page = await renderTree('scale="0.5"', EDGES, NESTED);
    await page.waitForChanges();
    expect(page.root!.querySelector('[slot="ros"] > bn-tree')!.getAttribute("scale")).toBe("0.5");
    expect(page.root!.querySelector("#inner")!.getAttribute("scale")).toBe("0.5");
  });
});

describe("bn-tree parents that share a child", () => {
  const DAG =
    '[{"from":"roi","to":"ros"},{"from":"roi","to":"ct"},{"from":"ros","to":"a"},{"from":"ros","to":"b"},{"from":"ct","to":"b"},{"from":"ct","to":"c"}]';
  const NODES = ["roi", "ros", "ct", "a", "b", "c"].map((id) => `<div slot="${id}">${id}</div>`).join("");

  const shiftsFor = async (attrs: string, tops: Record<string, number>, height: number) => {
    const page = await renderTree(attrs, DAG, NODES);
    // mock-doc has no layout: each node reports this place in the grid
    page.root!.shadowRoot!.querySelectorAll<HTMLElement>(".tree-node").forEach((node) => {
      const top = tops[node.dataset.node!];
      Object.defineProperty(node, "offsetTop", { get: () => top ?? 0 });
      Object.defineProperty(node, "offsetHeight", { get: () => (top === undefined ? 0 : height) });
    });
    forceUpdate(page.root!);
    await page.waitForChanges();
    await page.waitForChanges();
    return (page.rootInstance as unknown as { nodeShifts: Map<string, number> }).nodeShifts;
  };

  it("moves two parents apart that touch", async () => {
    const shifts = await shiftsFor('node-spacing="20"', { ros: 50, ct: 150, a: 0, b: 200, c: 400 }, 100);
    expect(shifts.get("ros")).toBe(-10);
    expect(shifts.get("ct")).toBe(10);
    // the children have rows of their own
    expect(shifts.has("a")).toBe(false);
    expect(shifts.has("b")).toBe(false);
  });

  it("leaves parents alone that have the spacing", async () => {
    const shifts = await shiftsFor('node-spacing="20"', { ros: 0, ct: 130, a: 0, b: 200, c: 400 }, 100);
    expect(shifts.size).toBe(0);
  });

  it("does not move nodes of a tree from top to bottom", async () => {
    const shifts = await shiftsFor('node-spacing="20" direction="ttb"', { ros: 0, ct: 100 }, 100);
    expect(shifts.size).toBe(0);
  });
});
