// bn-chart-time blank prop handling: an optional attribute that is not set
// must not raise an ERR_<field> diagnostic. ERR_* means "you wrote something
// and it is wrong"; a field nobody wrote only gets its documented
// AUTO_<field> notice.
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
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { Chart } from "./bn-chart-time";

/** Diagnostic ids from the host's `has-error` attribute (removed when empty). */
const errorIds = (page: SpecPage): string[] =>
  (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as { id?: string }[]).map((e) => e.id ?? "");

// scale="none": mock-doc has no layout, so auto-scale would resolve to NaN.
const renderChart = (attrs = ""): Promise<SpecPage> =>
  newSpecPage({
    components: [Chart],
    html: `<bn-chart-time scenarios="ac1" scale="none" ${attrs}></bn-chart-time>`,
  });

describe("bn-chart-time: omitted optional props", () => {
  it.each([
    "ERR_level",
    "ERR_orderDirection",
    "ERR_unitScaling",
    "ERR_percentageScaling",
    "ERR_axisLabelsMode",
    "ERR_dateInterval",
  ])("does not emit %s when the field is omitted", async (id) => {
    const page = await renderChart();

    expect(errorIds(page)).not.toContain(id);
  });

  it("still emits the AUTO_* notices for the omitted scaling fields", async () => {
    const page = await renderChart();

    expect(errorIds(page)).toEqual(expect.arrayContaining(["AUTO_unitScaling", "AUTO_percentageScaling"]));
  });

  it("still emits ERR_axisLabelsMode for a value that is actually invalid", async () => {
    const page = await renderChart(`axis-labels-mode="verbose"`);

    expect(errorIds(page)).toContain("ERR_axisLabelsMode");
  });

  it("still emits ERR_dateInterval for a value that is actually invalid", async () => {
    const page = await renderChart(`date-interval="fortnight"`);

    expect(errorIds(page)).toContain("ERR_dateInterval");
  });
});

describe("bn-chart-time: interval-span-limit", () => {
  // the unregistered inner element gets number props as attributes
  const innerLimit = (page: SpecPage): number =>
    Number(page.root!.shadowRoot!.querySelector("bn-chart-time-renderer")!.getAttribute("intervalSpanLimit"));

  it("passes a positive limit on", async () => {
    const page = await renderChart(`interval-span-limit="12"`);

    expect(innerLimit(page)).toBe(12);
  });

  it.each(["0", "-3", "many"])("falls back to 28 for '%s'", async (value) => {
    const page = await renderChart(`interval-span-limit="${value}"`);

    expect(innerLimit(page)).toBe(28);
  });
});

describe("bn-chart-time: variance over a scenario that is not drawn", () => {
  const WARNING = "WARN_variances_scenario";

  const renderVariances = (scenarios: string, variances: string): Promise<SpecPage> =>
    newSpecPage({
      components: [Chart],
      html: `<bn-chart-time scenarios="${scenarios}" variances="${variances}" scale="none"></bn-chart-time>`,
    });

  const warning = (page: SpecPage): { type: string; message: string } | undefined =>
    (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as { id?: string; type: string; message: string }[]).find(
      (item) => item.id === WARNING,
    );

  it("warns and names the variance and the missing scenario", async () => {
    const page = await renderVariances("ac1,pp1", "dac1_pl1_pos");

    expect(warning(page)?.type).toBe("warning");
    expect(warning(page)?.message).toContain("dac1_pl1_pos");
    expect(warning(page)?.message).toContain("'pl1'");
    expect(warning(page)?.message).not.toContain("'ac1'");
  });

  it("does not warn when both scenarios are drawn", async () => {
    const page = await renderVariances("ac1,pp1", "dac1_pp1_pos,drac1_pp1_pos");

    expect(errorIds(page)).not.toContain(WARNING);
  });

  it("removes the warning when the scenario is added", async () => {
    const page = await renderVariances("ac1,pp1", "dac1_pl1_pos");

    page.root!.setAttribute("scenarios", "ac1,pp1,pl1");
    await page.waitForChanges();

    expect(errorIds(page)).not.toContain(WARNING);
  });
});

describe("bn-chart-time: one diagnostic id per boolean prop", () => {
  it("keeps the item of an invalid prop when another boolean prop is valid", async () => {
    const page = await renderChart(`show-overlay-avg="maybe" show-overlay-median="true" show-measure-scale="true"`);

    // the three validators shared one id: the last valid one removed the item of the invalid one
    expect(errorIds(page)).toContain("ERR_showOverlayAvg");
    expect(errorIds(page)).not.toContain("ERR_showOverlayMedian");
    expect(errorIds(page)).not.toContain("ERR_showMeasureScale");
  });

  it("reports every invalid boolean prop under its own id", async () => {
    const page = await renderChart(`show-overlay-avg="a" show-overlay-median="b" show-measure-scale="c"`);

    expect(errorIds(page)).toEqual(
      expect.arrayContaining(["ERR_showOverlayAvg", "ERR_showOverlayMedian", "ERR_showMeasureScale"]),
    );
    expect(errorIds(page)).not.toContain("ERR_grouped");
  });
});

describe("bn-chart-time: scale factors of the theme", () => {
  const { getStores } = require("../../context/context-protocol");
  const scaleFactors = (page: SpecPage): Record<string, number> => page.rootInstance.prepareStyle().scaleFactors;

  afterEach(() => {
    getStores(null).componentStyles.set("_default", undefined);
  });

  it("uses the default distance between a label and its column", async () => {
    const page = await renderChart();

    expect(scaleFactors(page).labelToColumn).toBe(0.3);
  });

  it("takes the distance between a label and its column from the theme", async () => {
    getStores(null).componentStyles.set("_default", { "bn-chart-time": { scaleFactors: { labelToColumn: 0.9 } } });

    const page = await renderChart();

    // the value was fixed to 0.3 in the component
    expect(scaleFactors(page).labelToColumn).toBe(0.9);
    expect(scaleFactors(page)).not.toHaveProperty("labelToColum");
  });
});
