// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// mock-doc has no MutationObserver, and bn-context watches its pages with one
import { installMutationObserverFake, notifyAttributeChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { LayoutPage } from "./bn-layout-page";
import { Context } from "../bn-context/bn-context";
import { ComponentRegister } from "../../utils/componentRegister";

describe("bn-layout-page selected-style forwarding", () => {
  it("forwards selected-style to the inner bn-page", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      template: () => <bn-layout-page selected-style="corporate-style"></bn-layout-page>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-page");
    expect(inner).not.toBeNull();
    expect(inner.getAttribute("selected-style")).toBe("corporate-style");
  });

  it("omits selected-style on the inner bn-page when not set", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      template: () => <bn-layout-page></bn-layout-page>,
    });

    const inner = page.root.shadowRoot.querySelector("bn-page");
    expect(inner).not.toBeNull();
    expect(inner.hasAttribute("selected-style")).toBe(false);
  });
});

describe("bn-layout-page ruleset forwarding", () => {
  it("forwards ruleset to the inner bn-title", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-layout-page ruleset="my-rules"></bn-layout-page>`,
    });

    const title = page.root.shadowRoot.querySelector("bn-title");
    expect(title).not.toBeNull();
    expect(title.getAttribute("ruleset")).toBe("my-rules");
  });

  it("omits ruleset on the inner bn-title when not set", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      template: () => <bn-layout-page></bn-layout-page>,
    });

    const title = page.root.shadowRoot.querySelector("bn-title");
    expect(title).not.toBeNull();
    expect(title.hasAttribute("ruleset")).toBe(false);
  });
});

describe("bn-layout-page i18n namespace attribute", () => {
  it("reads the i18n-namespace attribute into the prop and forwards it to the title", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      template: () => <bn-layout-page i18n-namespace="audited"></bn-layout-page>,
    });

    expect((page.root as HTMLBnLayoutPageElement).i18nNamespace).toBe("audited");
    expect(page.root.shadowRoot.querySelector("bn-title").getAttribute("i18n-namespace")).toBe("audited");
  });

  it("reflects the prop back as i18n-namespace, not Stencil's dash-cased i-1-8n-namespace", async () => {
    // withTranslation's ancestor lookup matches on the literal `i18n-namespace`
    // attribute, so the reflected name is load-bearing for inheritance.
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-layout-page></bn-layout-page>`,
    });

    const element = page.root as HTMLBnLayoutPageElement;
    element.i18nNamespace = "audited";
    await page.waitForChanges();

    expect(element.getAttribute("i18n-namespace")).toBe("audited");
    expect(element.hasAttribute("i-1-8n-namespace")).toBe(false);
  });

  it("falls back to the deprecated titleNamespace for the title only", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      template: () => <bn-layout-page title-namespace="legacy"></bn-layout-page>,
    });

    expect(page.root.shadowRoot.querySelector("bn-title").getAttribute("i18n-namespace")).toBe("legacy");
    expect(page.root.hasAttribute("i18n-namespace")).toBe(false);
  });
});

describe("bn-layout-page readiness", () => {
  it("is tracked by the component register", async () => {
    const before = ComponentRegister.componentRegisterStatus().successful;

    await newSpecPage({ components: [LayoutPage], html: `<bn-layout-page></bn-layout-page>` });

    expect(ComponentRegister.componentRegisterStatus().successful).toBe(before + 1);
  });
});

describe("bn-layout-page in a document that is printed in the other orientation", () => {
  const TURNED = "rotate(-90deg) translate(-100%)";
  const mount = async (context: string, attrs: string) => {
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-context ${context}><bn-layout-page ${attrs}></bn-layout-page></bn-context>`,
    });
    const host = page.body.querySelector("bn-layout-page") as HTMLElement;
    return { page, host, inner: host.shadowRoot.querySelector("bn-page") as HTMLElement };
  };

  it("turns a portrait page onto the landscape sheet, on the first render", async () => {
    const { host, inner } = await mount(
      `render-orientation="landscape"`,
      `page-format="a4" page-orientation="portrait"`,
    );

    // the host takes the size of the sheet, the page keeps its own layout
    expect(host.style.width).toBe("11.69in");
    expect(host.style.height).toBe("8.27in");
    expect(inner.style.transform).toBe(TURNED);
    expect(inner.getAttribute("orientation")).toBe("portrait");
  });

  it("turns a landscape page onto a portrait sheet", async () => {
    const { host, inner } = await mount(`render-orientation="portrait"`, `page-format="xga"`);

    expect(host.style.width).toBe("768px");
    expect(host.style.height).toBe("1024px");
    expect(inner.style.transform).toBe(TURNED);
  });

  it.each([
    ["the same orientation", `render-orientation="landscape"`, `page-format="a4" page-orientation="landscape"`],
    ["a format that is landscape by itself", `render-orientation="landscape"`, `page-format="xga"`],
    ["no render-orientation", ``, `page-format="a4" page-orientation="portrait"`],
    ["a render-orientation it does not know", `render-orientation="auto"`, `page-format="a4"`],
  ])("leaves a page with %s alone", async (_name, context, attrs) => {
    const { host, inner } = await mount(context, attrs);

    expect(host.style.width).toBe("");
    expect(inner.style.transform).toBe("");
  });

  it("turns the default XGA page in a portrait document, with or without page-orientation", async () => {
    for (const attrs of [``, `page-orientation="portrait"`]) {
      const { host, inner } = await mount(`render-orientation="portrait"`, attrs);

      // without a format the page is XGA landscape, the orientation has no effect
      expect(host.style.width).toBe("768px");
      expect(host.style.height).toBe("1024px");
      expect(inner.style.transform).toBe(TURNED);
    }
  });

  it("turns back when the page gets the orientation of the sheet", async () => {
    const { page, host, inner } = await mount(`render-orientation="landscape"`, `page-format="a4"`);
    expect(inner.style.transform).toBe(TURNED);

    host.setAttribute("page-orientation", "landscape");
    await page.waitForChanges();

    expect(inner.style.transform).toBe("");
    expect(host.style.width).toBe("");
  });

  it("renders without a bn-context", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-layout-page page-format="a4"></bn-layout-page>`,
    });

    expect(page.root.style.width).toBe("");
  });

  it("follows a render-orientation that is set after the first render", async () => {
    const page = await newSpecPage({
      components: [Context, LayoutPage],
      html: `<bn-context><bn-layout-page page-format="a4"></bn-layout-page></bn-context>`,
    });
    const host = page.body.querySelector("bn-layout-page") as HTMLElement;
    expect(host.style.width).toBe("");

    page.root.setAttribute("render-orientation", "landscape");
    notifyAttributeChange(page.root, "render-orientation");
    await page.waitForChanges();

    expect(host.style.width).toBe("11.69in");
    expect((host.shadowRoot.querySelector("bn-page") as HTMLElement).style.transform).toBe(TURNED);
  });

  it("tells the context about a format that is set as a property after the first render", async () => {
    const page = await newSpecPage({
      components: [Context, LayoutPage],
      html: `<bn-context><bn-layout-page></bn-layout-page></bn-context>`,
    });
    const rule = () => document.head.querySelector("style[data-bn-page-size]").textContent;
    const host = page.body.querySelector("bn-layout-page") as HTMLBnLayoutPageElement;
    expect(rule()).toBe("@page { size: 1024px 768px; }");

    host.pageFormat = "a4";
    host.pageOrientation = "landscape";
    await page.waitForChanges();

    // reflected, so the context sees the change. mock-doc has no observer, the spec reports it.
    expect(host.getAttribute("page-format")).toBe("a4");
    expect(host.getAttribute("page-orientation")).toBe("landscape");
    notifyAttributeChange(host, "page-format");
    expect(rule()).toBe("@page { size: 11.69in 8.27in; }");
  });

  it("removes the attribute of a format that is cleared as a property", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-layout-page page-format="a4" page-orientation="landscape"></bn-layout-page>`,
    });
    const host = page.root as HTMLBnLayoutPageElement;

    // Stencil's own reflection does not touch an attribute that was in the markup at the first render
    host.pageFormat = undefined;
    await page.waitForChanges();

    expect(host.hasAttribute("page-format")).toBe(false);
    expect(host.getAttribute("page-orientation")).toBe("landscape");
  });

  it("writes the attribute of a format that changed before the first render", async () => {
    const page = await newSpecPage({ components: [LayoutPage], html: `<div></div>` });
    const host = page.doc.createElement("bn-layout-page") as HTMLBnLayoutPageElement;
    host.setAttribute("page-format", "a4");
    host.pageFormat = "a3";

    page.body.append(host);
    await page.waitForChanges();

    expect(host.getAttribute("page-format")).toBe("a3");
  });

  it("gets its page number from the context before the first render", async () => {
    const page = await newSpecPage({
      components: [Context, LayoutPage],
      html: `<bn-context><bn-layout-page></bn-layout-page><bn-layout-page page-number="B"></bn-layout-page></bn-context>`,
    });

    const footers = Array.from(page.body.querySelectorAll("bn-layout-page")).map((host) =>
      host.shadowRoot.querySelector("bn-footer").getAttribute("page-number"),
    );
    expect(footers).toEqual(["1", "B"]);
  });
});

describe("bn-layout-page grid template", () => {
  const grid = (host: Element): HTMLElement => host.shadowRoot.querySelector("bn-body > div") as HTMLElement;
  const ids = (host: Element): string[] =>
    (JSON.parse(host.getAttribute("has-error") ?? "[]") as { id: string }[]).map((e) => e.id);
  const mount = (attrs: string) =>
    newSpecPage({ components: [LayoutPage], html: `<bn-layout-page ${attrs}></bn-layout-page>` });

  it("gives 1-over-3 three columns", async () => {
    const page = await mount(`page-layout="1-over-3"`);

    // a blank inside the first row used to add a fourth, empty column
    expect(grid(page.root).style.gridTemplateColumns).toBe("minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)");
    expect(grid(page.root).querySelectorAll("slot")).toHaveLength(4);
  });

  it("has a slot for the annotation layer in the body, next to the grid", async () => {
    const page = await newSpecPage({ components: [LayoutPage], html: `<bn-layout-page></bn-layout-page>` });
    const slot = page.root.shadowRoot.querySelector("bn-body > slot[name=annotations]");

    expect(slot).not.toBeNull();
    expect(grid(page.root).querySelector("slot[name=annotations]")).toBeNull();
  });

  it("keeps the default layout as one column that may grow", async () => {
    const page = await mount(``);

    expect(grid(page.root).style.gridTemplateColumns).toBe("1fr");
    expect(grid(page.root).querySelectorAll("slot")).toHaveLength(1);
  });

  it("lays out a custom template", async () => {
    const page = await mount(`page-layout="custom-template" page-custom-template='"a a" "b c"'`);

    expect(grid(page.root).style.gridTemplateAreas).toBe('"a a" "b c"');
    expect(grid(page.root).querySelectorAll("slot")).toHaveLength(3);
    expect(ids(page.root)).toEqual([]);
  });

  it.each(["", "a b", "none"])("renders the custom template %p as one cell and warns", async (template) => {
    // a throw in render() would reject here: the page read the first row of a match that was null
    const page = await mount(`page-layout="custom-template" page-custom-template="${template}"`);

    expect(grid(page.root).style.gridTemplateAreas).toBe('"a"');
    expect(grid(page.root).querySelectorAll("slot")).toHaveLength(1);
    expect(ids(page.root)).toEqual(["WARN_pageCustomTemplate"]);
  });

  it("drops the warning when the template is corrected", async () => {
    const page = await mount(`page-layout="custom-template" page-custom-template="a b"`);

    page.root.setAttribute("page-custom-template", '"a b"');
    await page.waitForChanges();

    expect(ids(page.root)).toEqual([]);
  });
});

describe("bn-layout-page title block", () => {
  const render = (attrs: string) =>
    newSpecPage({ components: [LayoutPage], html: `<bn-layout-page message-text="Hello" ${attrs}></bn-layout-page>` });
  const order = (page: Awaited<ReturnType<typeof render>>): string[] =>
    Array.from(page.root!.shadowRoot!.querySelector("bn-page")!.children).map((child) => child.tagName.toLowerCase());
  const header = (page: Awaited<ReturnType<typeof render>>) => page.root!.shadowRoot!.querySelector(".page-header")!;

  it("keeps the message in a row of its own above the title by default", async () => {
    const page = await render("");
    expect(order(page).slice(0, 2)).toEqual(["bn-message", "div"]);
    expect(Array.from(header(page).children).map((child) => child.tagName.toLowerCase())).toEqual(["bn-title"]);
    expect(header(page).classList.contains("message-beside")).toBe(false);
    expect(header(page).classList.contains("with-id")).toBe(false);
  });

  it("puts the message right of the title with message-position beside", async () => {
    const page = await render(`message-position="beside"`);
    expect(order(page)[0]).toBe("div");
    expect(Array.from(header(page).children).map((child) => child.tagName.toLowerCase())).toEqual([
      "bn-title",
      "bn-message",
    ]);
    expect(header(page).querySelector("bn-message")!.getAttribute("text")).toBe("Hello");
  });

  it("keeps the title at full width in beside mode without a message", async () => {
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-layout-page message-position="beside"></bn-layout-page>`,
    });
    expect(header(page).classList.contains("message-beside")).toBe(false);
  });

  it("prints the id of the page at the end of the title block", async () => {
    const page = await render(`title-id="11A"`);
    expect(header(page).lastElementChild!.textContent).toBe("11A");
    expect(header(page).classList.contains("with-id")).toBe(true);
    // the message stays above
    expect(order(page)[0]).toBe("bn-message");
  });

  it("warns about a position it does not know", async () => {
    const page = await render(`message-position="left"`);
    expect(page.root!.getAttribute("has-error") ?? "").toContain("WARN_messagePosition");
  });
});
