// Two bubble charts sharing one bn-scaling-group must render identical
// value→area mappings, and a store update must re-render both (spec §5.4).
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

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
    assets: createStore({}),
    context: createStore({ locale: "en" }),
    scalingGroups: createStore({ "netsales-area": 12 }),
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
import { ChartBubble } from "./bn-chart-bubble";
import { IbcsChartBubble } from "./ibcs-chart-bubble";

const VALUE = 32;

const seedData = () => {
  const db = (getStores(null as never) as { db: { db: { tables: Record<string, unknown> } } }).db.db;
  db.tables["portfolio"] = {
    data: [
      {
        operation: "+",
        category: "Core Business",
        categoryIndex: 1,
        subCategory: "VAB",
        subCategoryIndex: 1,
        ac1: 0.3,
        ac2: 0.1,
        ac3: VALUE,
      },
    ],
  };
};

const chartRadii = (host: Element): number[] => {
  const inner = host.shadowRoot!.querySelector("ibcs-chart-bubble");
  const markup = inner?.shadowRoot?.querySelector("div")?.innerHTML ?? "";
  return [...markup.matchAll(/<circle r="([\d.]+)"/g)].map((m) => Number(m[1]));
};

const groupedRadius = (areaPerUnit: number): number => Math.sqrt((areaPerUnit * VALUE) / Math.PI);

describe("bn-chart-bubble scaling-group synchronization", () => {
  it("renders identical radii for identical values across chart instances", async () => {
    seedData();

    const page = await newSpecPage({
      components: [ChartBubble, IbcsChartBubble],
      html: `
        <div>
          <bn-chart-bubble id="a" datasets="portfolio" x="ac1" y="ac2"
            size='{"measure":"ac3","group":"netsales-area"}'></bn-chart-bubble>
          <bn-chart-bubble id="b" datasets="portfolio" x="ac1" y="ac2"
            size='{"measure":"ac3","group":"netsales-area"}'></bn-chart-bubble>
        </div>
      `,
    });
    await page.waitForChanges();

    const chartA = page.body.querySelector("#a")!;
    const chartB = page.body.querySelector("#b")!;
    const expected = groupedRadius(12);

    expect(chartRadii(chartA).some((r) => Math.abs(r - expected) < 1e-6)).toBe(true);
    expect(chartRadii(chartB).some((r) => Math.abs(r - expected) < 1e-6)).toBe(true);

    // A store update re-renders both charts with the new value→area mapping.
    const stores = getStores(null as never) as { scalingGroups: { state: Record<string, number> } };
    stores.scalingGroups.state["netsales-area"] = 48;
    await page.waitForChanges();

    const updated = groupedRadius(48);
    expect(chartRadii(chartA).some((r) => Math.abs(r - updated) < 1e-6)).toBe(true);
    expect(chartRadii(chartB).some((r) => Math.abs(r - updated) < 1e-6)).toBe(true);
  });
});
