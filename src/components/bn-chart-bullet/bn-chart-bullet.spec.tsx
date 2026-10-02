// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as ibcs-table.spec.tsx.

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
import { ChartBullet } from "./bn-chart-bullet";
import { IbcsChartBullet } from "./ibcs-chart-bullet";

interface ErrorEntry {
  id: string;
  type: "error" | "warning";
  message: string;
}

const renderBullet = async (attrs: string) => {
  const page = await newSpecPage({
    components: [ChartBullet, IbcsChartBullet],
    html: `<bn-chart-bullet ${attrs}></bn-chart-bullet>`,
  });
  await page.waitForChanges();
  return page;
};

const readErrors = (page: { root?: HTMLElement }): ErrorEntry[] => {
  const raw = page.root!.getAttribute("has-error");
  return raw === null ? [] : JSON.parse(raw);
};

describe("bn-chart-bullet validation matrix", () => {
  it("renders with zero attributes - everything auto-detects", async () => {
    const page = await renderBullet(``);
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("accepts the bare-token shorthand and JSON object forms", async () => {
    const page = await renderBullet(`actual='{"measure":"ac1","label":"Revenue","unit":"EUR k"}' target="pl1"`);
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("raises bullet-prop-json on unparseable object props", async () => {
    const page = await renderBullet(`actual='{"measure":'`);
    const jsonError = readErrors(page).find((e) => e.id === "ERR_bullet_json_actual");
    expect(jsonError).toBeDefined();
    expect(jsonError!.type).toBe("error");
    expect(jsonError!.message).toContain("invalid JSON");
    // Blocking error: the inner element is not rendered.
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).toBeNull();
  });

  it("rejects variance tokens - bullet measures are plain scenario slots", async () => {
    const page = await renderBullet(`actual="drac1_pl1"`);
    const error = readErrors(page).find((e) => e.id === "ERR_bullet_measure_actual");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(error!.message).toContain("drac1_pl1");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).toBeNull();
  });

  it("rejects unknown measure tokens", async () => {
    const page = await renderBullet(`target="banana"`);
    const error = readErrors(page).find((e) => e.id === "ERR_bullet_measure_target");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(error!.message).toContain("banana");
  });

  it("raises bullet-measure-same when actual and target map the same slot", async () => {
    const page = await renderBullet(`actual="pl1" target="pl1"`);
    const error = readErrors(page).find((e) => e.id === "ERR_bullet_measure_same");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).toBeNull();
  });

  it("warns on invalid enum props and falls back to defaults", async () => {
    const page = await renderBullet(`normalize="bogus" variances="x" level="bogus" order-direction="up" limit="-1"`);
    const ids = readErrors(page).map((e) => e.id);
    expect(ids).toContain("ERR_normalize");
    expect(ids).toContain("ERR_variances");
    expect(ids).toContain("ERR_level");
    expect(ids).toContain("ERR_orderDirection");
    expect(ids).toContain("ERR_limit");
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("blocks on unparseable ranges", async () => {
    const page = await renderBullet(`ranges='[0.6'`);
    const error = readErrors(page).find((e) => e.id === "ERR_bullet_json_ranges");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).toBeNull();
  });

  it("repairs unsorted/oversized ranges with a warning and keeps rendering", async () => {
    const page = await renderBullet(`normalize="none" ranges="[0.9, 0.6, 1.2]"`);
    const warning = readErrors(page).find((e) => e.id === "WARN_bullet_ranges");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("warns that ranges are ignored in the default normalized mode", async () => {
    const page = await renderBullet(`ranges="[0.6, 0.9]"`);
    const warning = readErrors(page).find((e) => e.id === "WARN_bullet_ranges_ignored");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("does not raise the ignored-ranges warning in classic mode", async () => {
    const page = await renderBullet(`normalize="none" ranges="[0.6, 0.9]"`);
    expect(readErrors(page).find((e) => e.id === "WARN_bullet_ranges_ignored")).toBeUndefined();
  });

  it("warns on unknown sub-fields without blocking the render (forward compat)", async () => {
    const page = await renderBullet(`actual='{"measure":"ac1","futureKnob":1}'`);
    const warning = readErrors(page).find((e) => e.id === "WARN_bullet_fields_actual");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    expect(warning!.message).toContain("futureKnob");
    expect(page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")).not.toBeNull();
  });

  it("warns on unknown labels fields", async () => {
    const page = await renderBullet(`labels='{"show":"none","futureKnob":1}'`);
    const warning = readErrors(page).find((e) => e.id === "WARN_bullet_fields_labels");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
  });
});

describe("bn-chart-bullet data-warning transport", () => {
  it("syncs orchestrator warnings to has-error with translated, interpolated messages", async () => {
    const { getStores } = require("../../context/context-protocol");
    const db = getStores(null).db.db;
    db.tables["kpis"] = {
      data: [
        { operation: "+", category: "Revenue", categoryIndex: 1, ac1: 120, pl1: 100 },
        { operation: "+", category: "Profit", categoryIndex: 2, ac1: 80, pl1: null },
      ],
    };

    const page = await renderBullet(`datasets="kpis" actual="ac1" target="pl1"`);
    const warning = readErrors(page).find((e) => e.id === "WARN_bullet-target-missing");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    // The en bundle message with {{count}} interpolated.
    expect(warning!.message).toContain("1 row(s) without a target value");
  });
});

describe("bn-chart-bullet getDataStructure", () => {
  it("returns the field map with live mapping descriptions", async () => {
    const page = await renderBullet(`actual='{"measure":"ac1","label":"Revenue"}' target="pl1"`);
    const structure = (page.rootInstance as ChartBullet).getDataStructure();
    const fields = structure.IBulletChartDataRow;

    expect(fields).toBeDefined();
    expect(fields.operation).toEqual({ type: "string", isOptional: false, description: "" });
    expect(fields.category).toEqual({ type: "string", isOptional: false, description: "" });
    expect(fields.ac1.description).toBe("actual: Revenue");
    expect(fields.pl1.description).toBe("target: pl1");
    expect(fields.fc4).toEqual({ type: "number", isOptional: true, description: "" });
  });
});

describe("bn-chart-bullet empty state", () => {
  it("marks the host no-data when the chart has no rows", async () => {
    const page = await renderBullet(``);
    const inner = page.root!.shadowRoot!.querySelector("ibcs-chart-bullet")!;

    expect(inner.classList.contains("no-data")).toBe(true);
    expect(page.root!.classList.contains("no-data")).toBe(true);
  });
});
