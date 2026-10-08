// bn-chart-time scaling resolution: units-per-em attribute values are
// converted to the inner bn-chart-time-renderer's px quantities at the wrapper
// boundary (pixelPerUnit = effFontPx / unitsPerEm, pixelPerPercentage =
// 100 × effFontPx / ppPerEm), with group and numeric values treated
// identically (no hidden ×100).
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
    scalingGroups: createStore({ revenue: 250000, pct: 5 }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { AutoScalingReport, formatScalingValue } from "../../utils/scaling";
import { Chart } from "./bn-chart-time";

const BASE_FONT = SYSTEM_STYLE_DEFAULTS.global.fontSizePx;

// The inner bn-chart-time-renderer stays unregistered (its SVG engine needs getBBox,
// which mock-doc lacks). Stencil's vdom then materializes number props as
// attributes and function props as element properties - both readable.
type InnerChart = {
  pixelPerUnit: number;
  pixelPerPercentage: number;
  reportAutoScaling: (report: AutoScalingReport) => void;
};

const renderChart = async (attrs: string): Promise<{ page: SpecPage; inner: InnerChart }> => {
  // Pin scale unless the test sets it: mock-doc has no layout, so the
  // auto-scale loop would otherwise produce a NaN applied factor.
  const scaleAttr = /(^|\s)scale=/.test(attrs) ? "" : `scale="none"`;
  const page = await newSpecPage({
    components: [Chart],
    html: `<bn-chart-time scenarios="ac1" variances="" ${scaleAttr} ${attrs}></bn-chart-time>`,
  });
  const el = page.root!.shadowRoot!.querySelector("bn-chart-time-renderer") as HTMLElement & {
    reportAutoScaling: (report: AutoScalingReport) => void;
  };
  const inner: InnerChart = {
    pixelPerUnit: Number(el.getAttribute("pixelPerUnit")),
    pixelPerPercentage: Number(el.getAttribute("pixelPerPercentage")),
    reportAutoScaling: (report) => el.reportAutoScaling(report),
  };
  return { page, inner };
};

const hostErrors = (page: SpecPage): string => page.root!.getAttribute("has-error") ?? "";

describe("bn-chart-time unit-scaling resolution", () => {
  it("converts units-per-em to px-per-unit via the effective font size", async () => {
    const { inner } = await renderChart(`unit-scaling="250k"`);

    expect(inner.pixelPerUnit).toBeCloseTo(BASE_FONT / 250000, 12);
  });

  it("resolves a scaling group to the same value as the equivalent number", async () => {
    const { inner: viaGroup } = await renderChart(`unit-scaling="revenue"`);
    const { inner: viaNumber } = await renderChart(`unit-scaling="250000"`);

    expect(viaGroup.pixelPerUnit).toBe(viaNumber.pixelPerUnit);
    expect(viaGroup.pixelPerUnit).toBeCloseTo(BASE_FONT / 250000, 12);
  });

  it("passes the auto sentinel through silently", async () => {
    const { page, inner } = await renderChart(`unit-scaling="auto"`);

    expect(inner.pixelPerUnit).toBe(0);
    expect(hostErrors(page)).not.toContain("AUTO_unitScaling");
    expect(hostErrors(page)).not.toContain("WARN_unitScaling");
  });

  it("falls back to auto with AUTO_* and ERR_* warnings on invalid values", async () => {
    const { page, inner } = await renderChart(`unit-scaling="banana"`);

    expect(inner.pixelPerUnit).toBe(0);
    expect(hostErrors(page)).toContain("AUTO_unitScaling");
    expect(hostErrors(page)).toContain("WARN_unitScaling");
  });

  it("doubles pixelPerUnit when scale doubles the font size", async () => {
    const { inner: base } = await renderChart(`unit-scaling="250k"`);
    const { inner: scaled } = await renderChart(`unit-scaling="250k" scale="2"`);

    expect(scaled.pixelPerUnit).toBeCloseTo(base.pixelPerUnit * 2, 12);
  });
});

describe("bn-chart-time percentage-scaling resolution", () => {
  it("treats a numeric value and a group with the same value identically", async () => {
    const { inner: viaNumber } = await renderChart(`percentage-scaling="5"`);
    const { inner: viaGroup } = await renderChart(`percentage-scaling="pct"`);

    expect(viaNumber.pixelPerPercentage).toBe(viaGroup.pixelPerPercentage);
    expect(viaNumber.pixelPerPercentage).toBeCloseTo((100 * BASE_FONT) / 5, 12);
  });

  it("removes the AUTO_percentageScaling warning when a group resolves (F1)", async () => {
    const { page } = await renderChart(`percentage-scaling="banana"`);
    expect(hostErrors(page)).toContain("AUTO_percentageScaling");

    (page.root as HTMLElement & { percentageScaling: string }).percentageScaling = "pct";
    await page.waitForChanges();

    expect(hostErrors(page)).not.toContain("AUTO_percentageScaling");
  });
});

describe("bn-chart-time auto-fit reporting", () => {
  it("surfaces the auto-fitted value in the AUTO_unitScaling warning in units per em", async () => {
    const { page, inner } = await renderChart(`unit-scaling="banana"`);

    // Inner reports px-per-unit; 1 em should come out as BASE_FONT / report.
    const reportedPx = BASE_FONT / 500;
    inner.reportAutoScaling!({ unit: reportedPx });

    expect(hostErrors(page)).toContain("AUTO_unitScaling");
    expect(hostErrors(page)).toContain(formatScalingValue(500));
  });

  it("converts percentage reports as pp per em (inner value is px per 100 pp)", async () => {
    const { page, inner } = await renderChart(`percentage-scaling="banana"`);

    // Inner ppp of 100 × BASE_FONT / 10 px per 1.0 fraction -> 10 pp per em.
    inner.reportAutoScaling!({ percentage: (100 * BASE_FONT) / 10 });

    expect(hostErrors(page)).toContain("AUTO_percentageScaling");
    expect(hostErrors(page)).toContain(formatScalingValue(10));
  });

  it("stays silent when the value was explicitly auto", async () => {
    const { page, inner } = await renderChart(`unit-scaling="auto"`);

    inner.reportAutoScaling!({ unit: 1 });

    expect(hostErrors(page)).not.toContain("AUTO_unitScaling");
  });
});
