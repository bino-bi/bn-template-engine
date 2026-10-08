// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-text.spec.tsx.

// mock-doc has no MutationObserver, and the dataset mixin watches its attribute with one
import { installMutationObserverFake, notifyAttributeChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

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
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS, big: { "bn-text": { fontColor: "#123456" } } }),
    internationalization: createStore({
      ...SYSTEM_I18N_DEFAULTS,
      external: { en: { "global.ac1": "Audited" } },
    }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return { getStores: () => mockStores, getOrCreateStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { Text } from "./bn-text";

// mock-doc has no layout: scale="none" keeps the auto-scale items out of has-error.
const render = async (value: string) => {
  const page = await newSpecPage({ components: [Text], html: `<bn-text scale="none" value="${value}"></bn-text>` });
  await page.waitForChanges();
  const host = page.root as HTMLBnTextElement;
  const text = () => host.shadowRoot.querySelector("span.container").textContent;
  /** Sets a property and reports the reflected attribute to the observers, as a browser does. */
  const set = async (
    property: "datasets" | "selectedStyle" | "i18nNamespace",
    attribute: string,
    to: string | undefined,
  ) => {
    host[property] = to;
    await page.waitForChanges();
    notifyAttributeChange(host, attribute);
    await page.waitForChanges();
  };
  return { page, host, text, set };
};

describe("bn-text: a property write works like the attribute", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["kpi"] = { data: [{ ac1: 12.5 }] };
  });

  it("datasets", async () => {
    const { host, text, set } = await render("${data.kpi[0].ac1}");
    expect(text()).toBe("");

    await set("datasets", "datasets", "kpi");

    expect(host.getAttribute("datasets")).toBe("kpi");
    expect(text()).toBe("12.5");
  });

  it("removing datasets does not throw and drops the data", async () => {
    const { page, host, text, set } = await render("[${data.kpi[0].ac1}]");
    await set("datasets", "datasets", "kpi");
    expect(text()).toBe("[12.5]");

    host.removeAttribute("datasets");
    expect(() => notifyAttributeChange(host, "datasets")).not.toThrow();
    await page.waitForChanges();

    expect(text()).toBe("[]");
  });

  it("does not bind again when the attribute is written with the same value", async () => {
    // Stencil writes a reflected attribute once more in the first render
    const { page, set } = await render("${data.kpi[0].ac1}");
    await set("datasets", "datasets", "kpi");
    const bound = page.rootInstance.data;

    await set("datasets", "datasets", "kpi");

    expect(page.rootInstance.data).toBe(bound);
  });

  it("selectedStyle", async () => {
    const { host, set } = await render("x");

    await set("selectedStyle", "selected-style", "big");

    expect(host.getAttribute("selected-style")).toBe("big");
    expect(host.style.getPropertyValue("--bn-font-color")).toBe("#123456");
  });

  it("selectedStyle set back to undefined", async () => {
    const { host, set } = await render("x");
    await set("selectedStyle", "selected-style", "big");

    await set("selectedStyle", "selected-style", undefined);

    expect(host.style.getPropertyValue("--bn-font-color")).toBe("#000000");
  });

  it("i18nNamespace", async () => {
    const { host, text, set } = await render("${t('global.ac1')}");
    expect(text()).toBe("AC");

    await set("i18nNamespace", "i18n-namespace", "external");

    expect(host.getAttribute("i18n-namespace")).toBe("external");
    expect(text()).toBe("Audited");
  });

  it("i18nNamespace set back to undefined", async () => {
    const { text, set } = await render("${t('global.ac1')}");
    await set("i18nNamespace", "i18n-namespace", "external");

    await set("i18nNamespace", "i18n-namespace", undefined);

    expect(text()).toBe("AC");
  });
});

describe("bn-text: the old names of renamed translation keys", () => {
  it("still finds the built-in text", async () => {
    const { text } = await render(
      "[${t('bn-table.there_of')}] [${t('bn-table.thereof')}] [${t('bn-title.SEPERATOR_WS')}]",
    );

    expect(text()).toBe("[there of] [there of] [, ]");
  });
});
