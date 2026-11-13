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
  it.each(["WARN_unitScaling", "WARN_percentageScaling", "WARN_axisLabelsMode", "WARN_dateInterval"])(
    "does not emit %s when the field is omitted",
    async (id) => {
      const page = await renderChart();

      expect(errorIds(page)).not.toContain(id);
    },
  );

  it("still emits the AUTO_* notices for the omitted scaling fields", async () => {
    const page = await renderChart();

    expect(errorIds(page)).toEqual(expect.arrayContaining(["AUTO_unitScaling", "AUTO_percentageScaling"]));
  });

  it("still emits WARN_axisLabelsMode for a value that is actually invalid", async () => {
    const page = await renderChart(`axis-labels-mode="verbose"`);

    expect(errorIds(page)).toContain("WARN_axisLabelsMode");
  });

  it("still emits WARN_dateInterval for a value that is actually invalid", async () => {
    const page = await renderChart(`date-interval="fortnight"`);

    expect(errorIds(page)).toContain("WARN_dateInterval");
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

describe("bn-chart-time: boolean attributes", () => {
  const values = (chart: HTMLBnChartTimeElement) => [
    chart.lineFullWidth,
    chart.showCategories,
    chart.showMeasureScale,
    chart.showOverlayAvg,
    chart.showOverlayMedian,
  ];

  it("keeps the defaults without attributes", async () => {
    expect(values((await renderChart()).root as HTMLBnChartTimeElement)).toEqual([true, true, false, true, false]);
  });

  it("reads the text true and false", async () => {
    const page = await renderChart(
      `line-full-width="false" show-categories="false" show-measure-scale="true" show-overlay-avg="false" show-overlay-median="true"`,
    );

    expect(values(page.root as HTMLBnChartTimeElement)).toEqual([false, false, true, false, true]);
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

describe("bn-chart-time: scenarios none", () => {
  const render = (attrs: string): Promise<SpecPage> =>
    newSpecPage({ components: [Chart], html: `<bn-chart-time scale="none" ${attrs}></bn-chart-time>` });
  // the unregistered inner element gets array props as properties
  const segments = (page: SpecPage): { scenarios: string[]; variances: string[] }[] =>
    Array.from(page.root!.shadowRoot!.querySelectorAll("bn-chart-time-renderer")) as unknown as {
      scenarios: string[];
      variances: string[];
    }[];

  it("draws the base chart and one segment per variance by default", async () => {
    const page = await render(`scenarios="ac1,pp1" variances="dac1_pp1_pos,drac1_pp1_pos"`);

    expect(segments(page).map((segment) => segment.variances)).toEqual([[""], ["dac1_pp1_pos"], ["drac1_pp1_pos"]]);
  });

  it("draws only the variances with scenarios none, and still reads their scenarios", async () => {
    const page = await render(`scenarios="none" variances="dac1_pp1_pos,drac1_pp1_pos"`);

    expect(segments(page).map((segment) => segment.variances)).toEqual([["dac1_pp1_pos"], ["drac1_pp1_pos"]]);
    expect(segments(page)[0].scenarios).toEqual(["ac1", "pp1"]);
    expect(errorIds(page)).not.toContain("WARN_scenarios");
    expect(errorIds(page)).not.toContain("AUTO_scenarios");
  });

  it("warns when scenarios none has no variance", async () => {
    const page = await render(`scenarios="none"`);

    expect(segments(page)).toHaveLength(0);
    expect(errorIds(page)).toContain("WARN_scenarios_none");
  });

  it("warns about digits that are no whole number", async () => {
    const page = await render(`scenarios="ac1" data-format-digits-decimal="x"`);

    expect(errorIds(page)).toContain("WARN_dataFormatDigitsDecimal");
  });

  it("puts variances over one reference in one segment with scenario-switch", async () => {
    const page = await render(
      `scenarios="ac1,pl1,pp1" variances="dac1_pp1_pos,dpl1_pp1_pos,drac1_pp1_pos" scenario-switch`,
    );

    expect(segments(page).map((segment) => segment.variances)).toEqual([
      [""],
      ["dac1_pp1_pos", "dpl1_pp1_pos"],
      ["drac1_pp1_pos"],
    ]);
  });
});
