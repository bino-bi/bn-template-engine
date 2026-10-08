// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// The forwarding test doesn't care about translations; the real t() throws on
// keys missing from the system dictionary.
jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

// Mock MutationObserver for withComponentStyle mixin
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock ResizeObserver for the layout observer used by auto-scaling
(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
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

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { Table } from "./bn-table";
import { BnTableRenderer } from "./bn-table-renderer/bn-table-renderer";
import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { resolveHostFont } from "../../utils/testing/hostFont";
import { join } from "path";

describe("bn-table selected-style forwarding", () => {
  it("forwards selected-style to the inner bn-table-renderer", async () => {
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      template: () => <bn-table selected-style="corporate-style"></bn-table>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-table-renderer");
    expect(inner).not.toBeNull();
    expect(inner.getAttribute("selected-style")).toBe("corporate-style");
  });

  it("omits selected-style on the inner bn-table-renderer when not set", async () => {
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      template: () => <bn-table></bn-table>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-table-renderer");
    expect(inner).not.toBeNull();
    expect(inner.hasAttribute("selected-style")).toBe(false);
  });
});

// Same contract as the bn-chart-time host-font spec: the host must carry the
// theme font itself when no page ancestor provides one.
describe("bn-table host font", () => {
  it("applies the theme font on the host without a page ancestor", async () => {
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      template: () => <bn-table scale="none"></bn-table>,
    });
    expect(page.doc.querySelector("bn-page, bn-layout-page")).toBeNull();

    const font = resolveHostFont(join(__dirname, "bn-table.scss"), page.root);
    expect(font.fontFamily).toBe(SYSTEM_STYLE_DEFAULTS.global.fontFamily);
    expect(font.fontFamily).toContain("Noto Sans");
    expect(font.fontSize).toBe(`${SYSTEM_STYLE_DEFAULTS.global.fontSizePx}px`);
    expect(font.color).toBe(SYSTEM_STYLE_DEFAULTS.global.fontColor);
  });
});
