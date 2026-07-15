// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) — same pattern as ibcs-table.spec.tsx.

// Mock MutationObserver for the withComponentStyle/withTranslation mixins.

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Stub ResizeObserver for the facade's parent-resize observer.

(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

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

import { newSpecPage } from "@stencil/core/testing";
import { ChartScatter } from "./bn-chart-scatter";
import { IbcsChartScatter } from "./ibcs-chart-scatter";

interface ErrorEntry {
  id: string;
  type: "error" | "warning";
  message: string;
}

const renderScatter = async (attrs: string) => {
  const page = await newSpecPage({
    components: [ChartScatter, IbcsChartScatter],
    html: `<bn-chart-scatter ${attrs}></bn-chart-scatter>`,
  });
  await page.waitForChanges();
  return page;
};

const readErrors = (page: { root?: HTMLElement }): ErrorEntry[] => {
  const raw = page.root!.getAttribute("has-error");
  return raw === null ? [] : JSON.parse(raw);
};

describe("bn-chart-scatter validation matrix", () => {
  it("accepts the bare-token shorthand for x/y", async () => {
    const page = await renderScatter(`x="ac1" y="ac2"`);
    const errors = readErrors(page);
    expect(errors.filter((e) => e.type === "error")).toEqual([]);
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-scatter")).not.toBeNull();
  });

  it("raises xy-prop-json on unparseable object props", async () => {
    const page = await renderScatter(`x='{"measure":' y="ac2"`);
    const errors = readErrors(page);
    const jsonError = errors.find((e) => e.id === "ERR_xy_json_x");
    expect(jsonError).toBeDefined();
    expect(jsonError!.type).toBe("error");
    expect(jsonError!.message).toContain("invalid JSON");
    // Blocking error: the inner element is not rendered.
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-scatter")).toBeNull();
  });

  it("raises xy-measure-invalid for unknown measure tokens", async () => {
    const page = await renderScatter(`x="zzz" y="ac2"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_measure_x");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(error!.message).toContain("zzz");
  });

  it("accepts variance tokens with and without a sentiment suffix", async () => {
    const page = await renderScatter(`x='{"measure":"drpp1_ac1"}' y='{"measure":"dac1_pl1_pos"}'`);
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
  });

  it("raises xy-family-mixed when measures span scenario families", async () => {
    const page = await renderScatter(`x="ac1" y="pp2"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_family");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(error!.message).toContain("ac");
    expect(error!.message).toContain("pp");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-scatter")).toBeNull();
  });

  it("raises xy-level-order when the facet level does not sit above the series level", async () => {
    // level auto → category; series auto → rowGroup; facet category is not above rowGroup.
    const page = await renderScatter(`x="ac1" y="ac2" facet='{"level":"category"}'`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_level_order");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
  });

  it("accepts a valid facet above the series level", async () => {
    const page = await renderScatter(
      `x="ac1" y="ac2" level="subcategory" series-level="category" facet='{"level":"rowgroup"}'`,
    );
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
  });

  it("warns on unknown sub-fields without blocking the render (forward compat)", async () => {
    const page = await renderScatter(`x='{"measure":"ac1","futureKnob":1}' y="ac2"`);
    const errors = readErrors(page);
    const warning = errors.find((e) => e.id === "WARN_xy_fields_x");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    expect(warning!.message).toContain("futureKnob");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-scatter")).not.toBeNull();
  });

  it("warns and ignores an inverted min/max domain override", async () => {
    const page = await renderScatter(`x='{"measure":"ac1","min":10,"max":5}' y="ac2"`);
    const warning = readErrors(page).find((e) => e.id === "WARN_xy_domain_x");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
  });

  it("warns on invalid enum props and falls back to defaults", async () => {
    const page = await renderScatter(`x="ac1" y="ac2" level="bogus" aspect="wide" limit="-3"`);
    const ids = readErrors(page).map((e) => e.id);
    expect(ids).toContain("ERR_level");
    expect(ids).toContain("ERR_aspect");
    expect(ids).toContain("ERR_limit");
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
  });

  it("requires the x measure", async () => {
    const page = await renderScatter(`y="ac2"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_measure_x");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
  });
});

describe("bn-chart-scatter data-warning transport", () => {
  it("syncs orchestrator warnings to has-error with translated, interpolated messages", async () => {
    const { getStores } = require("../../context/context-protocol");
    const db = getStores(null).db.db;
    db.tables["dupes"] = {
      data: [
        { operation: "+", category: "RX", categoryIndex: 1, ac1: 1, ac2: 2 },
        { operation: "+", category: "RX", categoryIndex: 1, ac1: 3, ac2: 4 },
      ],
    };

    const page = await renderScatter(`datasets="dupes" x="ac1" y="ac2" level="category"`);
    const warning = readErrors(page).find((e) => e.id === "WARN_xy-duplicate-point");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    // The en bundle message with {{count}}/{{names}} interpolated.
    expect(warning!.message).toContain("1 duplicate point");
    expect(warning!.message).toContain("RX");
  });
});

describe("bn-chart-scatter getDataStructure", () => {
  it("returns the field map with live mapping descriptions", async () => {
    const page = await renderScatter(`x='{"measure":"ac1","label":"Margin"}' y="ac2"`);
    const structure = (page.rootInstance as ChartScatter).getDataStructure();
    const fields = structure.IScatterChartDataRow;

    expect(fields).toBeDefined();
    expect(fields.category).toEqual({ type: "string", isOptional: false, description: "" });
    expect(fields.ac1.description).toBe("x: Margin");
    expect(fields.ac2.description).toBe("y: ac2");
    expect(fields.pl4).toEqual({ type: "number", isOptional: true, description: "" });
  });

  it("marks variance base and delta slots", async () => {
    const page = await renderScatter(`x='{"measure":"drpp1_ac1"}' y="pp2"`);
    const fields = (page.rootInstance as ChartScatter).getDataStructure().IScatterChartDataRow;
    expect(fields.pp1.description).toContain("base");
    expect(fields.ac1.description).toContain("delta");
  });
});
