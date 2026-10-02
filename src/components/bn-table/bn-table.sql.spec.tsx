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

  it.each([
    ["a scenario that is not an identifier", "ac1,ac 1"],
    ["a query that AlaSQL rejects", "ac1,from"],
  ])("reports ERR_sql and renders no table for %s", async (_name, scenarios) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await renderTable({ scenarios });
    consoleError.mockRestore();

    expect(errors(page).find((e) => e.id === "ERR_sql")?.type).toBe("error");
    expect(inner(page).shadowRoot.querySelector("table")).toBeNull();
  });
});
