// bn-grid.getLayoutState: structure assertions (mock-doc zero rects - no
// geometry numbers).
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

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
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
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
import { GridCellElement } from "../../utils/layoutState";
import { Grid } from "./bn-grid";

const renderGrid = async () => {
  const page = await newSpecPage({
    components: [Grid],
    html: `<bn-grid chart-title="KPIs" row-headers='["North","South"]' column-headers='["AC","PY"]'></bn-grid>`,
  });
  return page;
};

describe("bn-grid.getLayoutState", () => {
  it("reports the grid region and counts", async () => {
    const page = await renderGrid();
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-grid");
    expect(state.regions.map((r) => r.id)).toEqual(["grid"]);
    expect(state.metadata.title).toBe("KPIs");
    expect(state.metadata.rowCount).toBe(2);
    expect(state.metadata.columnCount).toBe(2);
    expect(state.metadata.cellCount).toBe(4);
    expect(state.elements).toBeUndefined();
  });

  it("lists title, headers and cells with slot names at full detail", async () => {
    const page = await renderGrid();
    const state = await page.rootInstance.getLayoutState({ detail: "full" });
    const cells = state.elements as GridCellElement[];

    expect(cells.filter((c) => c.kind === "gridTitle").map((c) => c.label)).toEqual(["KPIs"]);
    expect(cells.filter((c) => c.kind === "gridHeader").map((c) => c.label)).toEqual(["AC", "PY", "North", "South"]);

    const dataCells = cells.filter((c) => c.kind === "gridCell");
    expect(dataCells.map((c) => c.slot)).toEqual(["0-0", "0-1", "1-0", "1-1"]);
    expect(dataCells.map((c) => `${c.rowId}/${c.columnId}`)).toEqual(["0/0", "0/1", "1/0", "1/1"]);
  });
});
