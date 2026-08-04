// bn-tree.getLayoutState: structure assertions (mock-doc zero rects — no
// geometry numbers). Node rects are refreshed manually because mock-doc does
// not run the requestAnimationFrame measurement pass.
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

(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

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

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { EdgeElement, NodeElement } from "../../../utils/layoutState";
import { ChartTree } from "../bn-tree";

const renderTree = async () => {
  const page = await newSpecPage({
    components: [ChartTree],
    template: () => (
      <bn-tree edges='[{"from":"roi","to":"ros","operator":"x"},{"from":"roi","to":"ct"}]'>
        <div slot="roi">ROI</div>
        <div slot="ros">ROS</div>
        <div slot="ct">Capital Turnover</div>
      </bn-tree>
    ),
  });
  return page;
};

describe("bn-tree.getLayoutState", () => {
  it("reports the grid region and node/edge counts", async () => {
    const page = await renderTree();
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-tree");
    expect(state.regions.map((r) => r.id)).toEqual(["grid"]);
    expect(state.metadata.nodeCount).toBe(3);
    expect(state.metadata.edgeCount).toBe(2);
    expect(state.elements).toBeUndefined();
  });

  it("lists nodes, edges and operators at full detail", async () => {
    const page = await renderTree();
    // mock-doc never fires the rAF measurement pass — run it by hand.
    (page.rootInstance as any).updateNodeRects();
    await page.waitForChanges();

    const state = await page.rootInstance.getLayoutState({ detail: "full" });

    const nodes = state.elements.filter((e) => e.kind === "node") as NodeElement[];
    expect(nodes.map((n) => n.nodeId).sort()).toEqual(["ct", "roi", "ros"]);

    const edges = state.elements.filter((e) => e.kind === "edge") as EdgeElement[];
    expect(edges.map((e) => `${e.from}->${e.to}`)).toEqual(["roi->ros", "roi->ct"]);
    expect(edges[0].operator).toBe("x");
    expect(edges.every((e) => typeof e.path === "string" && e.path.length > 0)).toBe(true);

    const operators = state.elements.filter((e) => e.kind === "label");
    expect(operators.map((o: any) => o.text)).toEqual(["×"]);
  });
});
