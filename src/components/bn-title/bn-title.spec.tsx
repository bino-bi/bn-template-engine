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

import { newSpecPage } from "@stencil/core/testing";
import { Title } from "./bn-title";
import { BnTitleRenderer } from "./bn-title-renderer/bn-title-renderer";

describe("bn-title measures", () => {
  const ids = (host: Element): string[] =>
    (JSON.parse(host.getAttribute("has-error") ?? "[]") as { id: string }[]).map((e) => e.id);

  it("hands the parsed measures to the inner title", async () => {
    const page = await newSpecPage({
      components: [Title, BnTitleRenderer],
      html: `<bn-title measures='[{"name": "Revenue", "unit": "mEUR"}]'></bn-title>`,
    });

    const inner = page.root.shadowRoot.querySelector("bn-title-renderer") as HTMLElement & { measures: unknown };
    expect(inner.measures).toEqual([{ name: "Revenue", unit: "mEUR" }]);
    expect(ids(page.root)).not.toContain("WARN_measures");
  });

  it("renders with measures that are no JSON, and keeps the warning of the validator", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    // a throw in render() would reject here
    const page = await newSpecPage({
      components: [Title, BnTitleRenderer],
      html: `<bn-title measures='[{"name": '></bn-title>`,
    });
    consoleError.mockRestore();

    const inner = page.root.shadowRoot.querySelector("bn-title-renderer") as HTMLElement & { measures: unknown };
    expect(inner.measures).toEqual([]);
    expect(ids(page.root)).toContain("WARN_measures");
  });
});

describe("bn-title font size", () => {
  const mount = (attrs: string) =>
    newSpecPage({ components: [Title, BnTitleRenderer], html: `<bn-title ${attrs}></bn-title>` });

  it("has the font size of the style by default", async () => {
    const page = await mount("");

    expect(page.root.style.getPropertyValue("--bn-font-size")).toBe("13.3333px");
  });

  it("takes title-font-size in px, and ignores a value that is no size", async () => {
    expect((await mount(`title-font-size="16"`)).root.style.getPropertyValue("--bn-font-size")).toBe("16px");
    expect((await mount(`title-font-size="big"`)).root.style.getPropertyValue("--bn-font-size")).toBe("13.3333px");
    expect((await mount(`title-font-size="0"`)).root.style.getPropertyValue("--bn-font-size")).toBe("13.3333px");
  });
});
