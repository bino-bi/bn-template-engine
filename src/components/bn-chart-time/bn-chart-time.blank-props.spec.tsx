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
