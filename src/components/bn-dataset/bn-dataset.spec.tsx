// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as ibcs-table.spec.tsx.

// Mock MutationObserver for the withBodyObserver / withDatasource mixins
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { createScopedDb } = require("../../context/scopedDb");
  const mockStores = { db: createScopedDb(), datasetsMeta: createStore({}) };
  return { getStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { ErrorItem } from "../../utils/withHasError";
import { Dataset } from "./bn-dataset";

const LOCAL = [{ category: "local", ac1: 1 }];
const db = () => getStores(null).db.db;
const errors = (host: Element): ErrorItem[] => JSON.parse(host.getAttribute("has-error") ?? "[]");

describe("bn-dataset SQL body", () => {
  beforeAll(() => {
    db().tables["sales_src"] = { data: LOCAL };
  });

  it("registers the body as a view", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="plain" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });

    expect(db().exec("SELECT * FROM plain")).toEqual(LOCAL);
    expect(errors(page.root)).toEqual([]);
  });

  it.each([
    ["double backticks", "SELECT 1 AS a; ``globalThis.__pwned = 1``"],
    ["backticks joined by a comment", "SELECT `/**/`globalThis.__pwned = 1`/**/` AS a FROM sales_src"],
  ])("rejects a body with %s: ERR_sql, nothing runs", async (_name, body) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="rejected" datasources="sales_src">${body}</bn-dataset>`,
    });
    consoleError.mockRestore();

    expect(errors(page.root).find((e) => e.id === "ERR_sql")?.type).toBe("error");
    // mock-doc's window and globalThis are different objects
    expect((globalThis as any).__pwned).toBeUndefined();
    expect((window as any).__pwned).toBeUndefined();
  });

  it("reports SQL that AlaSQL cannot parse as ERR_sql", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="broken" datasources="sales_src">SELECT FROM WHERE</bn-dataset>`,
    });
    consoleError.mockRestore();

    expect(errors(page.root).find((e) => e.id === "ERR_sql")?.type).toBe("error");
  });
});
