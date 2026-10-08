// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-table-renderer.spec.tsx.

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
    scalingGroups: createStore({ "netsales-area": 12 }),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { ChartBubble } from "./bn-chart-bubble";
import { BnChartBubbleRenderer } from "./bn-chart-bubble-renderer/bn-chart-bubble-renderer";

interface ErrorEntry {
  id: string;
  type: "error" | "warning";
  message: string;
}

const renderBubble = async (attrs: string) => {
  const page = await newSpecPage({
    components: [ChartBubble, BnChartBubbleRenderer],
    html: `<bn-chart-bubble ${attrs}></bn-chart-bubble>`,
  });
  await page.waitForChanges();
  return page;
};

const readErrors = (page: { root?: HTMLElement }): ErrorEntry[] => {
  const raw = page.root!.getAttribute("has-error");
  return raw === null ? [] : JSON.parse(raw);
};

describe("bn-chart-bubble validation matrix", () => {
  it("accepts shorthand tokens for x/y/size", async () => {
    const page = await renderBubble(`x="ac1" y="ac2" size="ac3"`);
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
    expect(page.root!.shadowRoot!.querySelector("bn-chart-bubble-renderer")).not.toBeNull();
  });

  it("requires the size measure", async () => {
    const page = await renderBubble(`x="ac1" y="ac2"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_measure_size");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
    expect(page.root!.shadowRoot!.querySelector("bn-chart-bubble-renderer")).toBeNull();
  });

  it("raises xy-family-mixed across x/y/size/share", async () => {
    const page = await renderBubble(`x="ac1" y="ac2" size="pp3"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_family");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
  });

  it("rejects compareWith combined with variance-token axes (xy-compare-variance)", async () => {
    const page = await renderBubble(`x='{"measure":"drpp1_ac1"}' y="ac2" size="ac3" compare-with="pp"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_compare_variance");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
  });

  it("rejects a compareWith family equal to the primary family", async () => {
    const page = await renderBubble(`x="ac1" y="ac2" size="ac3" compare-with="ac"`);
    const error = readErrors(page).find((e) => e.id === "ERR_xy_compare_family");
    expect(error).toBeDefined();
    expect(error!.type).toBe("error");
  });

  it("accepts a valid compareWith family", async () => {
    const page = await renderBubble(`x="ac1" y="ac2" size="ac3" compare-with="pp"`);
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
  });

  it("warns on unknown compareWith values and ignores them", async () => {
    const page = await renderBubble(`x="ac1" y="ac2" size="ac3" compare-with="xx"`);
    const warning = readErrors(page).find((e) => e.id === "ERR_compareWith");
    expect(warning).toBeDefined();
    expect(warning!.type).toBe("warning");
    expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
  });

  describe("scaling groups (§5.4)", () => {
    it("accepts a size.group that names a known bn-scaling-group", async () => {
      const page = await renderBubble(`x="ac1" y="ac2" size='{"measure":"ac3","group":"netsales-area"}'`);
      expect(readErrors(page).filter((e) => e.type === "error")).toEqual([]);
    });

    it("raises bubble-scale-group-unknown for unresolved group names", async () => {
      const page = await renderBubble(`x="ac1" y="ac2" size='{"measure":"ac3","group":"nope"}'`);
      const error = readErrors(page).find((e) => e.id === "ERR_xy_scale_group");
      expect(error).toBeDefined();
      expect(error!.type).toBe("error");
      expect(error!.message).toContain("nope");
    });
  });
});

describe("bn-chart-bubble getDataStructure", () => {
  it("maps x/y/size/share and the comparison slots", async () => {
    const page = await renderBubble(
      `x="ac1" y="ac2" size='{"measure":"ac3","label":"Net sales"}' share="ac4" compare-with="pp"`,
    );
    const fields = (page.rootInstance as ChartBubble).getDataStructure().IBubbleChartDataRow;

    expect(fields.ac1.description).toBe("x: ac1");
    expect(fields.ac3.description).toBe("size: Net sales");
    expect(fields.ac4.description).toBe("share: ac4");
    expect(fields.pp1.description).toBe("x: compareWith");
    expect(fields.pp3.description).toBe("size: compareWith");
  });
});
