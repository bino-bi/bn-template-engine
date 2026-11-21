// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// mock-doc has no MutationObserver. The fake lets a spec report an attribute
// change to the withInheritedProps ancestor observer.
import { installMutationObserverFake, notifyAttributeChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");

  const mockStores = {
    assets: createStore({}),
    componentStyles: createStore({
      _system: SYSTEM_STYLE_DEFAULTS,
      "big-title": { "bn-layout-card": { titleFontSize: 16 } },
    }),
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

  it("forwards selected-style to the title, footer and body", async () => {
    const page = await newSpecPage({
      components: [LayoutCard],
      template: () => <bn-layout-card selected-style="corporate-style"></bn-layout-card>,
    });
    for (const tag of ["bn-title", "bn-footer", "bn-body"]) {
      expect(page.root.shadowRoot.querySelector(tag).getAttribute("selected-style")).toBe("corporate-style");
    }
  });

  it("omits selected-style on the title, footer and body when not set", async () => {
    const page = await newSpecPage({
      components: [LayoutCard],
      template: () => <bn-layout-card></bn-layout-card>,
    });
    for (const tag of ["bn-title", "bn-footer", "bn-body"]) {
      expect(page.root.shadowRoot.querySelector(tag).hasAttribute("selected-style")).toBe(false);
    }
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

  it("resolves inherited-page against the ancestor bn-layout-page and keeps the keyword of the author", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page ruleset="page-rules"><bn-layout-card ruleset="inherited-page"></bn-layout-card></bn-layout-page>`,
    });

    const card = page.body.querySelector("bn-layout-card");
    const title = card.shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("ruleset")).toBe("page-rules");
    // overwritten with the value, the card would stop following the page
    expect(card.getAttribute("ruleset")).toBe("inherited-page");
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

  it("follows the page when a value that the card inherits changes later", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page title-scenarios="ac1"><bn-layout-card title-scenarios="inherited-page"></bn-layout-card></bn-layout-page>`,
    });
    const card = page.body.querySelector("bn-layout-card");
    const title = card.shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("scenarios")).toBe("ac1");

    const layoutPage = page.body.querySelector("bn-layout-page");
    layoutPage.setAttribute("title-scenarios", "pp1");
    notifyAttributeChange(layoutPage, "title-scenarios");
    await page.waitForChanges();

    expect(title.getAttribute("scenarios")).toBe("pp1");
    expect(card.getAttribute("title-scenarios")).toBe("inherited-page");
  });

  it("lets a component inside the card follow the page through the card's keyword", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page title-scenarios="ac1"><bn-layout-card title-scenarios="inherited-page"><bn-layout-card id="inner" title-scenarios="inherited-closest"></bn-layout-card></bn-layout-card></bn-layout-page>`,
    });
    const title = page.body.querySelector("#inner").shadowRoot.querySelector("bn-title");
    expect(title.getAttribute("scenarios")).toBe("ac1");

    // the outer card used to hold the value it had read at connect, and the inner one read that
    const layoutPage = page.body.querySelector("bn-layout-page");
    layoutPage.setAttribute("title-scenarios", "pp1");
    notifyAttributeChange(layoutPage, "title-scenarios");
    await page.waitForChanges();

    expect(title.getAttribute("scenarios")).toBe("pp1");
  });

  it("gives a component inside a card that follows the page the page value, also below another card", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page title-scenarios="ac1,pp1" ruleset="page-rules"><bn-layout-card title-scenarios="ac1" ruleset="card-rules"><bn-layout-card id="middle" title-scenarios="inherited-page" ruleset="inherited-page"><bn-layout-card id="inner" title-scenarios="inherited-closest" ruleset="inherited-closest"></bn-layout-card></bn-layout-card></bn-layout-card></bn-layout-page>`,
    });
    const title = (id: string) => page.body.querySelector(id).shadowRoot.querySelector("bn-title");

    expect(title("#middle").getAttribute("scenarios")).toBe("ac1,pp1");
    // the same as the card it sits in, not the value of the card further out
    expect(title("#inner").getAttribute("scenarios")).toBe("ac1,pp1");
    expect(title("#inner").getAttribute("ruleset")).toBe("page-rules");
  });

  it("resolves each field in its own mode", async () => {
    const page = await newSpecPage({
      components: [LayoutPage, LayoutCard],
      html: `<bn-layout-page title-scenarios="ac1,pp1" title-order="ac1"><bn-layout-card title-scenarios="ac1" title-order="pp1"><bn-layout-card id="inner" title-scenarios="inherited-closest" title-order="inherited-page"></bn-layout-card></bn-layout-card></bn-layout-page>`,
    });

    const title = page.body.querySelector("#inner").shadowRoot.querySelector("bn-title");
    // scenarios from the nearest card, order from the page although the card sets one too
    expect(title.getAttribute("scenarios")).toBe("ac1");
    expect(title.getAttribute("order")).toBe("ac1");
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

describe("bn-layout-card grid template", () => {
  const grid = (host: Element): HTMLElement => host.shadowRoot.querySelector("bn-body > div") as HTMLElement;
  const ids = (host: Element): string[] =>
    (JSON.parse(host.getAttribute("has-error") ?? "[]") as { id: string }[]).map((e) => e.id);
  const mount = (attrs: string) =>
    newSpecPage({ components: [LayoutCard], html: `<bn-layout-card ${attrs}></bn-layout-card>` });

  it("gives 1-over-3 three columns", async () => {
    const page = await mount(`card-layout="1-over-3"`);

    expect(grid(page.root).style.gridTemplateColumns).toBe("minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)");
  });

  it("renders a custom template without rows as one cell and warns", async () => {
    const page = await mount(`card-layout="custom-template" card-custom-template="a b"`);

    expect(grid(page.root).style.gridTemplateAreas).toBe('"a"');
    expect(ids(page.root)).toEqual(["WARN_cardCustomTemplate"]);
  });

  it("warns about rows of different length", async () => {
    const page = await mount(`card-layout="custom-template" card-custom-template='"a b" "c"'`);

    expect(ids(page.root)).toEqual(["WARN_cardCustomTemplate"]);
  });
});

describe("bn-layout-card title font size", () => {
  const title = (attrs: string) =>
    newSpecPage({ components: [LayoutCard], html: `<bn-layout-card ${attrs}></bn-layout-card>` }).then((page) =>
      page.root.shadowRoot.querySelector("bn-title"),
    );

  it("leaves the title alone without titleFontSize in the style", async () => {
    expect((await title("")).hasAttribute("title-font-size")).toBe(false);
  });

  it("hands titleFontSize of the selected style to the title", async () => {
    expect((await title(`selected-style="big-title"`)).getAttribute("title-font-size")).toBe("16");
  });
});
