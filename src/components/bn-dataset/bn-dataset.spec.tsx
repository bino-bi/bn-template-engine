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

    // the MutationObserver is mocked, so hand the emptied body to the component directly
    page.rootInstance.sync("");
    expect(errors(page.root)).toEqual([]);
  });
});

describe("bn-dataset body and src", () => {
  const REMOTE = [{ category: "remote", ac1: 2 }];
  const realFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({ json: async () => REMOTE }));

  beforeEach(() => {
    fetchMock.mockClear();
    (global as any).fetch = fetchMock;
    db().tables["sales_src"] = { data: LOCAL };
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("reads a body that starts with a comment as SQL", async () => {
    await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="commented" datasources="sales_src">/* c */ SELECT * FROM sales_src</bn-dataset>`,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db().exec("SELECT * FROM commented")).toEqual(LOCAL);
  });

  it("does not fetch a body that looks like a URL", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="urlbody">https://example.com/sales.json</bn-dataset>`,
    });
    consoleError.mockRestore();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches src and ignores the body", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="remote" datasources="sales_src" src="/sales.json">SELECT * FROM sales_src</bn-dataset>`,
    });
    await page.waitForChanges();

    expect(fetchMock).toHaveBeenCalledWith("/sales.json", expect.anything());
    expect(db().exec("SELECT * FROM remote")).toEqual(REMOTE);
  });

  it("keeps the fetched rows on an upstream change when src is set after the body ran", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="late" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });
    // a statement compiled while the dataset is a view, as the consumers run it
    expect(db().exec("SELECT * FROM `late`")).toEqual(LOCAL);

    page.root.setAttribute("src", "/sales.json");
    await page.waitForChanges();
    expect(db().exec("SELECT * FROM `late`")).toEqual(REMOTE);

    getStores(null).db.notify("sales_src");
    expect(db().exec("SELECT * FROM `late`")).toEqual(REMOTE);
  });

  it("returns to the body when src is removed", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="switched" datasources="sales_src" src="/sales.json">SELECT * FROM sales_src</bn-dataset>`,
    });
    await page.waitForChanges();
    expect(db().exec("SELECT * FROM `switched`")).toEqual(REMOTE);

    page.root.removeAttribute("src");
    await page.waitForChanges();

    expect(db().exec("SELECT * FROM `switched`")).toEqual(LOCAL);
  });
});
