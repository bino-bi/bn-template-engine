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
