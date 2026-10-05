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
import { IbcsTable } from "./ibcs-table";

// Pasted into a quoted SQL literal, this value ends the literal and runs as AlaSQL inline JavaScript.
const payloadGroup = "Kids' OR ``(globalThis.__pwned = 1)`` OR '";

const row = (rowGroup: string, rowGroupIndex: number, category: string, subCategory: string, ac1: number) => ({
  setName: "de",
  operation: "+",
  rowGroup,
  rowGroupIndex,
  category,
  categoryIndex: 1,
  subCategory,
  subCategoryIndex: 1,
  ac1,
});

describe("bn-table: data values in queries", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["sqlDs"] = {
      data: [
        row("Men's Wear", 0, "O'Neill", "Shirts", 10),
        row("Men's Wear", 0, "O'Neill", "Shorts", 20),
        row("Côte d'Ivoire", 1, "Abidjan", "", 5),
        row(payloadGroup, 2, "Toys", "", 7),
      ],
    };
  });

  afterEach(() => {
    delete (globalThis as any).__pwned;
  });

  const renderTable = async (props: Record<string, unknown> = {}): Promise<SpecPage> => {
    const attrs: Record<string, unknown> = {
      datasets: "sqlDs",
      scenarios: "ac1",
      type: "sum",
      grouped: "true",
      "measure-scale": "_",
      scale: "none",
      ...props,
    };
    const page = await newSpecPage({
      components: [Table, IbcsTable],
      template: () => <bn-table {...attrs}></bn-table>,
    });
    await page.waitForChanges();
    return page;
  };

  const inner = (page: SpecPage): Element => page.root.shadowRoot.querySelector("ibcs-table");
  const bodyRows = (page: SpecPage): Element[] => Array.from(inner(page).shadowRoot.querySelectorAll("tbody tr"));
  const hasClass = (element: Element, name: string): boolean =>
    element.getAttribute("class")?.split(" ").includes(name) ?? false;
  const cellTexts = (element: Element): string[] =>
    Array.from(element.querySelectorAll("td")).map((cell) => cell.textContent.trim());
  const errors = (page: SpecPage): ErrorItem[] => JSON.parse(page.root.getAttribute("has-error") ?? "[]");
  // mock-doc's window and globalThis are different objects
  const pwned = (): unknown => (globalThis as any).__pwned ?? (window as any).__pwned;

  it("renders every row group, with group sums that add up to the total", async () => {
    const page = await renderTable();
    const rows = bodyRows(page);

    const heads = rows.filter((r) => hasClass(r, "groupheader")).map((r) => cellTexts(r)[0]);
    expect(heads.sort()).toEqual(["Men's Wear", "Côte d'Ivoire", payloadGroup].sort());

    const sums = rows.filter((r) => hasClass(r, "sum")).map((r) => Number(cellTexts(r).at(-1).replace(",", ".")));
    expect(sums).toHaveLength(4);
    const total = sums.pop();
    expect(total).toBe(42);
    expect(sums.reduce((a, b) => a + b, 0)).toBe(total);

    expect(errors(page).some((e) => e.id === "ERR_sql")).toBe(false);
    expect(pwned()).toBeUndefined();
  });

  it("matches thereof and partof values that contain an apostrophe", async () => {
    const drill = JSON.stringify([{ rowGroup: "Men's Wear", category: "O'Neill", subCategory: "" }]);
    const page = await renderTable({ thereof: drill, partof: drill });
    const rows = bodyRows(page);

    const thereof = rows.filter((r) => hasClass(r, "ofit")).map((r) => cellTexts(r)[0]);
    expect(thereof).toHaveLength(2);
    expect(thereof.some((text) => text.includes("Shirts"))).toBe(true);
    expect(thereof.some((text) => text.includes("Shorts"))).toBe(true);
    expect(rows.filter((r) => hasClass(r, "partof"))).toHaveLength(1);
    expect(errors(page).some((e) => e.id === "ERR_sql")).toBe(false);
  });

  it("keeps an apostrophe in the total title", async () => {
    const page = await renderTable({ "sum-title": "Men's total" });

    const totalRow = bodyRows(page)
      .filter((r) => hasClass(r, "sum"))
      .at(-1);
    expect(cellTexts(totalRow)[0]).toBe("Men's total");
  });

  it("builds the REST row of limit for row groups with an apostrophe", async () => {
    getStores(null).db.db.tables["sqlLimitDs"] = {
      data: [
        row("Men's Wear", 0, "O'Neill", "", 10),
        row("Men's Wear", 0, "Levi's", "", 20),
        row(payloadGroup, 1, "Toys", "", 7),
        row(payloadGroup, 1, "Games", "", 3),
      ],
    };
    const page = await renderTable({ datasets: "sqlLimitDs", limit: "1" });

    expect(bodyRows(page).filter((r) => cellTexts(r)[0] === ".REST")).toHaveLength(2);
    expect(errors(page).some((e) => e.id === "ERR_sql")).toBe(false);
    expect(pwned()).toBeUndefined();
  });

  it.each([
    ["a scenario that is not an identifier", { scenarios: "ac1,ac 1" }, 'invalid identifier "ac 1"'],
    [
      "a columnthereof key that is not an identifier",
      { columnthereof: '[{"scenario":"ac1+0","name":"DE","subGroups":[]}]' },
      'invalid identifier "ac1+0"',
    ],
    ["a query that AlaSQL rejects", { scenarios: "ac1,from" }, "Parse error"],
  ])("reports ERR_sql and renders no table for %s", async (_name, props, message) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await renderTable(props);
    consoleError.mockRestore();

    const error = errors(page).find((e) => e.id === "ERR_sql");
    expect(error?.type).toBe("error");
    expect(error?.message).toContain(message);
    expect(inner(page).shadowRoot.querySelector("table")).toBeNull();
  });

  it.each([
    ["double backticks", "1 = ``(globalThis.__pwned = 1)``"],
    ["backticks joined by a comment", "1 = `/**/`(globalThis.__pwned = 1)`/**/`"],
  ])("rejects a filter with %s: ERR_filter, no data, nothing runs", async (_name, filter) => {
    const page = await renderTable({ filter });

    expect(errors(page).find((e) => e.id === "ERR_filter")?.type).toBe("error");
    expect(inner(page).shadowRoot.querySelector(".empty-state")).not.toBeNull();
    expect(inner(page).shadowRoot.querySelector("table")).toBeNull();
    expect(pwned()).toBeUndefined();
  });

  it("applies a plain filter and reports nothing", async () => {
    const page = await renderTable({ filter: "category = 'Abidjan'" });

    expect(bodyRows(page).filter((r) => hasClass(r, "groupheader"))).toHaveLength(1);
    expect(errors(page).some((e) => e.id === "ERR_filter")).toBe(false);
  });

  it.each([
    ["a filter that AlaSQL cannot read", "category =", "Parse error"],
    ["a filter with an unknown function", "nofn(category) = 1", "nofn"],
  ])("reports ERR_sql and renders no table for %s", async (_name, filter, message) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await renderTable({ filter });
    consoleError.mockRestore();

    const error = errors(page).find((e) => e.id === "ERR_sql");
    expect(error?.type).toBe("error");
    expect(error?.message).toContain(message);
    // not "No Data": the data is there, the query is wrong
    expect(inner(page).shadowRoot.querySelector(".empty-state")).toBeNull();
    expect(inner(page).shadowRoot.querySelector("table")).toBeNull();
  });

  it("reports ERR_sql when the measure scale cannot be read from the data", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await renderTable({ filter: "category =", "measure-scale": "GREATEST" });
    consoleError.mockRestore();

    expect(errors(page).find((e) => e.id === "ERR_sql")?.type).toBe("error");
  });

  it.each([
    ["thereof", "ERR_thereof"],
    ["partof", "ERR_partof"],
    ["columnthereof", "ERR_categorythereof"],
  ])("renders with %s that is no JSON, and keeps the warning of the validator", async (prop, id) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    // a throw in render() would reject here
    const page = await renderTable({ [prop]: '[{"name": ' });
    consoleError.mockRestore();

    expect(errors(page).find((e) => e.id === id)?.type).toBe("warning");
    expect(inner(page).shadowRoot.querySelector("table")).not.toBeNull();
  });

  it("reports grouped and show-measure-scale under their own ids", async () => {
    const page = await renderTable({ grouped: "maybe", "show-measure-scale": "perhaps" });

    expect(errors(page).map((e) => e.id)).toEqual(expect.arrayContaining(["ERR_grouped", "ERR_showMeasureScale"]));
  });

  it("keeps the grouped item when show-measure-scale is valid", async () => {
    const page = await renderTable({ grouped: "maybe", "show-measure-scale": "true" });

    expect(errors(page).map((e) => e.id)).toContain("ERR_grouped");
  });

  it("shows no data and no error for a dataset that is not registered", async () => {
    const page = await renderTable({ datasets: "notLoadedYet", filter: "category = 'Abidjan'" });

    expect(errors(page).some((e) => e.id === "ERR_sql")).toBe(false);
    expect(inner(page).shadowRoot.querySelector(".empty-state")).not.toBeNull();
  });
});
