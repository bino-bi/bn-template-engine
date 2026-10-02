// Cross-component scaling-group sync: a bn-table and a bn-chart-structure
// sharing one group must resolve to the same em-ratio - the table passes
// em-per-unit (1/v) to ibcs-table, the chart passes px-per-unit
// (effFontPx/v) to ibcs-chart-structure, so chartPx / effFontPx must equal
// the table's value.
//
// jest.mock must physically precede the imports (Stencil's transform does
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
    scalingGroups: createStore({ revenue: 100 }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { Chart as ChartStructure } from "../bn-chart-structure/bn-chart-structure";
import { Table } from "../bn-table/bn-table";
import { IbcsTable } from "../bn-table/ibcs-table";

const BASE_FONT = SYSTEM_STYLE_DEFAULTS.global.fontSizePx;

describe("cross-component scaling-group sync", () => {
  it("resolves the same em-ratio in bn-table and bn-chart-structure and follows store updates", async () => {
    const page = await newSpecPage({
      components: [Table, IbcsTable, ChartStructure],
      html: `
        <div>
          <bn-table unit-scaling="revenue" scale="none"></bn-table>
          <bn-chart-structure scenarios="ac1" variances="" unit-scaling="revenue" scale="none"></bn-chart-structure>
        </div>
      `,
    });

    const tableInner = page.body.querySelector("bn-table")!.shadowRoot!.querySelector("ibcs-table") as HTMLElement & {
      unitScaling: number;
    };
    // The inner structure chart is not registered (its SVG engine needs
    // getBBox), so its number props materialize as attributes.
    const chartInner = page.body
      .querySelector("bn-chart-structure")!
      .shadowRoot!.querySelector("ibcs-chart-structure")!;
    const chartEmRatio = () => Number(chartInner.getAttribute("pixelPerUnit")) / BASE_FONT;

    expect(tableInner.unitScaling).toBe(1 / 100);
    expect(chartEmRatio()).toBeCloseTo(1 / 100, 12);

    // A store update re-resolves both components with the new group value.
    const stores = getStores(null as never) as { scalingGroups: { state: Record<string, number> } };
    stores.scalingGroups.state["revenue"] = 200;
    await page.waitForChanges();

    expect(tableInner.unitScaling).toBe(1 / 200);
    expect(chartEmRatio()).toBeCloseTo(1 / 200, 12);
  });
});
