// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as ibcs-table.spec.tsx.

// Mock MutationObserver for the withBodyObserver mixin
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
  const { createScopedDb } = require("../../context/scopedDb");
  const mockStores = { db: createScopedDb() };
  return { getStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { Datasource } from "./bn-datasource";

const REMOTE = [{ category: "remote" }];
const rows = (name: string): unknown[] => (getStores(null).db.db.tables[name] as { data: unknown[] }).data;

describe("bn-datasource body and src", () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({ json: async () => REMOTE }));

  beforeEach(() => {
    fetchMock.mockClear();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("reads the body as inline JSON", async () => {
    await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="inline">[{"category":"local"}]</bn-datasource>`,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows("inline")).toEqual([{ category: "local" }]);
  });

  it("does not fetch a body that looks like a URL", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="urlbody">https://example.com/rows.json</bn-datasource>`,
    });
    consoleError.mockRestore();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows("urlbody")).toEqual([]);
  });

  it("fetches src and ignores the body", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="remote_src" src="/rows.json">[{"category":"local"}]</bn-datasource>`,
    });
    await page.waitForChanges();

    expect(fetchMock).toHaveBeenCalledWith("/rows.json", expect.anything());
    expect(rows("remote_src")).toEqual(REMOTE);
  });
});
