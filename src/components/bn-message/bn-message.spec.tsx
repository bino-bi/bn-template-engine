// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// Mock MutationObserver for the withComponentStyle selected-style observer
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
    componentStyles: createStore({}),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { Footer as Message } from "./bn-message";

const renderMessage = async (text: string) => {
  const page = await newSpecPage({
    components: [Message],
    template: () => <bn-message text={text}></bn-message>,
  });
  return page.root.shadowRoot.querySelector("span.note");
};

describe("bn-message text rendering", () => {
  it("renders an explicit line break", async () => {
    const note = await renderMessage("Line one<br />Line two");

    expect(note.innerHTML).toBe("Line one<br>Line two");
    expect(note.querySelector("br")).not.toBeNull();
  });

  it("renders inline markup", async () => {
    const note = await renderMessage("Revenue <strong>above plan</strong>");

    expect(note.innerHTML).toBe("Revenue <strong>above plan</strong>");
  });

  it("sanitizes dangerous markup", async () => {
    const note = await renderMessage(`<img src="x" onerror="alert(1)" /><script>alert(1)</script>`);

    expect(note.innerHTML).toBe(`<img src="x">alert(1)`);
  });

  it("renders plain text unchanged", async () => {
    const note = await renderMessage("Placeholder message");

    expect(note.textContent).toBe("Placeholder message");
  });

  it("omits the message row when text and image are empty", async () => {
    const page = await newSpecPage({
      components: [Message],
      template: () => <bn-message></bn-message>,
    });

    expect(page.root.getAttribute("id")).toBe("container");
    expect(page.root.shadowRoot.querySelector("span.note")).toBeNull();
  });
});
