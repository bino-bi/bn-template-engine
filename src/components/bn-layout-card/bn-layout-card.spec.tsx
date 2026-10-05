// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// Mock MutationObserver for the withInheritedProps ancestor observer
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");

  const mockStores = {
    assets: createStore({}),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { LayoutCard } from "./bn-layout-card";
import { LayoutPage } from "../bn-layout-page/bn-layout-page";

describe("bn-layout-card selected-style forwarding", () => {
  it("forwards selected-style to the inner bn-card", async () => {
    const page = await newSpecPage({
      components: [LayoutCard],
      template: () => <bn-layout-card selected-style="corporate-style"></bn-layout-card>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-card");
    expect(inner).not.toBeNull();
    expect(inner.getAttribute("selected-style")).toBe("corporate-style");
  });

  it("omits selected-style on the inner bn-card when not set", async () => {
    const page = await newSpecPage({
      components: [LayoutCard],
      template: () => <bn-layout-card></bn-layout-card>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-card");
    expect(inner).not.toBeNull();
    expect(inner.hasAttribute("selected-style")).toBe(false);
  });
});

describe("bn-layout-card ruleset forwarding", () => {
  it("forwards ruleset to the inner bn-title", async () => {
    const page = await newSpecPage({
      components: [LayoutCard],
      html: `<bn-layout-card ruleset="my-rules"></bn-layout-card>`,
    });

    const title = page.root.shadowRoot.querySelector("bn-title");
    expect(title).not.toBeNull();
    expect(title.getAttribute("ruleset")).toBe("my-rules");
  });

  it("resolves inherited-page against the ancestor bn-layout-page and reflects it", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page ruleset="page-rules"><bn-layout-card ruleset="inherited-page"></bn-layout-card></bn-layout-page>`,
    });

    const card = page.body.querySelector("bn-layout-card");
    const title = card.shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("ruleset")).toBe("page-rules");
    // reflected onto the host so descendant vis components resolve the real value
    expect(card.getAttribute("ruleset")).toBe("page-rules");
  });
});

describe("bn-layout-card inherited title props", () => {
  const KEYWORDS = `ruleset="inherited-page" title-scenarios="inherited-page" title-variances="inherited-page" title-order="inherited-page" title-order-direction="inherited-page"`;
  const TITLE_ATTRS = ["ruleset", "scenarios", "variances", "order", "order-direction"];

  it.each([
    ["without a page", `<bn-layout-card ${KEYWORDS}></bn-layout-card>`],
    [
      "in a page that sets none of them",
      `<bn-layout-page><bn-layout-card ${KEYWORDS}></bn-layout-card></bn-layout-page>`,
    ],
  ])("passes unresolved keywords to the title as blank, %s", async (_name, html) => {
    const page = await newSpecPage({ components: [LayoutPage, LayoutCard], html });

    const card = page.body.querySelector("bn-layout-card");
    const title = card.shadowRoot.querySelector("bn-title");
    for (const attr of TITLE_ATTRS) {
      expect(title.getAttribute(attr)).toBe("");
    }
    // The host keeps the keyword. Descendants skip it and look further up.
    expect(card.getAttribute("title-scenarios")).toBe("inherited-page");
  });

  it("passes resolved keywords to the title", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page ruleset="page-rules" title-scenarios="ac1,pp1" title-variances="dpp1_ac1_pos" title-order="ac1" title-order-direction="desc"><bn-layout-card ${KEYWORDS}></bn-layout-card></bn-layout-page>`,
    });

    const title = page.body.querySelector("bn-layout-card").shadowRoot.querySelector("bn-title");
    expect(TITLE_ATTRS.map((attr) => title.getAttribute(attr))).toEqual([
      "page-rules",
      "ac1,pp1",
      "dpp1_ac1_pos",
      "ac1",
      "desc",
    ]);
  });

  it("takes inherited-closest from the outer card when the page does not set the field", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page><bn-layout-card title-scenarios="fc1"><bn-layout-card id="inner" title-scenarios="inherited-closest"></bn-layout-card></bn-layout-card></bn-layout-page>`,
    });

    const title = page.body.querySelector("#inner").shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("scenarios")).toBe("fc1");
  });
});
