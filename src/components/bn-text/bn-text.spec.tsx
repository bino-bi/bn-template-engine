// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-internationalization.spec.tsx.

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
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return { getStores: () => mockStores, getOrCreateStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { Text } from "./bn-text";

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// mock-doc has no layout: scale="none" keeps the auto-scale items out of has-error.
const render = async (value: string, datasets = "") => {
  const page = await newSpecPage({
    components: [Text],
    html: `<bn-text scale="none" datasets="${datasets}" value="${attr(value)}"></bn-text>`,
  });
  await page.waitForChanges();
  return { host: page.root, container: page.root.shadowRoot.querySelector("span.container") };
};

describe("bn-text template", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["kpi"] = {
      data: [{ name: "<b>x</b>", ac1: 12.5, link: "javascript:alert(1)", width: "1 class=injected" }],
    };
  });

  it.each(["${t['constr'+'uctor']('return this')().__pwned=1}", "${(function(){return this})().__pwned=1}"])(
    "prints %s as text and runs nothing",
    async (payload) => {
      const { host, container } = await render(payload);

      expect(container.textContent).toBe(payload);
      // mock-doc's window and globalThis are different objects
      expect((globalThis as any).__pwned).toBeUndefined();
      expect((window as any).__pwned).toBeUndefined();
      expect(host.getAttribute("has-error")).toBeNull();
    },
  );

  it.each(["C:\\users\\report", "a `b` c"])("prints %s as it is", async (text) => {
    const { host, container } = await render(text);

    expect(container.textContent).toBe(text);
    expect(host.getAttribute("has-error")).toBeNull();
  });

  it("shows a data value as text and keeps the author's markup", async () => {
    const { host, container } = await render("<b>Name</b>: ${data.kpi[0].name}", "kpi");

    expect(container.innerHTML).toBe("<b>Name</b>: &lt;b&gt;x&lt;/b&gt;");
    expect(host.getAttribute("has-error")).toBeNull();
  });

  it("keeps a data value inside the attribute the author wrote", async () => {
    const quoted = await render('<a href="${data.kpi[0].link}">x</a>', "kpi");
    expect(quoted.container.innerHTML).toBe("<a>x</a>");

    const unquoted = await render("<span title=${data.kpi[0].width}>x</span>", "kpi");
    expect(unquoted.container.innerHTML).toBe('<span title="1 class=injected">x</span>');
  });

  it("reads a datasource reference by its $ name", async () => {
    const { container } = await render("${data['$kpi'][0].ac1} ${this.data['$kpi'][0].ac1}", "$kpi");

    expect(container.textContent).toBe("12.5 12.5");
  });

  it("renders an unknown path empty and adds a warning", async () => {
    const { host, container } = await render("A${data.kpi[5].name}B", "kpi");

    expect(container.textContent).toBe("AB");
    expect(JSON.parse(host.getAttribute("has-error"))).toEqual([
      { id: "WARN_value_path", type: "warning", message: "Unknown template path: data.kpi[5].name" },
    ]);
  });
});

describe("bn-text and web fonts", () => {
  // mock-doc has no document.fonts
  const listeners = new Set<() => void>();
  const fonts = {
    addEventListener: (type: string, listener: () => void) => type === "loadingdone" && listeners.add(listener),
    removeEventListener: (type: string, listener: () => void) => type === "loadingdone" && listeners.delete(listener),
  };

  beforeEach(() => {
    listeners.clear();
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  });

  afterEach(() => {
    // @ts-ignore - only set for these tests
    delete document.fonts;
  });

  it("measures again when fonts have loaded", async () => {
    const page = await newSpecPage({ components: [Text], html: `<bn-text value="Revenue"></bn-text>` });
    const applyScaling = jest.spyOn(page.rootInstance, "applyScaling");
    expect(listeners.size).toBe(1);

    listeners.forEach((listener) => listener());
    await page.waitForChanges();

    expect(applyScaling).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it leaves the document", async () => {
    const page = await newSpecPage({ components: [Text], html: `<bn-text value="Revenue"></bn-text>` });

    page.root.remove();

    expect(listeners.size).toBe(0);
  });
});
