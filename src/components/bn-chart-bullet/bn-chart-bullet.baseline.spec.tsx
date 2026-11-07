// bn-chart-bullet.getBaseline: the facade reads its own renderer. The renderer stays
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
import { ChartBullet } from "./bn-chart-bullet";

describe("bn-chart-bullet.getBaseline", () => {
  it("reports the marked zero line of its renderer", async () => {
    const page = await newSpecPage({
      components: [ChartBullet],
      html: `<bn-chart-bullet scale="none"></bn-chart-bullet>`,
    });
    const inner = page.root!.shadowRoot!.querySelector("bn-chart-bullet-renderer")!;
    inner.attachShadow({ mode: "open" }).innerHTML =
      `<div><svg id="drawCanvas"><line data-bn-baseline="axis"></line></svg></div>`;
    place(page.root, { left: 10, top: 20, width: 400, height: 300 });
    place(inner.shadowRoot!.querySelector("[data-bn-baseline]"), { left: 89, top: 40, width: 2, height: 200 });

    const baseline = await page.rootInstance.getBaseline();
    expect(baseline).toEqual({ x: 80, y: 20 });
    expect((await page.rootInstance.getLayoutState()).baseline).toEqual(baseline);
  });

  it("is empty before the chart has drawn", async () => {
    const page = await newSpecPage({
      components: [ChartBullet],
      html: `<bn-chart-bullet scale="none"></bn-chart-bullet>`,
    });
    expect(await page.rootInstance.getBaseline()).toEqual({});
  });
});
