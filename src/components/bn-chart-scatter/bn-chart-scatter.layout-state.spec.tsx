// bn-chart-scatter.getLayoutState (representative for bubble/bullet - all
// three share collectXYFacadeState). XY marks carry no ids, so elements are
// tag-classified; geometry numbers are not asserted (mock-doc zero rects).
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

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

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { SYSTEM_RULESET_DEFAULTS } = require("../../stores/ruleSets");
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
    scalingGroups: createStore({}),
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

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { ChartScatter } from "./bn-chart-scatter";
import { place } from "../../utils/testing/place";

const renderChart = async (attrs: string): Promise<SpecPage> => {
  const page = await newSpecPage({
    components: [ChartScatter],
    html: `<bn-chart-scatter x="ac1" y="ac2" scale="none" ${attrs}></bn-chart-scatter>`,
  });
  const inner = page.root!.shadowRoot!.querySelector("bn-chart-scatter-renderer");
  const shadow = inner.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <div>
      <svg id="drawCanvas" width="400" height="300">
        <g><circle></circle><circle></circle><circle></circle></g>
        <g><text>Alpha</text><text>Beta</text></g>
      </svg>
    </div>`;
  return page;
};

describe("bn-chart-scatter.getLayoutState", () => {
  it("reports the canvas region and point count", async () => {
    const page = await renderChart(`chart-title="Margin vs Volume"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-chart-scatter");
    expect(state.regions.map((r) => r.id)).toEqual(["canvas"]);
    expect(state.metadata.title).toBe("Margin vs Volume");
    expect(state.metadata.pointCount).toBe(3);
    expect(state.elements).toBeUndefined();
  });

  it("lists tag-classified points and labels at full detail", async () => {
    const page = await renderChart("");
    const state = await page.rootInstance.getLayoutState({ detail: "full" });

    const points = state.elements.filter((e) => e.kind === "point");
    expect(points.map((p: any) => p.index)).toEqual([0, 1, 2]);
    const labels = state.elements.filter((e) => e.kind === "label");
    expect(labels.map((l: any) => l.text)).toEqual(["Alpha", "Beta"]);
  });
});

describe("bn-chart-scatter.getBaseline", () => {
  it("reports the bottom and the left edge of the first plot frame", async () => {
    const page = await renderChart("");
    place(page.root, { left: 10, top: 20, width: 400, height: 300 });
    const svg = page.root!.shadowRoot!.querySelector("bn-chart-scatter-renderer")!.shadowRoot!.querySelector("svg")!;
    svg.insertAdjacentHTML("beforeend", '<rect data-bn-baseline="frame"></rect><rect data-bn-baseline="frame"></rect>');
    const [first, second] = Array.from(svg.querySelectorAll("rect"));
    place(first, { left: 60, top: 40, width: 150, height: 200 });
    place(second, { left: 230, top: 40, width: 150, height: 200 });

    const baseline = await page.rootInstance.getBaseline();
    expect(baseline).toEqual({ x: 50, y: 220 });
    expect((await page.rootInstance.getLayoutState()).baseline).toEqual(baseline);
  });

  it("is empty before the chart has drawn its frame", async () => {
    const page = await renderChart("");
    expect(await page.rootInstance.getBaseline()).toEqual({});
  });
});
