// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// mock-doc has no MutationObserver. The fake lets a spec report an attribute
// change to the withInheritedProps ancestor observer.
import { installMutationObserverFake, notifyAttributeChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

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
import { ComponentRegister } from "../../utils/componentRegister";

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

  it("takes inherited-closest from the page when the card in between does not set the field", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page title-scenarios="ac1"><bn-layout-card><bn-layout-card id="inner" title-scenarios="inherited-closest"></bn-layout-card></bn-layout-card></bn-layout-page>`,
    });

    const title = page.body.querySelector("#inner").shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("scenarios")).toBe("ac1");
  });

  it("picks up a value that the page gets after connect, through a card that does not set it", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      // bn-context: the page looks for it when it renders again.
      html: `<bn-context><bn-layout-page><bn-layout-card><bn-layout-card id="inner" title-scenarios="inherited-closest"></bn-layout-card></bn-layout-card></bn-layout-page></bn-context>`,
    });
    const title = page.body.querySelector("#inner").shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("scenarios")).toBe("");

    const layoutPage = page.body.querySelector("bn-layout-page");
    layoutPage.setAttribute("title-scenarios", "ac1");
    notifyAttributeChange(layoutPage, "title-scenarios");
    await page.waitForChanges();

    expect(title.getAttribute("scenarios")).toBe("ac1");
  });

  it("resolves a ruleset keyword that the card gets after connect", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page ruleset="page-rules"><bn-layout-card></bn-layout-card></bn-layout-page>`,
    });
    const card = page.body.querySelector("bn-layout-card");

    card.setAttribute("ruleset", "inherited-page");
    await page.waitForChanges();

    expect(card.shadowRoot.querySelector("bn-title").getAttribute("ruleset")).toBe("page-rules");
  });
});

describe("bn-layout-card readiness", () => {
  it("is tracked by the component register", async () => {
    const before = ComponentRegister.componentRegisterStatus().successful;

    await newSpecPage({ components: [LayoutCard], html: `<bn-layout-card></bn-layout-card>` });

    expect(ComponentRegister.componentRegisterStatus().successful).toBe(before + 1);
  });
});
