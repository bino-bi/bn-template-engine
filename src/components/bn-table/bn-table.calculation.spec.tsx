// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-table.layout-state.spec.tsx.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
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
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { ErrorItem } from "../../utils/withHasError";
import { Table } from "./bn-table";
import { BnTableRenderer } from "./bn-table-renderer/bn-table-renderer";

const row = (rowGroup: string, rowGroupIndex: number, category: string, operation: string, ac1: number) => ({
  rowGroup,
  rowGroupIndex,
  category,
  categoryIndex: 1,
  operation,
  ac1,
});
const cost = (subCategory: string, subCategoryIndex: number, ac1: number) => ({
  ...row("Result", 2, "Costs", "-", ac1),
  categoryIndex: 2,
  subCategory,
  subCategoryIndex,
});

describe("bn-table: runningSum and thereofPosition", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["calcDs"] = {
      data: [
        row("Revenue", 1, "Licences", "+", 100),
        row("Result", 2, "Other income", "+", 10),
        cost("Staff", 1, 30),
        cost("Rent", 2, 20),
      ],
    };
  });

  const renderTable = async (props: Record<string, unknown> = {}): Promise<SpecPage> => {
    const attrs: Record<string, unknown> = {
      datasets: "calcDs",
      scenarios: "ac1",
      type: "optnototal",
      grouped: true,
      "show-group-title": "false",
      order: "categoryindex",
      thereof: '[{"rowGroup": "Result", "category": "Costs", "subCategory": ""}]',
      "measure-scale": "_",
      scale: "none",
      ...props,
    };
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      template: () => <bn-table {...attrs}></bn-table>,
    });
    await page.waitForChanges();
    return page;
  };

  const bodyRows = (page: SpecPage): string[][] =>
    Array.from(page.root.shadowRoot.querySelector("bn-table-renderer").shadowRoot.querySelectorAll("tbody tr")).map(
      (tr) => Array.from(tr.querySelectorAll("td")).map((cell) => cell.textContent.trim()),
    );
  const warnings = (page: SpecPage): string[] =>
    (JSON.parse(page.root.getAttribute("has-error") ?? "[]") as ErrorItem[]).map((e) => e.id);

  const below = [
    ["+", "Licences", "100.0"],
    ["=", "Revenue", "100.0"],
    ["+", "Other income", "10.0"],
    ["-", "Costs", "50.0"],
    ["", ".thereof Staff", "30.0"],
    ["", ".thereof Rent", "20.0"],
    ["=", "Result", "-40.0"],
  ];

  it("keeps own group sums and thereof rows below by default", async () => {
    const page = await renderTable();

    expect(bodyRows(page)).toEqual(below);
    expect(warnings(page)).toEqual([]);
  });

  it("reads the attributes running-sum and thereof-position", async () => {
    const page = await renderTable({ "running-sum": "true", "thereof-position": "above" });

    expect(bodyRows(page)).toEqual([
      ["+", "Licences", "100.0"],
      ["=", "Revenue", "100.0"],
      ["+", "Other income", "10.0"],
      ["", "Staff", "30.0"],
      ["", "Rent", "20.0"],
      ["-", "Costs", "50.0"],
      ["=", "Result", "60.0"],
    ]);
    expect(warnings(page)).toEqual([]);
  });

  it.each(["top", "true"])("warns for the thereof-position %s and prints the rows below", async (value) => {
    const page = await renderTable({ "thereof-position": value });

    expect(bodyRows(page)).toEqual(below);
    expect(warnings(page)).toEqual(["WARN_thereofPosition"]);
  });

  it("ignores runningSum with columnthereof", async () => {
    const columnthereof = '[{"scenario": "ac1", "name": "DE", "subGroups": []}]';
    const off = await renderTable({ columnthereof });
    const on = await renderTable({ columnthereof, "running-sum": "true" });

    expect(bodyRows(on)).toEqual(bodyRows(off));
  });
});
