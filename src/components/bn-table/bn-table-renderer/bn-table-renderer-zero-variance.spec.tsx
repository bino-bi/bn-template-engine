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

describe("IBCS Table variance that rounds to zero", () => {
  const entry = (category: string, categoryIndex: number, ac1: number, pp1: number, operation = "+") => ({
    rowGroup: "Result",
    rowGroupIndex: 1,
    category,
    categoryIndex,
    operation,
    ac1,
    pp1,
  });

  // the group sum and the total are 500 against 500
  const rows = [
    entry("A Equal", 1, 100, 100),
    entry("B Up", 2, 100.04, 100),
    entry("C Down", 3, 99.96, 100),
    entry("D Growth", 4, 110, 100),
    entry("E Loss", 5, 90, 100),
  ];

  // fractions: 0.1 is 10.0%
  const percentRows = [
    entry("A Equal", 1, 0.1, 0.1),
    entry("B Up", 2, 0.1004, 0.1),
    entry("C Down", 3, 0.0996, 0.1),
    entry("D Growth", 4, 0.11, 0.1),
  ];

  // the total is 100 - 100 against 100 - 100
  const optRows = [
    entry("A Revenue", 1, 100, 100),
    entry("B Costs", 2, 100.04, 100, "-"),
    entry("C Fees", 3, -0.04, 0, "-"),
  ];

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["zeroData"] = { data: rows };
    tables["zeroPercent"] = { data: percentRows };
    tables["zeroOpt"] = { data: optRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["pp1", "ac1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          measure-scale="_"
          dataFormatDigits={{ percent: 1, decimal: 1 }}
          order={{ hierarchy: [OrderColumn.CATEGORYINDEX], direction: OrderDirection.ASC } as Order}
          type={TableType.SUM}
          grouped={true}
          sum-title="Total"
          i18n={new Map()}
          i18n-mode={I18nMode.META}
          tableName="zeroData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const tds = (row: Element): Element[] => Array.from(row.querySelectorAll("td"));

  // not the group head: it repeats the label of the group sum row
  const findRow = (page: SpecPage, label: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr:not(.groupheader)")).find((row) =>
      tds(row).some((td) => td.textContent.trim() === label),
    );

  // the absolute and the relative variance are the last two cells
  const variances = (page: SpecPage, label: string): { text: string; classes: string[] }[] =>
    tds(findRow(page, label))
      .slice(-2)
      .map((td) => ({ text: td.textContent.trim(), classes: (td.getAttribute("class") || "").split(" ") }));

  const expectNeutral = (cell: { text: string; classes: string[] }, text: string) => {
    expect(cell.text).toBe(text);
    expect(cell.classes).toContain("zero");
    expect(cell.classes.filter((name) => /^(pos|neg)_/.test(name))).toEqual([]);
  };

  it("prints 0, 0.04 and -0.04 without sign class and without sentiment class", async () => {
    const page = await renderTable();

    for (const label of ["A Equal", "B Up", "C Down"]) {
      const [absolute, relative] = variances(page, label);
      expectNeutral(absolute, "0.0");
      expectNeutral(relative, "0.0%");
    }
  });

  it("keeps a relative variance that rounds to zero italic", async () => {
    const page = await renderTable();

    const [absolute, relative] = variances(page, "B Up");
    expect(relative.classes).toContain("relative_variance");
    expect(absolute.classes).not.toContain("relative_variance");
  });

  it("keeps the classes of a variance that does not round to zero", async () => {
    const page = await renderTable();

    const [growth, growthRelative] = variances(page, "D Growth");
    expect(growth.text).toBe("10.0");
    expect(growth.classes).toContain("pos_pos");
    expect(growthRelative.classes).toEqual(expect.arrayContaining(["pos_pos", "relative_variance"]));
    expect(variances(page, "E Loss")[0].classes).toContain("neg_pos");
    expect(variances(page, "E Loss")[1].classes).toContain("neg_pos");
  });

  it("follows the displayed digits", async () => {
    const page = await renderTable({ dataFormatDigits: { percent: 2, decimal: 2 } });

    expect(variances(page, "B Up")[0].text).toBe("0.04");
    expect(variances(page, "B Up")[0].classes).toContain("pos_pos");
    expect(variances(page, "B Up")[1].classes).toContain("pos_pos");
    expect(variances(page, "C Down")[0].classes).toContain("neg_pos");
    expectNeutral(variances(page, "A Equal")[0], "0.00");
  });

  it("covers the group sum row and the total row", async () => {
    const page = await renderTable();

    for (const label of ["Result", "Total"]) {
      const [absolute, relative] = variances(page, label);
      expectNeutral(absolute, "0.0");
      expectNeutral(relative, "0.0%");
    }
  });

  it("covers percentage point cells", async () => {
    const page = await renderTable({ tableName: "zeroPercent", scenariosDataFormat: DataFormat.PERCENT });

    for (const label of ["A Equal", "B Up", "C Down"]) {
      const [points] = variances(page, label);
      expectNeutral(points, "0.0");
      expect(points.classes).toContain("percentpoint");
    }
    expect(variances(page, "D Growth")[0].text).toBe("1.0");
    expect(variances(page, "D Growth")[0].classes).toContain("pos_pos");
  });

  it("covers op and opinv on - rows and on the total of an opt table", async () => {
    for (const sentiment of ["op", "opinv"]) {
      const page = await renderTable({
        tableName: "zeroOpt",
        type: TableType.OPT,
        scenarios: ["pp1", "ac1", `dac1_pp1_${sentiment}`, `drac1_pp1_${sentiment}`],
      });

      expectNeutral(variances(page, "A Revenue")[0], "0.0");
      expectNeutral(variances(page, "B Costs")[0], "0.0");
      expectNeutral(variances(page, "B Costs")[1], "0.0%");
      expectNeutral(variances(page, "C Fees")[0], "0.0");
      expectNeutral(variances(page, "Total")[0], "0.0");
    }
  });

  it("leaves scenario cells that are zero alone", async () => {
    getStores(null).db.db.tables["zeroScenario"] = { data: [entry("A Empty", 1, 0, 0)] };
    const page = await renderTable({ tableName: "zeroScenario" });

    const cells = tds(findRow(page, "A Empty"));
    expect(cells.some((td) => (td.getAttribute("class") || "").split(" ").includes("ac1"))).toBe(true);
    expect((cells[cells.length - 3].getAttribute("class") || "").split(" ")).not.toContain("zero");
  });
});
