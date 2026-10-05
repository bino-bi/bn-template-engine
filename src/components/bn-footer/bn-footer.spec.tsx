// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const mockStores = { componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }) };
  return { getStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { Footer } from "./bn-footer";

const label = async (attrs: string): Promise<string | undefined> => {
  const page = await newSpecPage({ components: [Footer], html: `<bn-footer ${attrs}></bn-footer>` });
  return page.root.shadowRoot.querySelector(".page")?.textContent;
};

describe("bn-footer page label", () => {
  it("prints a page number", async () => {
    expect(await label(`page-number="3"`)).toBe("3");
  });

  it.each(["A-1", "iv", "Appendix"])("prints the text label %s as it is", async (text) => {
    // typed as a number, the label was parsed to NaN
    expect(await label(`page-number="${text}"`)).toBe(text);
  });

  it("prints nothing when the page number is switched off", async () => {
    expect(await label(`page-number="3" display-page-number="false"`)).toBeUndefined();
  });
});
