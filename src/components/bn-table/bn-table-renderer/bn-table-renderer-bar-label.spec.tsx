// Mock MutationObserver for withComponentStyle mixin
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../../stores/internationalization");
  const { createScopedDb } = require("../../../context/scopedDb");

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
  };
});

import { h } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../../context/context-protocol";
import { BnTableRenderer } from "./bn-table-renderer";
import { OrderDirection, TableType } from "../utils/model";
import { DataFormat, I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

describe("IBCS Table bar labels", () => {
  // dac1_pp1 is +1234.5 / -0.04 / +12.5; drac1_pp1 of Gamma is +12.5%
  const rows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, ac1: 1734.5, pp1: 500 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, ac1: 99.96, pp1: 100 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Gamma", categoryIndex: 3, ac1: 112.5, pp1: 100 },
  ];

  // the values are fractions: 0.031 is 3.10%
  const percentRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Margin", categoryIndex: 1, ac1: 0.031, pp1: 0.052 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["barLabelData"] = { data: rows };
    getStores(null).db.db.tables["barLabelPercentData"] = { data: percentRows };
  });

  afterEach(() => {
    getStores(null).context.state.locale = "en";
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "dac1_pp1_pos"]}
          barColumns={["dac1_pp1_pos"]}
          dataFormatDigits={{ percent: 1, decimal: 1 }}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.LIST}
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="barLabelData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const labelOf = (page: SpecPage, category: string): string =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"))
      .find((row) => row.querySelector("td")?.textContent.trim() === category)
      .querySelector("svg text")
      .textContent.trim();

  it("prints the decimal separator of the locale", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable();

    // 1734.5 - 500 = 1234.5
    expect(labelOf(page, "Alpha")).toBe("+1,2K");
  });

  it("keeps the English format for en", async () => {
    const page = await renderTable();

    expect(labelOf(page, "Alpha")).toBe("+1.2K");
  });

  it("prints a relative variance with the percent digits", async () => {
    const relative = { scenarios: ["ac1", "drac1_pp1_pos"], barColumns: ["drac1_pp1_pos"] };

    // (112.5 - 100) / 100 = 12.5%
    expect(labelOf(await renderTable(relative), "Gamma")).toBe("+12.5%");

    getStores(null).context.state.locale = "de";

    expect(labelOf(await renderTable(relative), "Gamma")).toBe("+12,5%");
  });

  it("shortens a relative label that would be cut off by the cell", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable({
      scenarios: ["ac1", "drac1_pp1_pos"],
      barColumns: ["drac1_pp1_pos"],
      dataFormatDigits: { percent: 2, decimal: 1 },
    });

    expect(labelOf(page, "Gamma")).toBe("+12,50%");
    // (1734.5 - 500) / 500 = 246.9%, the gutter has no room for +246,90%
    expect(labelOf(page, "Alpha")).toBe("+246,9%");
  });

  it("prints no negative zero", async () => {
    const page = await renderTable();

    // 99.96 - 100 = -0.04
    expect(labelOf(page, "Beta")).toBe("0");
  });

  it("prints waterfall labels in the locale", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable({ scenarios: ["ac1"], barColumns: ["ac1"], type: TableType.SUM });

    const alpha = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find(
      (row) => row.querySelector("td")?.textContent.trim() === "Alpha",
    );

    expect(alpha.querySelector("svg").getAttribute("class")).toContain("waterfall-bar");
    expect(labelOf(page, "Alpha")).toBe("1,7K");
  });

  it("labels a percent table variance in percentage points", async () => {
    getStores(null).context.state.locale = "de";
    const page = await renderTable({
      tableName: "barLabelPercentData",
      scenarios: ["pp1", "ac1", "dac1_pp1_pos"],
      scenariosDataFormat: DataFormat.PERCENT,
    });

    // 3.1 - 5.2 = -2.1 points
    expect(labelOf(page, "Margin")).toBe("-2,1");
  });
});
