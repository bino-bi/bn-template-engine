// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { LayoutPage } from "./bn-layout-page";
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
    // The bn-context wrapper is only there because componentDidUpdate reads it.
    const page = await newSpecPage({
      components: [LayoutPage],
      html: `<bn-context><bn-layout-page></bn-layout-page></bn-context>`,
    });

    const element = page.body.querySelector("bn-layout-page") as HTMLBnLayoutPageElement;
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
