// A scatter chart is as wide as its parent and its height follows from the
// aspect, so the height is what does not fit a layout cell. The host clips
// what is over (overflow: hidden) and must say so with WARN_overflow.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// keeps the callbacks, so a spec can let the parent change its size
const mockResizeCallbacks: ((entries: unknown[]) => void)[] = [];
(global as any).ResizeObserver = class {
  constructor(callback: (entries: unknown[]) => void) {
    mockResizeCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

// mock-doc has no layout: the parent is a cell of 800 x `mockParentHeight` px that hides its overflow.
let mockParentHeight = 300;
jest.mock("../../utils/parentDimensions", () => ({
  getParentDimensions: () => ({ width: 800, height: mockParentHeight }),
  getClippedHeight: (_element: unknown, contentHeight: number) => Math.max(0, contentHeight - mockParentHeight),
}));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { SYSTEM_RULESET_DEFAULTS } = require("../../stores/ruleSets");
  const { createScopedDb } = require("../../context/scopedDb");

  const db = createScopedDb();
  db.db.tables["points"] = {
    data: [
      { operation: "+", category: "A", categoryIndex: 1, subCategory: "a1", subCategoryIndex: 1, ac1: 10, ac2: 20 },
      { operation: "+", category: "A", categoryIndex: 1, subCategory: "a2", subCategoryIndex: 2, ac1: 30, ac2: 40 },
    ],
  };

  const mockStores = {
    db,
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
    scalingGroups: createStore({}),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { ErrorItem } from "../../utils/withHasError";
import { ChartScatter } from "./bn-chart-scatter";
import { IbcsChartScatter } from "./ibcs-chart-scatter";

const renderScatter = async (parentHeight: number, attrs: string): Promise<SpecPage> => {
  mockParentHeight = parentHeight;
  const page = await newSpecPage({
    components: [ChartScatter, IbcsChartScatter],
    html: `<bn-chart-scatter datasets="points" x="ac1" y="ac2" ${attrs}></bn-chart-scatter>`,
  });
  await page.waitForChanges();
  return page;
};

const overflowItem = (page: SpecPage): ErrorItem | undefined =>
  (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as ErrorItem[]).find((item) => item.id === "WARN_overflow");

/** Height of the chart the inner element drew. */
const chartHeight = (page: SpecPage): number =>
  Number(
    page
      .root!.shadowRoot!.querySelector("ibcs-chart-scatter")!
      .shadowRoot!.querySelector("svg#drawCanvas")!
      .getAttribute("height"),
  );

describe.each(["none", "auto"])("bn-chart-scatter height overflow with scale=%s", (scale) => {
  it("warns when the chart is higher than its parent", async () => {
    // with an aspect of 1 the plot is as high as it is wide, more than the 300 px of the cell
    const page = await renderScatter(300, `scale="${scale}" aspect="1"`);

    expect(chartHeight(page)).toBeGreaterThan(300);
    expect(overflowItem(page)?.type).toBe("warning");
    expect(overflowItem(page)?.message).toContain("height");
    expect(overflowItem(page)?.message).toContain("> 300px");
  });

  it("does not warn when the chart fits", async () => {
    const page = await renderScatter(2000, `scale="${scale}" aspect="1"`);

    expect(chartHeight(page)).toBeLessThan(2000);
    expect(overflowItem(page)).toBeUndefined();
  });
});

describe("bn-chart-scatter height overflow after the render", () => {
  it("checks again when only the height of the parent changes", async () => {
    mockResizeCallbacks.length = 0;
    const page = await renderScatter(2000, `scale="none" aspect="1"`);
    expect(overflowItem(page)).toBeUndefined();

    // the chart saw this width already, so the change below is one of the height alone
    (page.rootInstance as unknown as { _lastObservedWidth: number })._lastObservedWidth = 800;
    mockParentHeight = 300;
    for (const callback of mockResizeCallbacks) {
      callback([{ contentBoxSize: [{ inlineSize: 800, blockSize: 300 }] }]);
    }
    // the observer waits 80 ms before it reports
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(overflowItem(page)?.message).toContain("> 300px");
  });
});
