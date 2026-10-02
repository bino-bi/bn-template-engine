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
  return { getStores: () => mockStores, clearStoresCache: jest.fn() };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores, clearStoresCache } from "../../context/context-protocol";
import { createScopedDb } from "../../context/scopedDb";
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

describe("bn-datasource rename and re-attach", () => {
  const INLINE = [{ category: "a" }];
  const tables = () => getStores(null).db.db.tables as Record<string, { data: unknown[] } | undefined>;
  const realFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({ json: async () => REMOTE }));

  beforeEach(() => {
    fetchMock.mockClear();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("moves the table to the new name", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="ds_old">${JSON.stringify(INLINE)}</bn-datasource>`,
    });
    expect(rows("ds_old")).toEqual(INLINE);
    const oldNameChanged = jest.fn();
    const unsubscribe = getStores(null).db.subscribe("ds_old", oldNameChanged);

    page.root.setAttribute("name", "ds_new");
    await page.waitForChanges();
    unsubscribe();

    expect(tables()["ds_new"]?.data).toEqual(INLINE);
    expect(tables()["ds_old"]).toBeUndefined();
    expect(oldNameChanged).toHaveBeenCalled();
  });

  it("loads again after re-attach", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="ds_again">${JSON.stringify(INLINE)}</bn-datasource>`,
    });
    const el = page.root;

    el.remove();
    await page.waitForChanges();
    expect(tables()["ds_again"]).toBeUndefined();

    page.body.appendChild(el);
    await page.waitForChanges();
    expect(tables()["ds_again"]?.data).toEqual(INLINE);
  });

  it("fetches again after re-attach", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="ds_src_again" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();
    const el = page.root;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    el.remove();
    await page.waitForChanges();
    page.body.appendChild(el);
    await page.waitForChanges();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tables()["ds_src_again"]?.data).toEqual(REMOTE);
  });

  it("loads into the context it is moved to", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="ds_moved">${JSON.stringify(INLINE)}</bn-datasource>`,
    });
    const el = page.root;
    const other = { db: createScopedDb() };

    el.remove();
    await page.waitForChanges();
    expect(clearStoresCache).toHaveBeenCalledWith(el);
    const getStoresSpy = jest.spyOn(jest.requireMock("../../context/context-protocol"), "getStores");
    getStoresSpy.mockReturnValue(other);
    page.body.appendChild(el);
    await page.waitForChanges();
    getStoresSpy.mockRestore();

    expect((other.db.db.tables["ds_moved"] as { data: unknown[] }).data).toEqual(INLINE);
    expect(tables()["ds_moved"]).toBeUndefined();
  });

  it("keeps both tables when two datasources swap names", async () => {
    const A = [{ category: "A" }];
    const B = [{ category: "B" }];
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource id="a" name="dsw_x">${JSON.stringify(A)}</bn-datasource><bn-datasource id="b" name="dsw_y">${JSON.stringify(B)}</bn-datasource>`,
    });

    page.body.querySelector("#a").setAttribute("name", "dsw_y");
    page.body.querySelector("#b").setAttribute("name", "dsw_x");
    await page.waitForChanges();

    expect(tables()["dsw_y"]?.data).toEqual(A);
    expect(tables()["dsw_x"]?.data).toEqual(B);
  });

  it("leaves a name alone that another datasource took after the removal", async () => {
    const TAKEN = [{ category: "b" }];
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="dd_dup">${JSON.stringify(INLINE)}</bn-datasource>`,
    });
    const removed = page.root;
    removed.remove();
    await page.waitForChanges();
    page.body.innerHTML = `<bn-datasource name="dd_dup">${JSON.stringify(TAKEN)}</bn-datasource>`;
    await page.waitForChanges();

    removed.setAttribute("name", "dd_other");
    await page.waitForChanges();

    expect(tables()["dd_dup"]?.data).toEqual(TAKEN);
    expect(tables()["dd_other"]).toBeUndefined();
  });

  it("registers nothing while the name is empty", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="ds_no_name">${JSON.stringify(INLINE)}</bn-datasource>`,
    });

    page.root.removeAttribute("name");
    await page.waitForChanges();

    expect(Object.keys(tables())).not.toContain("null");
    expect(tables()["ds_no_name"]).toBeUndefined();
  });
});
