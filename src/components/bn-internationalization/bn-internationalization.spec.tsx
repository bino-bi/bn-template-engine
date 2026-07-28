// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) — same pattern as ibcs-table.spec.tsx.

// Mock MutationObserver for the withBodyObserver/withTranslation mixins.

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

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

  const build = () => ({
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
    scalingGroups: createStore({}),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
  });

  let mockStores = build();

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
    __resetMockStores: () => {
      mockStores = build();
    },
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { Internationalization } from "./bn-internationalization";
import { Text } from "../bn-text/bn-text";

const { getStores, __resetMockStores } = require("../../context/context-protocol");

const i18nBundle = (namespace: string, code: string): Record<string, string> =>
  (getStores(null).internationalization.get(namespace) ?? {})[code] ?? {};

const renderI18n = async (html: string) => {
  const page = await newSpecPage({
    components: [Internationalization, Text],
    html,
  });
  await page.waitForChanges();
  return page;
};

beforeEach(() => {
  __resetMockStores();
});

describe("bn-internationalization store updates", () => {
  it("defaults to the _system namespace and merges over the built-ins", async () => {
    await renderI18n(`<bn-internationalization code="en">{"global": {"ac1": "Actual"}}</bn-internationalization>`);

    const en = i18nBundle("_system", "en");
    expect(en["global.ac1"]).toBe("Actual");
    // Built-in keys survive a partial override.
    expect(en["bn-table.there_of"]).toBe("there of");
    expect(en["global.pl1"]).toBe("PL");
    // Nothing lands in an unreachable "undefined" slot.
    expect(getStores(null).internationalization.get("undefined")).toBeUndefined();
  });

  it("keeps other language bundles untouched", async () => {
    await renderI18n(`<bn-internationalization code="en">{"global": {"ac1": "Actual"}}</bn-internationalization>`);

    expect(i18nBundle("_system", "de")["global.ac1"]).toBe("AC");
  });

  it("stores named namespaces without touching _system", async () => {
    await renderI18n(
      `<bn-internationalization code="en" namespace="external">{"global": {"ac1": "Audited"}}</bn-internationalization>`,
    );

    expect(i18nBundle("external", "en")["global.ac1"]).toBe("Audited");
    expect(i18nBundle("_system", "en")["global.ac1"]).toBe("AC");
  });

  it("merges multiple elements for the same namespace and code", async () => {
    await renderI18n(
      `<div>
        <bn-internationalization code="en">{"global": {"ac1": "Actual"}}</bn-internationalization>
        <bn-internationalization code="en">{"global": {"pl1": "Budget"}}</bn-internationalization>
      </div>`,
    );

    const en = i18nBundle("_system", "en");
    expect(en["global.ac1"]).toBe("Actual");
    expect(en["global.pl1"]).toBe("Budget");
  });
});

describe("translation lookups via bn-text", () => {
  const textContent = (page: { body: HTMLElement }): string =>
    page.body.querySelector("bn-text").shadowRoot.querySelector("span.container").innerHTML;

  it("resolves overrides registered in the default namespace", async () => {
    const page = await renderI18n(
      `<div>
        <bn-internationalization code="en">{"labels": {"revenue": "Net Revenue"}}</bn-internationalization>
        <bn-text value="\${t('labels.revenue')}"></bn-text>
      </div>`,
    );

    expect(textContent(page)).toBe("Net Revenue");
  });

  it("returns the key for unknown keys instead of blanking the component", async () => {
    const page = await renderI18n(`<bn-text value="\${t('nope.missing')}"></bn-text>`);

    expect(textContent(page)).toBe("nope.missing");
  });

  it("does not crash on an unknown locale", async () => {
    getStores(null).context.state.locale = "fr";
    const page = await renderI18n(`<bn-text value="\${t('global.ac1')}"></bn-text>`);

    expect(textContent(page)).toBe("global.ac1");
  });
});
