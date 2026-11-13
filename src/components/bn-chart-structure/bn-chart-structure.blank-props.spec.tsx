// bn-chart-structure blank prop handling: an optional attribute that is not
// set must not raise an ERR_<field> diagnostic. ERR_* means "you wrote
// something and it is wrong"; a field nobody wrote only gets its documented
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
import { Chart } from "./bn-chart-structure";

/** Diagnostic ids from the host's `has-error` attribute (removed when empty). */
const errorIds = (page: SpecPage): string[] =>
  (JSON.parse(page.root!.getAttribute("has-error") ?? "[]") as { id?: string }[]).map((e) => e.id ?? "");

// scale="none": mock-doc has no layout, so auto-scale would resolve to NaN.
const renderChart = (attrs = ""): Promise<SpecPage> =>
  newSpecPage({
    components: [Chart],
    html: `<bn-chart-structure scenarios="ac1" scale="none" ${attrs}></bn-chart-structure>`,
  });

describe("bn-chart-structure: omitted optional props", () => {
  it.each(["WARN_level", "WARN_orderDirection", "WARN_unitScaling", "WARN_percentageScaling"])(
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

  it("still emits WARN_orderDirection for a value that is actually invalid", async () => {
    const page = await renderChart(`order-direction="sideways"`);

    expect(errorIds(page)).toContain("WARN_orderDirection");
  });

  it("still emits WARN_level for a value that is actually invalid", async () => {
    const page = await renderChart(`level="banana"`);

    expect(errorIds(page)).toContain("WARN_level");
  });
});

describe("bn-chart-structure: stack colours of the theme", () => {
  const innerStackColors = (page: SpecPage): string[] | undefined =>
    (
      page.root!.shadowRoot!.querySelector("bn-chart-structure-renderer") as unknown as {
        styles: { stackColors?: string[] };
      }
    ).styles.stackColors;

  it("passes the stack colours of the selected style to the chart", async () => {
    // the mocked module hands out the stores of this spec
    const { getStores } = require("../../context/context-protocol");
    getStores().componentStyles.set("brand", { "bn-chart-structure": { stackColors: ["#112233", "#ddeeff"] } });

    const page = await renderChart(`selected-style="brand"`);

    // the chart fell back to its built-in black, light grey and grey
    expect(innerStackColors(page)).toEqual(["#112233", "#ddeeff"]);
  });

  it("passes the system stack colours without a style", async () => {
    expect(innerStackColors(await renderChart())).toEqual(["#000000", "#c0c0c0", "#808080"]);
  });
});

describe("bn-chart-structure: boolean attributes", () => {
  it.each([
    ["no attribute", "", [true, false]],
    ["the text true", `show-categories="true" show-measure-scale="true"`, [true, true]],
    ["the text false", `show-categories="false" show-measure-scale="false"`, [false, false]],
    ["an attribute without value", "show-measure-scale", [true, true]],
  ])("reads %s", async (_name, attrs, expected) => {
    const chart = (await renderChart(attrs)).root as HTMLBnChartStructureElement;

    expect([chart.showCategories, chart.showMeasureScale]).toEqual(expected);
  });
});

describe("bn-chart-structure: scenarios none", () => {
  const render = (attrs: string): Promise<SpecPage> =>
    newSpecPage({ components: [Chart], html: `<bn-chart-structure scale="none" ${attrs}></bn-chart-structure>` });
  // the unregistered inner element gets array props as properties
  const segments = (page: SpecPage): { scenarios: string[]; variances: string[] }[] =>
    Array.from(page.root!.shadowRoot!.querySelectorAll("bn-chart-structure-renderer")) as unknown as {
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
});
