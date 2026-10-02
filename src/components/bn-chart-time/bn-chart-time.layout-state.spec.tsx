// bn-chart-time.getLayoutState: structure and model-derived values only -
// mock-doc returns zeroed rects, so geometry numbers are not asserted here.
// The inner ibcs-chart-time stays unregistered (its SVG engine needs getBBox);
// a hand-built shadow root with the real id conventions stands in for it.
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
import { AutoScalingReport } from "../../utils/scaling";
import { BarElement, LabelElement } from "../../utils/layoutState";
import { Chart } from "./bn-chart-time";
import { IbcsChartTime } from "./ibcs-chart-time";
import { getStores } from "../../context/context-protocol";
import { resolveHostFont } from "../../utils/testing/hostFont";
import { join } from "path";

const BASE_FONT = SYSTEM_STYLE_DEFAULTS.global.fontSizePx;

const SEGMENT_SVG = `
  <div>
    <svg id="drawCanvas" width="400" height="200">
      <g id="Scenarios">
        <g id="Scenario1">
          <g id="0"><g id="0_RECT"><rect></rect></g></g>
          <g id="1"><g id="1_RECT"><rect></rect></g></g>
        </g>
        <g id="label">
          <g id="0"><g id="0_DATA_Label"><text>120</text></g></g>
          <g id="1"><g id="1_DATA_Label"><text>140</text></g><g id="1_SCENARIO_Label"><text>AC</text></g></g>
        </g>
      </g>
      <g id="AxisAndDateLables">
        <g id="axis"><text class="categories">2024 AC</text><line class="axis-ac"></line></g>
        <text>Jan</text>
        <text>Feb</text>
      </g>
    </svg>
  </div>
  <div class="footer">in mEUR</div>`;

const renderChart = async (attrs: string): Promise<SpecPage> => {
  const page = await newSpecPage({
    components: [Chart],
    html: `<bn-chart-time scenarios="ac1" variances="dac1_pp1_pos" scale="none" ${attrs}></bn-chart-time>`,
  });
  page.root!.shadowRoot!.querySelectorAll("ibcs-chart-time").forEach((inner) => {
    const shadow = inner.attachShadow({ mode: "open" });
    shadow.innerHTML = SEGMENT_SVG;
  });
  return page;
};

describe("bn-chart-time.getLayoutState", () => {
  it("reports one canvas region per segment and chart metadata", async () => {
    const page = await renderChart(`chart-title="Revenue"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-chart-time");
    expect(state.regions.map((r) => r.id)).toEqual(["canvas:base", "canvas:dac1_pp1_pos"]);
    expect(state.metadata.title).toBe("Revenue");
    expect(state.metadata.scenarios).toEqual(["ac1"]);
    expect(state.metadata.variances).toEqual(["dac1_pp1_pos"]);
    expect(state.metadata.barCount).toBe(2);
    expect(state.metadata.hasNoData).toBe(false);
    expect(state.em.fontSizePx).toBeCloseTo(BASE_FONT);
    expect(state.elements).toBeUndefined();
  });

  it("lists bars, labels, axis and footer per segment at full detail", async () => {
    const page = await renderChart("");
    const state = await page.rootInstance.getLayoutState({ detail: "full" });

    const bars = state.elements.filter((e) => e.kind === "bar") as BarElement[];
    expect(bars).toHaveLength(4); // 2 bars × 2 segments
    expect(bars.filter((b) => b.segment === "base").map((b) => b.index)).toEqual([0, 1]);
    expect(bars.every((b) => b.scenario === "scenario1")).toBe(true);
    expect(bars[0].id).toBe("0_RECT");

    const labels = state.elements.filter((e) => e.kind === "label") as LabelElement[];
    const baseLabels = labels.filter((l) => l.segment === "base");
    expect(baseLabels.filter((l) => l.role === "data").map((l) => l.text)).toEqual(["120", "140"]);
    expect(baseLabels.filter((l) => l.role === "scenario").map((l) => l.text)).toEqual(["AC"]);
    expect(baseLabels.filter((l) => l.role === "category").map((l) => l.text)).toEqual(["Jan", "Feb"]);
    expect(baseLabels.filter((l) => l.role === "title").map((l) => l.text)).toEqual(["2024 AC"]);
    expect(baseLabels.filter((l) => l.role === "footer").map((l) => l.text)).toEqual(["in mEUR"]);

    const axes = state.elements.filter((e) => e.kind === "axis");
    expect(axes).toHaveLength(2); // one per segment
    expect(axes[0].style).toBe("ac");
  });

  it("reports fixed scaling resolved from the attributes", async () => {
    const page = await renderChart(`unit-scaling="250k" percentage-scaling="5"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.scaling.unitMode).toBe("fixed");
    expect(state.scaling.unitsPerEm).toBe(250000);
    expect(state.scaling.unitPxPerUnit).toBeCloseTo(BASE_FONT / 250000, 12);
    expect(state.scaling.percentageMode).toBe("fixed");
    expect(state.scaling.percentagePointsPerEm).toBe(5);
    expect(state.scaling.percentagePxPerPoint).toBeCloseTo(BASE_FONT / 5, 12);
  });

  it("reports auto scaling from the last inner auto-fit report", async () => {
    const page = await renderChart(`unit-scaling="auto"`);
    const inner = page.root!.shadowRoot!.querySelector("ibcs-chart-time") as HTMLElement & {
      reportAutoScaling: (report: AutoScalingReport) => void;
    };
    inner.reportAutoScaling({ unit: 2 });

    const state = await page.rootInstance.getLayoutState();
    expect(state.scaling.unitMode).toBe("auto");
    expect(state.scaling.unitPxPerUnit).toBe(2);
    expect(state.scaling.unitsPerEm).toBeCloseTo(BASE_FONT / 2, 12);
  });

  // The real inner is registered here. Fixed scaling skips the inner's
  // auto-fit, which draws the SVG and needs getBBox (missing in mock-doc).
  it("reports no data when every segment renders the empty state", async () => {
    const page = await newSpecPage({
      components: [Chart, IbcsChartTime],
      html: `<bn-chart-time scenarios="ac1" variances="dac1_pp1_pos" scale="none" unit-scaling="100" percentage-scaling="2"></bn-chart-time>`,
    });
    const state = await page.rootInstance.getLayoutState();

    expect(state.regions).toEqual([]);
    expect(state.metadata.barCount).toBe(0);
    expect(state.metadata.hasNoData).toBe(true);
    const inners = Array.from(page.root!.shadowRoot!.querySelectorAll("ibcs-chart-time"));
    expect(inners).toHaveLength(2);
    expect(inners.every((inner) => inner.classList.contains("no-data"))).toBe(true);
    expect(page.root!.classList.contains("no-data")).toBe(true);
  });
});

// Standalone (no bn-page / bn-layout-page ancestor) the host has nothing to
// inherit the theme font from, so its own :host rule must consume the custom
// properties the render writes. mock-doc has no CSS cascade, so the rule is
// resolved against those properties instead of read via getComputedStyle.
describe("bn-chart-time host font", () => {
  const STYLESHEET = join(__dirname, "bn-chart-time.scss");

  afterEach(() => {
    getStores(null).componentStyles.state["_default"] = undefined;
  });

  it("applies the theme font on the host without a page ancestor", async () => {
    const page = await renderChart("");
    expect(page.doc.querySelector("bn-page, bn-layout-page")).toBeNull();

    const font = resolveHostFont(STYLESHEET, page.root!);
    expect(font.fontFamily).toBe(SYSTEM_STYLE_DEFAULTS.global.fontFamily);
    expect(font.fontFamily).toContain("Noto Sans");
    expect(font.fontSize).toBe(`${BASE_FONT}px`);
    expect(font.color).toBe(SYSTEM_STYLE_DEFAULTS.global.fontColor);
  });

  it("forwards a global.fontFamily override from the ComponentStyle store", async () => {
    getStores(null).componentStyles.state["_default"] = { global: { fontFamily: "Comic Sans MS" } } as any;
    const page = await renderChart("");

    expect(resolveHostFont(STYLESHEET, page.root!).fontFamily).toBe("Comic Sans MS");
  });
});
