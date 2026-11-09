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
import { I18nMode } from "../../../utils/constants";
import { Order } from "../../../utils/model/Order";
import { ErrorDispatcher } from "../../../utils/withHasError";

describe("IBCS Table order by variance", () => {
  const base = { operation: "+", rowGroup: "G", rowGroupIndex: 1, subCategory: "", subCategoryIndex: 1 };

  // ac1 - pp1: A 10, B 20, C 15, D no pp1, E 5, F ~1000
  // (ac1 - pp1) / |pp1|: A 10%, B 200%, C n/a (zero), D no data, E 11.1%, F n/a (near zero)
  const varianceRows: any[] = [
    { ...base, category: "A", categoryIndex: 1, ac1: 110, pp1: 100 },
    { ...base, category: "B", categoryIndex: 2, ac1: 30, pp1: 10 },
    { ...base, category: "C", categoryIndex: 3, ac1: 15, pp1: 0 },
    { ...base, category: "D", categoryIndex: 4, ac1: 5 },
    { ...base, category: "E", categoryIndex: 5, ac1: 50, pp1: 45 },
    { ...base, category: "F", categoryIndex: 6, ac1: 1000, pp1: 0.0000001 },
  ];

  // group variance sums: G1 5, G2 4; a group sum order would put G1 first
  const groupRows: any[] = [
    { ...base, rowGroup: "G1", rowGroupIndex: 2, category: "X", categoryIndex: 1, ac1: 10, pp1: 0 },
    { ...base, rowGroup: "G1", rowGroupIndex: 2, category: "Y", categoryIndex: 2, ac1: 0, pp1: 5 },
    { ...base, rowGroup: "G2", rowGroupIndex: 1, category: "Z", categoryIndex: 3, ac1: 1, pp1: 0 },
    { ...base, rowGroup: "G2", rowGroupIndex: 1, category: "W", categoryIndex: 4, ac1: 3, pp1: 0 },
  ];

  // _YTD: ac1 Bremen 5, Kiel 3, Hamburg 2; ac1 - pp1 Kiel 3, Hamburg 2, Bremen 1
  // both buckets: ac1 Hamburg 102, Kiel 53, Bremen 5
  const setRows: any[] = [
    { ...base, category: "Hamburg", categoryIndex: 1, setname: "Nov", ac1: 100, pp1: 0 },
    { ...base, category: "Hamburg", categoryIndex: 1, setname: "_YTD", ac1: 2, pp1: 0 },
    { ...base, category: "Bremen", categoryIndex: 2, setname: "Nov", ac1: 0, pp1: 0 },
    { ...base, category: "Bremen", categoryIndex: 2, setname: "_YTD", ac1: 5, pp1: 4 },
    { ...base, category: "Kiel", categoryIndex: 3, setname: "Nov", ac1: 50, pp1: 0 },
    { ...base, category: "Kiel", categoryIndex: 3, setname: "_YTD", ac1: 3, pp1: 0 },
  ];

  // printed (unsigned) ac1 - pp1: P 10, Q 30, R 20; signed Q would be -30
  const optRows: any[] = [
    { ...base, category: "P", categoryIndex: 1, operation: "+", ac1: 10, pp1: 0 },
    { ...base, category: "Q", categoryIndex: 2, operation: "-", ac1: 30, pp1: 0 },
    { ...base, category: "R", categoryIndex: 3, operation: "+", ac1: 20, pp1: 0 },
  ];

  // Alpha thereof: ac1 - pp1 s10 9, s5 15, s20 18
  // ac1 - pp1 Beta 48, Alpha 42, Gamma 5; ac1 Beta 50, Gamma 45, Alpha 35
  const drillRows: any[] = [
    { ...base, category: "Alpha", categoryIndex: 1, subCategory: "s10", subCategoryIndex: 1, ac1: 10, pp1: 1 },
    { ...base, category: "Alpha", categoryIndex: 1, subCategory: "s5", subCategoryIndex: 2, ac1: 5, pp1: -10 },
    { ...base, category: "Alpha", categoryIndex: 1, subCategory: "s20", subCategoryIndex: 3, ac1: 20, pp1: 2 },
    { ...base, category: "Beta", categoryIndex: 2, subCategory: "b", subCategoryIndex: 1, ac1: 50, pp1: 2 },
    { ...base, category: "Gamma", categoryIndex: 3, subCategory: "g", subCategoryIndex: 1, ac1: 45, pp1: 40 },
  ];

  // numeric setnames; 2025: ac1 N1 1, N2 9; both: N1 101, N2 10
  const numericSetRows: any[] = [
    { ...base, category: "N1", categoryIndex: 1, setname: 2024, ac1: 100, pp1: 0 },
    { ...base, category: "N1", categoryIndex: 1, setname: 2025, ac1: 1, pp1: 0 },
    { ...base, category: "N2", categoryIndex: 2, setname: 2024, ac1: 1, pp1: 0 },
    { ...base, category: "N2", categoryIndex: 2, setname: 2025, ac1: 9, pp1: 0 },
  ];

  // ac1 over both months: M1 101, M2 10
  const dateRows: any[] = [
    { ...base, category: "M1", categoryIndex: 1, date: "2025-10-01", ac1: 100, pp1: 0 },
    { ...base, category: "M1", categoryIndex: 1, date: "2025-11-01", ac1: 1, pp1: 0 },
    { ...base, category: "M2", categoryIndex: 2, date: "2025-10-01", ac1: 1, pp1: 0 },
    { ...base, category: "M2", categoryIndex: 2, date: "2025-11-01", ac1: 9, pp1: 0 },
  ];

  const errors = {
    clear: jest.fn(),
    replace: jest.fn(),
    add: jest.fn(),
    addOrReplace: jest.fn(),
    remove: jest.fn(),
  } as unknown as ErrorDispatcher;

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["varianceOrderData"] = { data: varianceRows };
    tables["groupOrderData"] = { data: groupRows };
    tables["setOrderData"] = { data: setRows };
    tables["optOrderData"] = { data: optRows };
    tables["drillOrderData"] = { data: drillRows };
    tables["numericSetOrderData"] = { data: numericSetRows };
    tables["dateOrderData"] = { data: dateRows };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTable = (
    hierarchy: string[],
    direction: OrderDirection,
    extraProps: Record<string, unknown> = {},
  ): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1"]}
          order={{ hierarchy, direction } as Order}
          type={TableType.LIST}
          i18n={new Map([["SUM_TOTAL", "Summe"]])}
          i18n-mode={I18nMode.META}
          dataFormatDigits={{ percent: 2, decimal: 0 }}
          tableName="varianceOrderData"
          errors={errors}
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const rows = (page: SpecPage, selector: string = "tbody tr"): string[][] =>
    Array.from(page.root.shadowRoot.querySelectorAll(selector)).map(cellTexts);

  const categories = (page: SpecPage, selector?: string): string[] => rows(page, selector).map((cells) => cells[0]);

  /** `name` or `name@bucket` of every header column with a sort arrow. */
  const arrows = (page: SpecPage): string[] =>
    ((page.rootInstance as any).table.getColumns() as { name: string; bucket?: string; order?: string }[])
      .filter((column) => column.order != null)
      .map((column) => (column.bucket === undefined ? column.name : `${column.name}@${column.bucket}`));

  it("sorts by an absolute variance instead of falling back to category", async () => {
    // before, the token became category: A..F
    expect(categories(await renderTable(["dac1_pp1"], OrderDirection.DESC))).toEqual(["F", "B", "C", "A", "E", "D"]);
    expect(categories(await renderTable(["dac1_pp1_pos"], OrderDirection.ASC))).toEqual(["E", "A", "C", "B", "F", "D"]);
  });

  it("sorts by a relative variance, a zero, near zero or missing reference last in both directions", async () => {
    const desc = categories(await renderTable(["drac1_pp1_pos"], OrderDirection.DESC));
    expect(desc.slice(0, 3)).toEqual(["B", "E", "A"]);
    expect([...desc.slice(3)].sort()).toEqual(["C", "D", "F"]);

    const asc = categories(await renderTable(["drac1_pp1"], OrderDirection.ASC));
    expect(asc.slice(0, 3)).toEqual(["A", "E", "B"]);
    expect([...asc.slice(3)].sort()).toEqual(["C", "D", "F"]);
  });

  it("sorts by a variance that is not a shown column, without an arrow", async () => {
    const page = await renderTable(["dac1_pp1"], OrderDirection.DESC);

    expect(categories(page)).toEqual(["F", "B", "C", "A", "E", "D"]);
    expect(arrows(page)).toEqual([]);
  });

  it("draws the arrow on the variance column, also behind a dimension token", async () => {
    const scenarios = ["ac1", "pp1", "dac1_pp1_pos"];

    expect(arrows(await renderTable(["dac1_pp1"], OrderDirection.DESC, { scenarios }))).toEqual(["dac1_pp1_pos"]);
    expect(arrows(await renderTable(["categoryIndex", "dac1_pp1"], OrderDirection.DESC, { scenarios }))).toEqual([
      "dac1_pp1_pos",
    ]);
  });

  it("chooses the top rows and the REST row by the variance", async () => {
    const page = await renderTable(["dac1_pp1"], OrderDirection.DESC, { limit: 2 });

    // REST: A, C, D, E; ac1 110 + 15 + 5 + 50, pp1 100 + 0 + 45
    expect(rows(page).map((cells) => cells[0])).toEqual(["F", "B", "REST"]);
    expect(rows(page)[2]).toContain("180");
    expect(rows(page)[2]).toContain("145");
  });

  it("sorts inside the groups and keeps the groups in rowGroupIndex order", async () => {
    const grouped = { tableName: "groupOrderData", type: TableType.SUM, grouped: true, showGroupTitle: true };

    const desc = await renderTable(["dac1_pp1_pos"], OrderDirection.DESC, grouped);
    expect(categories(desc, "tbody tr.groupheader")).toEqual(["G2", "G1"]);
    expect(categories(desc, "tbody tr:not(.groupheader):not(.sum)")).toEqual(["W", "Z", "X", "Y"]);

    const asc = await renderTable(["dac1_pp1_pos"], OrderDirection.ASC, grouped);
    expect(categories(asc, "tbody tr.groupheader")).toEqual(["G2", "G1"]);
    expect(categories(asc, "tbody tr:not(.groupheader):not(.sum)")).toEqual(["Z", "W", "Y", "X"]);
  });

  it("sorts an opt table by the unsigned value printed in the entry rows", async () => {
    const page = await renderTable(["dac1_pp1"], OrderDirection.DESC, {
      tableName: "optOrderData",
      type: TableType.OPT,
    });

    // columns: operation, category, pp1, ac1
    expect(rows(page).map((cells) => cells[1])).toEqual(["Q", "R", "P", "Summe"]);
  });

  it("inverts the variance order for thereof rows", async () => {
    const thereofAc1 = async (direction: OrderDirection): Promise<string[]> => {
      const page = await renderTable(["dac1_pp1"], direction, {
        tableName: "drillOrderData",
        thereof: [{ category: "Alpha" }],
      });
      // columns: category, pp1, ac1
      return rows(page, "tbody tr.ofit").map((cells) => cells[2]);
    };

    // asc inverts to desc: 18, 15, 9; by ac1 it would be 20, 10, 5
    expect(await thereofAc1(OrderDirection.ASC)).toEqual(["20", "5", "10"]);
    expect(await thereofAc1(OrderDirection.DESC)).toEqual(["10", "5", "20"]);
  });

  it("keeps the partof rows under their category with a variance order", async () => {
    const page = await renderTable(["dac1_pp1"], OrderDirection.DESC, {
      tableName: "drillOrderData",
      type: TableType.SUM,
      partof: ["Alpha", "Beta", "Gamma"].map((category) => ({ rowGroup: "", category, subCategory: "", partOf: "" })),
    });

    // by ac1 it would be Beta, Gamma, Alpha; columns: category, pp1, ac1
    expect(rows(page).map((cells) => cells[2])).toEqual(["50", "38.46%", "35", "26.92%", "45", "34.62%", "130"]);
    expect(errors.addOrReplace).not.toHaveBeenCalledWith(expect.objectContaining({ id: "ERR_sql" }));
  });

  describe("with interval setname", () => {
    const interval = {
      tableName: "setOrderData",
      interval: "setname",
      scenarios: ["ac1", "pp1", "dac1_pp1_pos"],
    };

    it("sorts by one bucket of a variance and draws the arrow on that block only", async () => {
      const page = await renderTable(["dac1_pp1_pos@_YTD"], OrderDirection.DESC, interval);

      expect(categories(page)).toEqual(["Kiel", "Hamburg", "Bremen"]);
      expect(arrows(page)).toEqual(["dac1_pp1_pos@_YTD"]);
      expect(errors.addOrReplace).not.toHaveBeenCalledWith(expect.objectContaining({ id: "WARN_orderBucket" }));
    });

    it("sorts by one bucket of a scenario", async () => {
      const page = await renderTable(["ac1@_YTD"], OrderDirection.DESC, interval);

      expect(categories(page)).toEqual(["Bremen", "Kiel", "Hamburg"]);
      expect(arrows(page)).toEqual(["ac1@_YTD"]);
    });

    it("sorts by the sum of all buckets without a bucket, arrow on every block", async () => {
      const page = await renderTable(["ac1"], OrderDirection.DESC, interval);

      expect(categories(page)).toEqual(["Hamburg", "Kiel", "Bremen"]);
      expect(arrows(page)).toEqual(["ac1@Nov", "ac1@_YTD"]);
    });

    it("sorts ascending by one bucket", async () => {
      const page = await renderTable(["dac1_pp1@_YTD"], OrderDirection.ASC, interval);

      expect(categories(page)).toEqual(["Bremen", "Hamburg", "Kiel"]);
    });

    it("chooses the top rows and the per-bucket REST by the bucket key", async () => {
      const page = await renderTable(["dac1_pp1@_YTD"], OrderDirection.DESC, { ...interval, limit: 1 });

      expect(categories(page)).toEqual(["Kiel", "REST"]);
      // REST is Hamburg + Bremen, per block pp1, ac1, ΔPP: Nov 0, 100, 100 and _YTD 4, 7, 3
      expect(rows(page)[1]).toEqual(["REST", "0", "100", "100", "4", "7", "3"]);
    });

    it("matches a numeric setname", async () => {
      const numeric = { ...interval, tableName: "numericSetOrderData" };

      expect(categories(await renderTable(["ac1@2025"], OrderDirection.DESC, numeric))).toEqual(["N2", "N1"]);
      expect(categories(await renderTable(["dac1_pp1@2025"], OrderDirection.DESC, numeric))).toEqual(["N2", "N1"]);
      expect(errors.addOrReplace).not.toHaveBeenCalledWith(expect.objectContaining({ id: "ERR_sql" }));
    });

    it("warns about a bucket that is not a setname", async () => {
      await renderTable(["dac1_pp1@Dec"], OrderDirection.DESC, interval);

      expect(errors.addOrReplace).toHaveBeenCalledWith({
        id: "WARN_orderBucket",
        type: "warning",
        message: "order: setname 'Dec' not found, the rows are not sorted by it.",
      });
    });
  });

  it("warns and ignores the bucket without interval setname", async () => {
    const page = await renderTable(["dac1_pp1@_YTD"], OrderDirection.DESC);

    expect(categories(page)).toEqual(["F", "B", "C", "A", "E", "D"]);
    expect(errors.addOrReplace).toHaveBeenCalledWith({
      id: "WARN_orderBucket",
      type: "warning",
      message: "order: '@_YTD' needs interval setname, the bucket is ignored.",
    });
  });

  it("warns and sorts a scenario by all rows without interval setname", async () => {
    const page = await renderTable(["ac1@_YTD"], OrderDirection.DESC);

    expect(categories(page)).toEqual(["F", "A", "E", "B", "C", "D"]);
    expect(errors.addOrReplace).not.toHaveBeenCalledWith(expect.objectContaining({ id: "ERR_sql" }));
    expect(errors.addOrReplace).toHaveBeenCalledWith(expect.objectContaining({ id: "WARN_orderBucket" }));
  });

  it("warns and sorts a scenario by all buckets with a date interval", async () => {
    const page = await renderTable(["ac1@2025-11"], OrderDirection.DESC, {
      tableName: "dateOrderData",
      interval: "month",
    });

    expect(categories(page)).toEqual(["M1", "M2"]);
    expect(errors.addOrReplace).not.toHaveBeenCalledWith(expect.objectContaining({ id: "ERR_sql" }));
    expect(errors.addOrReplace).toHaveBeenCalledWith(expect.objectContaining({ id: "WARN_orderBucket" }));
  });
});
