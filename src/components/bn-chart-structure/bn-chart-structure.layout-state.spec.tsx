// bn-chart-structure.getLayoutState: structure-level assertions only (twin of
// the bn-chart-time layout-state spec — the walker is shared, so this spec
// covers the structure facade's wiring, not the walker again).
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
import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { BarElement } from "../../utils/layoutState";
import { Chart } from "./bn-chart-structure";

const BASE_FONT = SYSTEM_STYLE_DEFAULTS.global.fontSizePx;

const SEGMENT_SVG = `
  <div>
    <svg id="drawCanvas" width="200" height="400">
      <g id="Scenarios">
        <g id="Scenario1">
          <g id="0"><g id="0_RECT"><rect></rect></g></g>
          <g id="1"><g id="1_RECT"><rect></rect></g></g>
          <g id="2"><g id="2_RECT"><rect></rect></g></g>
        </g>
      </g>
      <g id="AxisAndDateLables">
        <g id="axis"><line class="axis-pl"></line></g>
        <text>Products</text>
      </g>
    </svg>
  </div>`;

const renderChart = async (attrs: string): Promise<SpecPage> => {
  const page = await newSpecPage({
    components: [Chart],
    html: `<bn-chart-structure scenarios="ac1" variances="" scale="none" ${attrs}></bn-chart-structure>`,
  });
  page.root!.shadowRoot!.querySelectorAll("ibcs-chart-structure").forEach((inner) => {
    const shadow = inner.attachShadow({ mode: "open" });
    shadow.innerHTML = SEGMENT_SVG;
  });
  return page;
};

describe("bn-chart-structure.getLayoutState", () => {
  it("reports the base canvas region and bar count", async () => {
    const page = await renderChart(`chart-title="By Product"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-chart-structure");
    expect(state.regions.map((r) => r.id)).toEqual(["canvas:base"]);
    expect(state.metadata.title).toBe("By Product");
    expect(state.metadata.barCount).toBe(3);
    expect(state.metadata.hasNoData).toBe(false);
    expect(state.em.fontSizePx).toBeCloseTo(BASE_FONT);
  });

  it("lists bars and axis at full detail with fixed scaling", async () => {
    const page = await renderChart(`unit-scaling="1M"`);
    const state = await page.rootInstance.getLayoutState({ detail: "full" });

    const bars = state.elements.filter((e) => e.kind === "bar") as BarElement[];
    expect(bars.map((b) => b.index)).toEqual([0, 1, 2]);

    const axes = state.elements.filter((e) => e.kind === "axis");
    expect(axes).toHaveLength(1);
    expect(axes[0].style).toBe("pl");

    expect(state.scaling.unitMode).toBe("fixed");
    expect(state.scaling.unitsPerEm).toBe(1000000);
    expect(state.scaling.unitPxPerUnit).toBeCloseTo(BASE_FONT / 1000000, 12);
  });
});
