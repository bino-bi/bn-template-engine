// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { LayoutPage } from "./bn-layout-page";

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
