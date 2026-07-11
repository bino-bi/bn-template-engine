// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

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
