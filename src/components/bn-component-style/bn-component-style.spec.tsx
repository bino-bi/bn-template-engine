// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const mockStores = { componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }) };
  return { getStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { ComponentStyle } from "./bn-component-style";

const items = (host: Element): { id: string; type: string; message: string }[] =>
  JSON.parse(host.getAttribute("has-error") ?? "[]");

const render = (name: string, body: string) =>
  newSpecPage({
    components: [ComponentStyle],
    html: `<bn-component-style name="${name}">${body}</bn-component-style>`,
  });

describe("bn-component-style body", () => {
  it("stores a valid style and reports nothing", async () => {
    const page = await render("valid", `{"global": {"fontSizePx": 11}}`);

    expect(items(page.root)).toEqual([]);
    expect((getStores(null).componentStyles.get("valid") as any).global.fontSizePx).toBe(11);
  });

  it("reports unknown keys as an error and still stores the style", async () => {
    const page = await render(
      "typo",
      `{"global": {"fontSizePx": 11}, "bn-chart-time": {"scaleFactors": {"labelToColum": 0.5}}, "bn-table": {}}`,
    );

    expect(items(page.root)).toEqual([
      {
        id: "ERR_keys",
        type: "error",
        message: "Unknown style keys, they are ignored: bn-chart-time.scaleFactors.labelToColum, bn-table",
      },
    ]);
    expect((getStores(null).componentStyles.get("typo") as any).global.fontSizePx).toBe(11);
  });

  it("reports a body that is no JSON", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await render("broken", `{"global": `);
    consoleError.mockRestore();

    expect(items(page.root).map((e) => [e.id, e.type])).toEqual([["JSON_PARSE", "error"]]);
  });
});
