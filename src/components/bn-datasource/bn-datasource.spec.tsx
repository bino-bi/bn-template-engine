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
import { ComponentRegister } from "../../utils/componentRegister";
import { Datasource } from "./bn-datasource";

const REMOTE = [{ category: "remote" }];
const rows = (name: string): unknown[] => (getStores(null).db.db.tables[name] as { data: unknown[] }).data;

describe("bn-datasource body and src", () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => REMOTE }));

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
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => REMOTE }));

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

describe("bn-datasource readiness", () => {
  const realFetch = global.fetch;
  // the register is shared by all tests of this file, so every test compares against its own baseline
  const running = () => ComponentRegister.componentRegisterStatus().running;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("stays RUNNING until the first request has settled", async () => {
    const before = running();
    let respond: (response: unknown) => void;
    (global as any).fetch = jest.fn(() => new Promise((resolve) => (respond = resolve)));

    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_first" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();
    expect(running()).toBe(before + 1);

    respond({ ok: true, json: async () => REMOTE });
    await page.waitForChanges();
    expect(running()).toBe(before);
    expect(rows("rd_first")).toEqual(REMOTE);
  });

  it("releases after a failed request", async () => {
    const before = running();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    (global as any).fetch = jest.fn(async () => {
      throw new Error("offline");
    });

    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_failed" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();
    consoleError.mockRestore();

    expect(running()).toBe(before);
    expect(rows("rd_failed")).toEqual([]);
  });

  it("releases on disconnect while the request is pending", async () => {
    const before = running();
    (global as any).fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_removed" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();

    page.root.remove();
    await page.waitForChanges();

    expect(running()).toBe(before);
  });

  it("does not count as rendering after it is removed and attached again", async () => {
    const before = running();
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_again">[{"category":"local"}]</bn-datasource>`,
    });
    const el = page.root;

    el.remove();
    await page.waitForChanges();
    page.body.appendChild(el);
    await page.waitForChanges();

    expect(running()).toBe(before);
    expect(rows("rd_again")).toEqual([{ category: "local" }]);
  });

  it("a poll tick does not cancel the first request", async () => {
    const before = running();
    const respond: Array<(response: unknown) => void> = [];
    const fetchMock = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          respond.push(resolve);
          init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    (global as any).fetch = fetchMock;

    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_slow" src="/rows.json" interval="0.05"></bn-datasource>`,
    });
    // two poll ticks pass while the first request is pending
    await new Promise((resolve) => setTimeout(resolve, 130));
    const pending = { requests: fetchMock.mock.calls.length, running: running() };

    respond[0]({ ok: true, json: async () => REMOTE });
    await page.waitForChanges();
    const loaded = { running: running(), table: getStores(null).db.db.tables["rd_slow"] };

    await new Promise((resolve) => setTimeout(resolve, 130));
    const polled = fetchMock.mock.calls.length;
    // stops the timer
    page.root.remove();

    expect(pending).toEqual({ requests: 1, running: before + 1 });
    expect(loaded).toEqual({ running: before, table: { data: REMOTE } });
    expect(polled).toBeGreaterThan(1);
  });

  it("a polling request does not hold readiness", async () => {
    const before = running();
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => REMOTE }));
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="rd_polled" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();
    expect(rows("rd_polled")).toEqual(REMOTE);

    // what the interval timer calls
    (global as any).fetch = jest.fn(() => new Promise(() => {}));
    page.rootInstance.fetchAndStore("/rows.json");
    await page.waitForChanges();

    expect(running()).toBe(before);
  });
});

describe("bn-datasource failures", () => {
  const realFetch = global.fetch;
  const errors = (host: Element): { id: string; type: string; message: string }[] =>
    JSON.parse(host.getAttribute("has-error") ?? "[]");

  afterEach(() => {
    global.fetch = realFetch;
  });

  // one name per case: mock-doc never disconnects an element with a body, so it keeps its name
  it.each([
    ["JSON that cannot be parsed", "fail_parse", `[{"category":`],
    ["JSON that is not an array", "fail_shape", `{"category":"local"}`],
  ])("reports ERR_body for %s and registers no rows", async (_name, name, body) => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="${name}">${body}</bn-datasource>`,
    });

    expect(errors(page.root).map((e) => [e.id, e.type])).toEqual([["ERR_body", "error"]]);
    expect(rows(name)).toEqual([]);
  });

  it("reports ERR_body for a compressed body that cannot be decoded", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="fail_gzip" raw="false">abc:not-gzip</bn-datasource>`,
    });

    expect(errors(page.root).map((e) => e.id)).toEqual(["ERR_body"]);
  });

  it.each([
    ["raw", ""],
    ["compressed", ` raw="false"`],
  ])("reports nothing for an empty %s body", async (_name, attr) => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="fail_empty"${attr}></bn-datasource>`,
    });

    expect(errors(page.root)).toEqual([]);
    expect(rows("fail_empty")).toEqual([]);
  });

  it.each<[string, () => Promise<unknown>, string]>([
    [
      "a request that fails",
      async () => {
        throw new Error("offline");
      },
      "offline",
    ],
    ["an HTTP error", async () => ({ ok: false, status: 404, json: async () => ({}) }), "HTTP 404"],
    [
      "a response that is not an array",
      async () => ({ ok: true, json: async () => ({ rows: [] }) }),
      "not a JSON array",
    ],
  ])("reports ERR_src for %s", async (_name, fetchImpl, message) => {
    (global as any).fetch = jest.fn(fetchImpl);

    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource name="fail_src" src="/rows.json"></bn-datasource>`,
    });
    await page.waitForChanges();

    const error = errors(page.root).find((e) => e.id === "ERR_src");
    expect(error?.type).toBe("error");
    expect(error?.message).toContain(message);
    expect(rows("fail_src")).toEqual([]);
  });

  it("reports a name that two datasources use, on both, until one of them leaves", async () => {
    const page = await newSpecPage({
      components: [Datasource],
      html: `<bn-datasource id="a" name="fail_dup">[]</bn-datasource><bn-datasource id="b" name="fail_dup">[]</bn-datasource>`,
    });
    const a = page.body.querySelector("#a");
    const b = page.body.querySelector("#b");

    expect(errors(a).map((e) => [e.id, e.type])).toEqual([["ERR_name", "error"]]);
    expect(errors(b).map((e) => e.id)).toEqual(["ERR_name"]);

    b.remove();
    await page.waitForChanges();

    expect(errors(a)).toEqual([]);
  });
});
