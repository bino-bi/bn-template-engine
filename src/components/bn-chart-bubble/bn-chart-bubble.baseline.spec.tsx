// bn-chart-bubble.getBaseline: the facade reads its own renderer. The renderer stays
// unregistered; a hand-built SVG with the baseline marker stands in for it.
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { SYSTEM_RULESET_DEFAULTS } = require("../../stores/ruleSets");
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
    scalingGroups: createStore({}),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
    findContextElement: () => undefined,
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { place } from "../../utils/testing/place";
import { ChartBubble } from "./bn-chart-bubble";

describe("bn-chart-bubble.getBaseline", () => {
  it("reports the marked plot frame of its renderer", async () => {
    const page = await newSpecPage({
      components: [ChartBubble],
      html: `<bn-chart-bubble x="ac1" y="ac2" size="ac3" scale="none"></bn-chart-bubble>`,
    });
    const inner = page.root!.shadowRoot!.querySelector("bn-chart-bubble-renderer")!;
    inner.attachShadow({ mode: "open" }).innerHTML =
      `<div><svg id="drawCanvas"><rect data-bn-baseline="frame"></rect></svg></div>`;
    place(page.root, { left: 10, top: 20, width: 400, height: 300 });
    place(inner.shadowRoot!.querySelector("[data-bn-baseline]"), { left: 60, top: 40, width: 150, height: 200 });

    const baseline = await page.rootInstance.getBaseline();
    expect(baseline).toEqual({ x: 50, y: 220 });
    expect((await page.rootInstance.getLayoutState()).baseline).toEqual(baseline);
  });

  it("is empty before the chart has drawn", async () => {
    const page = await newSpecPage({
      components: [ChartBubble],
      html: `<bn-chart-bubble x="ac1" y="ac2" size="ac3" scale="none"></bn-chart-bubble>`,
    });
    expect(await page.rootInstance.getBaseline()).toEqual({});
  });
});
