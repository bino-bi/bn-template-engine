// nanoid ships ESM only, which jest cannot parse without extra transforms
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// Mock MutationObserver for withBodyObserver mixin
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
  const { SYSTEM_RULESET_DEFAULTS } = require("../../stores/ruleSets");

  const mockStores = {
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { SYSTEM_RULESET_DEFAULTS } from "../../stores/ruleSets";
import { Ruleset } from "./bn-ruleset";

describe("bn-ruleset", () => {
  it("writes the parsed JSON body into the ruleSets store under the given name", async () => {
    await newSpecPage({
      components: [Ruleset],
      html: `<bn-ruleset name="custom">{"scenarios":{"pl":{"sortIndex":900}}}</bn-ruleset>`,
    });

    expect(getStores(null).ruleSets.state["custom"]).toEqual({ scenarios: { pl: { sortIndex: 900 } } });
  });

  it("writes to the _default layer when no name is given", async () => {
    await newSpecPage({
      components: [Ruleset],
      html: `<bn-ruleset>{"fallback":{"sortIndex":990}}</bn-ruleset>`,
    });

    expect(getStores(null).ruleSets.state["_default"]).toEqual({ fallback: { sortIndex: 990 } });
  });

  it("leaves the store untouched when the body is invalid JSON", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await newSpecPage({
      components: [Ruleset],
      html: `<bn-ruleset name="broken">{not json}</bn-ruleset>`,
    });

    expect(getStores(null).ruleSets.state["broken"]).toBeUndefined();
    expect(getStores(null).ruleSets.state["_system"]).toEqual(SYSTEM_RULESET_DEFAULTS);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
