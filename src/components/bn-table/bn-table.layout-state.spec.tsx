// getLayoutState / getLayoutDetail: structure and model-derived values only -
// mock-doc returns zeroed rects, so geometry numbers are not asserted here.
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

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { CellElement, Origins } from "../../utils/layoutState";
import { I18nMode } from "../../utils/constants";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import { Table } from "./bn-table";
import { BnTableRenderer, TableLayoutDetail } from "./bn-table-renderer/bn-table-renderer";

const origins: Origins = { context: { x: 0, y: 0 }, component: { x: 0, y: 0 } };

const makeRow = (category: string, categoryIndex: number, ac1: number) => ({
  setName: "de",
  operation: "+",
  rowGroup: "Umsatz",
  rowGroupIndex: 0,
  category,
  categoryIndex,
  subCategory: "",
  subCategoryIndex: 1,
  ac1,
  pp1: ac1 + 1,
});

describe("bn-table-renderer.getLayoutDetail", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["layoutDs"] = {
      data: [makeRow("Category A", 1, 10), makeRow("Category B", 2, -4), makeRow("Category C", 3, 7)],
    };
  });

  const renderInner = async () => {
    const page = await newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          i18n-mode={I18nMode.META}
          tableName="layoutDs"
          barColumns={["dac1_pp1_pos", "drac1_pp1_pos"]}
        />
      ),
    });
    return page;
  };

  it("reports regions and counts at summary level", async () => {
    const page = await renderInner();
    const detail: TableLayoutDetail = await page.rootInstance.getLayoutDetail(origins, "summary");

    expect(detail.regions.map((r) => r.id)).toEqual(["header", "body"]);
    expect(detail.metadata.hasNoData).toBe(false);
    expect(detail.metadata.rowCount).toBe(3);
    expect(detail.metadata.columnCount).toBe(5);
    expect(detail.metadata.headerRowCount).toBeGreaterThanOrEqual(2);
    expect(detail.metadata.cellCount).toBe(3 * 5);
    expect(detail.elements).toBeUndefined();
    expect(detail.table).toBeUndefined();
  });

  it("lists every cell with model pairing at full level", async () => {
    const page = await renderInner();
    const detail: TableLayoutDetail = await page.rootInstance.getLayoutDetail(origins, "full");

    expect(detail.diagnostics).toEqual([]);
    // IBCS column order: previous period before actual, variances last.
    expect(detail.table.columns.map((c) => c.key)).toEqual(["category", "pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]);

    const rows = detail.table.rows;
    expect(rows.filter((r) => r.section === "header")).toHaveLength(detail.metadata.headerRowCount);
    expect(rows.filter((r) => r.section === "body")).toHaveLength(3);
    expect(rows.some((r) => r.type === "SEPERATORLINE")).toBe(true);

    const cells = detail.elements as CellElement[];
    expect(cells.some((c) => c.kind === "headerCell")).toBe(true);
    const bodyCells = cells.filter((c) => c.kind === "cell");
    expect(bodyCells).toHaveLength(3 * 5);

    const ac1Cells = bodyCells.filter((c) => c.key === "ac1");
    expect(ac1Cells.map((c) => c.value)).toEqual([10, -4, 7]);
    expect(ac1Cells.every((c) => c.rect.context && c.rect.component)).toBe(true);

    const absBar = bodyCells.find((c) => c.key === "dac1_pp1_pos");
    expect(absBar.bar?.variant).toBe("absolute");
    const relBar = bodyCells.find((c) => c.key === "drac1_pp1_pos");
    expect(relBar.bar?.variant).toBe("relative");
  });

  it("reports no data and no regions when the dataset has no rows", async () => {
    getStores(null).db.db.tables["layoutEmptyDs"] = { data: [] };
    const page = await newSpecPage({
      components: [BnTableRenderer],
      template: () => <bn-table-renderer scenarios={["ac1"]} measure-scale="_" tableName="layoutEmptyDs" />,
    });
    const detail: TableLayoutDetail = await page.rootInstance.getLayoutDetail(origins, "summary");

    expect(detail.metadata.hasNoData).toBe(true);
    expect(detail.regions).toEqual([]);
  });
});

describe("bn-table.getLayoutState", () => {
  const renderFacade = async (attrs: string = "") => {
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      html: `<bn-table ${attrs}></bn-table>`,
    });
    return page;
  };

  it("builds the component state and merges the inner detail", async () => {
    const page = await renderFacade();
    const state = await page.rootInstance.getLayoutState();

    expect(state.tag).toBe("bn-table");
    expect(state.id).toBe("bn-table");
    expect(state.em.fontSizePx).toBeCloseTo(13.3333);
    expect(state.em.appliedScaleFactor).toBe(1);
    expect(state.metadata.hasNoData).toBe(true);
    expect(state.elements).toBeUndefined();
    expect(page.root.classList.contains("no-data")).toBe(true);
  });

  it("reports fixed scaling resolved from the attributes", async () => {
    const page = await renderFacade(`unit-scaling="50" percentage-scaling="4"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.scaling.unitMode).toBe("fixed");
    expect(state.scaling.unitsPerEm).toBe(50);
    expect(state.scaling.unitPxPerUnit).toBeCloseTo(13.3333 / 50);
    expect(state.scaling.percentageMode).toBe("fixed");
    expect(state.scaling.percentagePointsPerEm).toBe(4);
  });

  it("reports auto scaling with the last auto-fit result", async () => {
    const page = await renderFacade(`unit-scaling="auto" percentage-scaling="auto"`);
    const state = await page.rootInstance.getLayoutState();

    expect(state.scaling.unitMode).toBe("auto");
    expect(state.scaling.percentageMode).toBe("auto");
    // The inner table auto-fits during render (fallback values without data)
    // and reports back, so the resolved values are already known.
    expect(state.scaling.unitsPerEm).toBeGreaterThan(0);
    expect(state.scaling.percentagePointsPerEm).toBeGreaterThan(0);
  });
});
