// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-table-renderer.spec.tsx.

// mock-doc has no MutationObserver. The fake stands in for the one of the withBodyObserver /
// withDatasource mixins and lets a spec report a change of the body.
import { installMutationObserverFake, notifyChildListChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

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
import { createStore } from "@stencil/store";
import { getStores } from "../../context/context-protocol";
import { createScopedDb } from "../../context/scopedDb";
import { ComponentRegister } from "../../utils/componentRegister";
import { ErrorItem } from "../../utils/withHasError";
import { Dataset } from "./bn-dataset";
import { Datasource } from "../bn-datasource/bn-datasource";

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
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => REMOTE }));

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

describe("bn-dataset rename and re-attach", () => {
  const STATIC = [{ category: "a", ac1: 1 }];
  const REMOTE = [{ category: "remote", ac1: 2 }];
  const realFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => REMOTE }));

  /** Rows of a table or view, `undefined` when the name is not registered. */
  const read = (name: string, database = db()): unknown => {
    try {
      return database.exec(`SELECT * FROM \`${name}\``);
    } catch (_e) {
      return undefined;
    }
  };
  const meta = (name: string): unknown => getStores(null).datasetsMeta.get(name);

  beforeEach(() => {
    fetchMock.mockClear();
    (global as any).fetch = fetchMock;
    db().tables["sales_src"] = { data: LOCAL };
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("moves a static dataset to the new name", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="st_old" static>${JSON.stringify(STATIC)}</bn-dataset>`,
    });
    expect(read("st_old")).toEqual(STATIC);
    expect(meta("st_old")).toMatchObject({ availableScenarios: ["ac1"] });
    const oldNameChanged = jest.fn();
    const unsubscribe = getStores(null).db.subscribe("st_old", oldNameChanged);

    page.root.setAttribute("name", "st_new");
    await page.waitForChanges();
    unsubscribe();

    expect(read("st_new")).toEqual(STATIC);
    expect(meta("st_new")).toMatchObject({ availableScenarios: ["ac1"] });
    expect(read("st_old")).toBeUndefined();
    expect(meta("st_old")).toBeNull();
    expect(oldNameChanged).toHaveBeenCalled();
  });

  it("moves a SQL dataset to the new name", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="sql_old" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });
    expect(read("sql_old")).toEqual(LOCAL);

    page.root.setAttribute("name", "sql_new");
    await page.waitForChanges();

    expect(read("sql_new")).toEqual(LOCAL);
    expect(read("sql_old")).toBeUndefined();
    expect(meta("sql_old")).toBeNull();
  });

  it("moves a src dataset without waiting for a poll", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="src_old" src="/sales.json"></bn-dataset>`,
    });
    await page.waitForChanges();
    expect(read("src_old")).toEqual(REMOTE);

    page.root.setAttribute("name", "src_new");
    await page.waitForChanges();

    expect(read("src_new")).toEqual(REMOTE);
    // the fetch mock returns the same array again: the meta must still be written for the new name
    expect(meta("src_new")).toMatchObject({ availableScenarios: ["ac1"] });
    expect(read("src_old")).toBeUndefined();
    expect(meta("src_old")).toBeNull();
  });

  it("registers a static dataset again after re-attach", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="st_again" static>${JSON.stringify(STATIC)}</bn-dataset>`,
    });
    const el = page.root;

    el.remove();
    await page.waitForChanges();
    const whileRemoved = { rows: read("st_again"), meta: meta("st_again") };

    page.body.appendChild(el);
    await page.waitForChanges();
    expect(read("st_again")).toEqual(STATIC);
    expect(meta("st_again")).toMatchObject({ availableScenarios: ["ac1"] });
    expect(whileRemoved).toEqual({ rows: undefined, meta: null });
  });

  it("registers a SQL view again after re-attach", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="sql_again" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });
    const el = page.root;

    el.remove();
    await page.waitForChanges();
    expect(read("sql_again")).toBeUndefined();

    page.body.appendChild(el);
    await page.waitForChanges();
    expect(read("sql_again")).toEqual(LOCAL);
  });

  it("fetches again and restarts polling after re-attach", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="src_again" src="/sales.json" refresh-interval="60"></bn-dataset>`,
    });
    await page.waitForChanges();
    const el = page.root;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    el.remove();
    await page.waitForChanges();
    expect(page.rootInstance.pollTimerId).toBeNull();

    page.body.appendChild(el);
    await page.waitForChanges();
    const attached = {
      rows: read("src_again"),
      meta: meta("src_again"),
      polling: page.rootInstance.pollTimerId !== null,
    };
    // stops the timer
    el.remove();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(attached).toMatchObject({ rows: REMOTE, meta: { availableScenarios: ["ac1"] }, polling: true });
    expect(read("src_again")).toBeUndefined();
  });

  it("loads into the context it is moved to", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="st_moved" static>${JSON.stringify(STATIC)}</bn-dataset>`,
    });
    const el = page.root;
    const oldDb = db();
    const other = { db: createScopedDb(), datasetsMeta: createStore({}) };

    el.remove();
    await page.waitForChanges();
    const getStoresSpy = jest.spyOn(jest.requireMock("../../context/context-protocol"), "getStores");
    getStoresSpy.mockReturnValue(other);
    page.body.appendChild(el);
    await page.waitForChanges();
    getStoresSpy.mockRestore();

    expect(read("st_moved", other.db.db)).toEqual(STATIC);
    expect(read("st_moved", oldDb)).toBeUndefined();
  });

  it("keeps both datasets when two of them swap names", async () => {
    const A = [{ category: "A", ac1: 1 }];
    const B = [{ category: "B", ac1: 2 }];
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset id="a" name="sw_x" static>${JSON.stringify(A)}</bn-dataset><bn-dataset id="b" name="sw_y" static>${JSON.stringify(B)}</bn-dataset>`,
    });

    page.body.querySelector("#a").setAttribute("name", "sw_y");
    page.body.querySelector("#b").setAttribute("name", "sw_x");
    await page.waitForChanges();

    expect(read("sw_y")).toEqual(A);
    expect(read("sw_x")).toEqual(B);
    expect(meta("sw_y")).toMatchObject({ availableScenarios: ["ac1"] });
  });

  it("leaves a name alone that another dataset took after the removal", async () => {
    const TAKEN = [{ category: "b", ac1: 2 }];
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="dt_dup" static>${JSON.stringify(STATIC)}</bn-dataset>`,
    });
    const removed = page.root;
    removed.remove();
    await page.waitForChanges();
    page.body.innerHTML = `<bn-dataset name="dt_dup" static>${JSON.stringify(TAKEN)}</bn-dataset>`;
    await page.waitForChanges();
    expect(read("dt_dup")).toEqual(TAKEN);

    removed.setAttribute("name", "dt_other");
    await page.waitForChanges();

    expect(read("dt_dup")).toEqual(TAKEN);
    expect(meta("dt_dup")).toMatchObject({ availableScenarios: ["ac1"] });
    expect(read("dt_other")).toBeUndefined();
  });

  it("registers nothing while the name is empty", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="no_name" src="/sales.json"></bn-dataset>`,
    });
    await page.waitForChanges();

    page.root.setAttribute("name", "");
    await page.waitForChanges();
    page.root.removeAttribute("name");
    await page.waitForChanges();

    expect(Object.keys(db().tables)).not.toContain("");
    expect(Object.keys(db().tables)).not.toContain("null");
    expect(read("no_name")).toBeUndefined();
  });

  describe("a SQL dataset whose source goes away", () => {
    const ROWS = [
      { category: "Alpha", ac1: 10 },
      { category: "Beta", ac1: 20 },
    ];
    const sqlError = (host: Element): ErrorItem | undefined => errors(host).find((e) => e.id === "ERR_sql");

    /** Mounts the source and the dataset, plus a consumer that reads the dataset on every notify, as a table does. */
    const mount = async (source: string, dataset: string) => {
      const page = await newSpecPage({
        components: [Datasource, Dataset],
        html: `<bn-datasource name="${source}">${JSON.stringify(ROWS)}</bn-datasource><bn-dataset name="${dataset}" datasources="${source}">SELECT * FROM ${source}</bn-dataset>`,
      });
      const consumer = { rows: read(dataset) ?? [], notified: 0 };
      getStores(null).db.subscribe(dataset, () => {
        consumer.rows = read(dataset) ?? [];
        consumer.notified++;
      });
      return {
        page,
        consumer,
        source: page.body.querySelector("bn-datasource"),
        dataset: page.body.querySelector("bn-dataset"),
      };
    };

    it("delivers no rows and sets ERR_sql when the source is renamed, and recovers when the name is back", async () => {
      const { page, consumer, source, dataset } = await mount("rn_src", "rn_ds");
      expect(consumer.rows).toEqual(ROWS);

      source.setAttribute("name", "rn_other");
      await page.waitForChanges();
      const renamed = {
        rows: consumer.rows,
        notified: consumer.notified,
        error: sqlError(dataset),
        meta: meta("rn_ds"),
      };

      source.setAttribute("name", "rn_src");
      await page.waitForChanges();

      expect(renamed.rows).toEqual([]);
      expect(renamed.notified).toBeGreaterThan(0);
      expect(renamed.error).toMatchObject({ type: "error", message: expect.stringMatching(/^SQL: /) });
      expect(renamed.meta).toMatchObject({ availableScenarios: [] });
      expect(consumer.rows).toEqual(ROWS);
      expect(sqlError(dataset)).toBeUndefined();
      expect(meta("rn_ds")).toMatchObject({ availableScenarios: ["ac1"] });
    });

    it("delivers no rows and sets ERR_sql when the source is removed, and recovers when it is attached again", async () => {
      const { page, consumer, source, dataset } = await mount("rm_src", "rm_ds");

      source.remove();
      await page.waitForChanges();
      const removed = { rows: consumer.rows, error: sqlError(dataset) };

      page.body.appendChild(source);
      await page.waitForChanges();

      expect(removed.rows).toEqual([]);
      expect(removed.error?.type).toBe("error");
      expect(consumer.rows).toEqual(ROWS);
      expect(sqlError(dataset)).toBeUndefined();
    });

    it("stays silent while the source has not been registered for the first time", async () => {
      const page = await newSpecPage({
        components: [Datasource, Dataset],
        html: `<bn-dataset name="early_ds" datasources="early_src">SELECT * FROM early_src</bn-dataset>`,
      });
      const early = { errors: errors(page.root), meta: meta("early_ds") };

      page.body.insertAdjacentHTML(
        "beforeend",
        `<bn-datasource name="early_src">${JSON.stringify(ROWS)}</bn-datasource>`,
      );
      await page.waitForChanges();

      expect(early).toEqual({ errors: [], meta: undefined });
      expect(read("early_ds")).toEqual(ROWS);
      expect(errors(page.root)).toEqual([]);
    });
  });

  it("serves the fetched rows to a statement compiled for the view after re-attach with src", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="vw_back" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });
    const el = page.root;
    // a statement compiled while the dataset is a view, as the consumers run it
    expect(db().exec("SELECT * FROM `vw_back`")).toEqual(LOCAL);

    el.remove();
    await page.waitForChanges();
    el.setAttribute("src", "/sales.json");
    page.body.appendChild(el);
    await page.waitForChanges();

    expect(db().exec("SELECT * FROM `vw_back`")).toEqual(REMOTE);
  });

  it("serves the static rows to a statement compiled for the view of a renamed SQL dataset", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="mo_a" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`,
    });

    page.root.setAttribute("name", "mo_b");
    await page.waitForChanges();
    expect(db().exec("SELECT * FROM `mo_b`")).toEqual(LOCAL);

    page.root.setAttribute("static", "true");
    await page.waitForChanges();
    page.rootInstance.sync(JSON.stringify(STATIC));

    expect(db().exec("SELECT * FROM `mo_b`")).toEqual(STATIC);
  });
});

describe("bn-dataset readiness", () => {
  const REMOTE = [{ category: "remote", ac1: 2 }];
  const realFetch = global.fetch;
  const running = () => ComponentRegister.componentRegisterStatus().running;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("stays RUNNING until the first src request has settled", async () => {
    const before = running();
    let respond: (response: unknown) => void;
    (global as any).fetch = jest.fn(() => new Promise((resolve) => (respond = resolve)));

    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="rd_first" src="/sales.json"></bn-dataset>`,
    });
    await page.waitForChanges();
    expect(running()).toBe(before + 1);

    respond({ ok: true, json: async () => REMOTE });
    await page.waitForChanges();
    expect(running()).toBe(before);
    expect(db().exec("SELECT * FROM `rd_first`")).toEqual(REMOTE);
  });

  it("a poll tick does not cancel the first src request", async () => {
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
      components: [Dataset],
      html: `<bn-dataset name="rd_slow" src="/sales.json" refresh-interval="0.05"></bn-dataset>`,
    });
    // two poll ticks pass while the first request is pending
    await new Promise((resolve) => setTimeout(resolve, 130));
    const pending = { requests: fetchMock.mock.calls.length, running: running() };

    respond[0]({ ok: true, json: async () => REMOTE });
    await page.waitForChanges();
    const loaded = { running: running(), table: db().tables["rd_slow"] };

    await new Promise((resolve) => setTimeout(resolve, 130));
    const polled = fetchMock.mock.calls.length;
    // stops the timer
    page.root.remove();

    expect(pending).toEqual({ requests: 1, running: before + 1 });
    expect(loaded).toEqual({ running: before, table: { data: REMOTE } });
    expect(polled).toBeGreaterThan(1);
  });
});

describe("bn-dataset failures", () => {
  const realFetch = global.fetch;
  const ids = (host: Element): string[] => errors(host).map((e) => e.id);
  // @ts-ignore - the mock store is typed per dataset name
  const meta = (name: string): unknown => getStores(null).datasetsMeta.get(name);

  afterEach(() => {
    global.fetch = realFetch;
  });

  // one name per case: mock-doc never disconnects an element with a body, so it keeps its name
  it.each([
    ["JSON that cannot be parsed", "fail_parse", `[{"category":`],
    ["JSON that is not an array", "fail_shape", `{"category":"local"}`],
  ])("reports ERR_body for a static body with %s", async (_name, name, body) => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="${name}" static>${body}</bn-dataset>`,
    });

    expect(errors(page.root).map((e) => [e.id, e.type])).toEqual([["ERR_body", "error"]]);
    expect(db().exec(`SELECT * FROM ${name}`)).toEqual([]);
  });

  it("reports ERR_body for a compressed body that cannot be decoded", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="fail_gzip" static raw="false">abc:not-gzip</bn-dataset>`,
    });

    expect(ids(page.root)).toEqual(["ERR_body"]);
  });

  it.each([
    ["an empty body", "fail_empty1", ``, ``],
    ["an empty compressed body", "fail_empty2", ` raw="false"`, ``],
    ["a body of blanks", "fail_empty3", ``, `\n  `],
    ["the JSON value null", "fail_empty4", ``, `null`],
  ])(
    "registers a static dataset with %s as a table without rows, and reports nothing",
    async (_n, name, attr, body) => {
      const page = await newSpecPage({
        components: [Dataset],
        html: `<bn-dataset name="${name}" static${attr}>${body}</bn-dataset>`,
      });

      expect(errors(page.root)).toEqual([]);
      // registered: a view on top of it must not fail with "Table does not exist"
      expect(db().exec(`SELECT * FROM ${name}`)).toEqual([]);
    },
  );

  it("drops ERR_body when the body that could not be decoded is valid again", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="fail_back" static>[{"category":"a"}]</bn-dataset>`,
    });
    const sync = (body: string) => (page.rootInstance as { sync(body: string): void }).sync(body);

    page.root.setAttribute("raw", "false");
    await page.waitForChanges();
    sync("abc:not-gzip");
    expect(ids(page.root)).toEqual(["ERR_body"]);

    page.root.setAttribute("raw", "true");
    await page.waitForChanges();
    sync(`[{"category":"a"}]`);
    expect(ids(page.root)).toEqual([]);
  });

  it.each<[string, () => Promise<unknown>, string]>([
    [
      "a request that fails",
      async () => {
        throw new Error("offline");
      },
      "offline",
    ],
    ["an HTTP error", async () => ({ ok: false, status: 500, json: async () => ({}) }), "HTTP 500"],
    [
      "a response that is not an array",
      async () => ({ ok: true, json: async () => ({ rows: [] }) }),
      "not a JSON array",
    ],
  ])("reports ERR_src for %s and registers no rows", async (_name, fetchImpl, message) => {
    (global as any).fetch = jest.fn(fetchImpl);

    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset name="fail_src" src="/rows.json"></bn-dataset>`,
    });
    await page.waitForChanges();

    const error = errors(page.root).find((e) => e.id === "ERR_src");
    expect(error?.type).toBe("error");
    expect(error?.message).toContain(message);
    expect(db().exec("SELECT * FROM fail_src")).toEqual([]);
  });

  it("reports a dataset that has the name of its datasource, on both", async () => {
    const page = await newSpecPage({
      components: [Datasource, Dataset],
      html:
        `<bn-datasource name="fail_same">${JSON.stringify(LOCAL)}</bn-datasource>` +
        `<bn-dataset name="fail_same" datasources="fail_same">SELECT * FROM fail_same</bn-dataset>`,
    });

    const source = page.body.querySelector("bn-datasource");
    const dataset = page.body.querySelector("bn-dataset");
    expect(ids(source)).toContain("ERR_name");
    expect(errors(dataset).find((e) => e.id === "ERR_name")?.type).toBe("error");
  });

  it("has its rows back when the dataset that shared its name leaves", async () => {
    const A = [{ category: "a", ac1: 1 }];
    const B = [{ category: "b", ac1: 2 }];
    const page = await newSpecPage({
      components: [Dataset],
      html:
        `<bn-dataset id="a" name="fail_back2" static>${JSON.stringify(A)}</bn-dataset>` +
        `<bn-dataset id="b" name="fail_back2" static>${JSON.stringify(B)}</bn-dataset>`,
    });
    const a = page.body.querySelector("#a");
    // the second one registered last
    expect(db().exec("SELECT * FROM fail_back2")).toEqual(B);
    expect(ids(a)).toEqual(["ERR_name"]);

    page.body.querySelector("#b").remove();
    await page.waitForChanges();

    // no item any more, so the name must hold the rows of a again, not a deleted table
    expect(ids(a)).toEqual([]);
    expect(db().exec("SELECT * FROM fail_back2")).toEqual(A);
  });

  it("gives readers the rows of the remaining producer when a SQL dataset with the same name leaves", async () => {
    const A = [{ category: "a", ac1: 1 }];
    db().tables["fail_cache_src"] = { data: [{ category: "view", ac1: 9 }] };
    const page = await newSpecPage({
      components: [Dataset],
      html:
        `<bn-dataset id="a" name="fail_cache" static>${JSON.stringify(A)}</bn-dataset>` +
        `<bn-dataset id="b" name="fail_cache" datasources="fail_cache_src">SELECT * FROM fail_cache_src</bn-dataset>`,
    });
    // a reader that queries when the name changes, like every visual does. Its statement was compiled for the view.
    const read = () => db().exec("SELECT * FROM `fail_cache`");
    expect(read()).toEqual([{ category: "view", ac1: 9 }]);
    const seen: unknown[] = [];
    const unsubscribe = getStores(null).db.subscribe("fail_cache", () => {
      try {
        seen.push(read());
      } catch (e) {
        seen.push(String(e));
      }
    });

    page.body.querySelector("#b").remove();
    await page.waitForChanges();
    unsubscribe();

    expect(seen[seen.length - 1]).toEqual(A);
  });

  it("gives readers the rows of the remaining producer when the SQL of the leaving dataset was broken last", async () => {
    const A = [{ category: "a", ac1: 1 }];
    db().tables["fail_broken_src"] = { data: [{ category: "view", ac1: 9 }] };
    const page = await newSpecPage({
      components: [Dataset],
      html:
        `<bn-dataset id="a" name="fail_broken" static>${JSON.stringify(A)}</bn-dataset>` +
        `<bn-dataset id="b" name="fail_broken" datasources="fail_broken_src">SELECT * FROM fail_broken_src</bn-dataset>`,
    });
    const read = () => db().exec("SELECT * FROM `fail_broken`");
    // compiled for the view
    expect(read()).toEqual([{ category: "view", ac1: 9 }]);

    // the body stops being SQL: the view is dropped and cannot be created again
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const b = page.body.querySelector("#b");
    b.textContent = "SELECT FROM WHERE";
    notifyChildListChange(b);
    consoleError.mockRestore();
    expect(ids(b)).toEqual(["ERR_name", "ERR_sql"]);

    b.remove();
    await page.waitForChanges();

    expect(read()).toEqual(A);
  });

  it("keeps a dataset on top of the name working when the name changes from a view to a table", async () => {
    const SOURCE = [{ category: "table", ac1: 1 }];
    const page = await newSpecPage({
      components: [Datasource, Dataset],
      html:
        `<bn-datasource name="fail_kind">${JSON.stringify(SOURCE)}</bn-datasource>` +
        `<bn-dataset id="clash" name="fail_kind" datasources="fail_kind_other">SELECT 'view' AS category, 2 AS ac1</bn-dataset>` +
        `<bn-dataset id="top" name="fail_kind_top" datasources="fail_kind">SELECT * FROM fail_kind</bn-dataset>`,
    });
    // the dataset on top first read the name while it was the view of the clashing dataset
    expect(db().exec("SELECT * FROM fail_kind_top")).toEqual([{ category: "view", ac1: 2 }]);

    page.body.querySelector("#clash").remove();
    await page.waitForChanges();

    // alasql binds a source as view or table when it compiles a view. The name is a table now.
    expect(db().exec("SELECT * FROM fail_kind_top")).toEqual(SOURCE);
    expect(ids(page.body.querySelector("#top"))).toEqual([]);
  });

  it("removes its meta when it leaves and a datasource keeps the name", async () => {
    const page = await newSpecPage({
      components: [Datasource, Dataset],
      html:
        `<bn-datasource name="fail_meta">[{"category":"a","ac1":1}]</bn-datasource>` +
        `<bn-dataset id="d" name="fail_meta" static>[{"category":"a","ac1":1,"pl1":2}]</bn-dataset>`,
    });
    expect(meta("fail_meta")).toMatchObject({ availableScenarios: ["ac1", "pl1"] });

    page.body.querySelector("#d").remove();
    await page.waitForChanges();

    // a datasource writes no meta: the one of the dataset that left must not stay
    expect(meta("fail_meta")).toBeNull();
    expect(db().exec("SELECT * FROM fail_meta")).toEqual([{ category: "a", ac1: 1 }]);
  });

  it("clears ERR_name when two datasets that swap names are done", async () => {
    const page = await newSpecPage({
      components: [Dataset],
      html: `<bn-dataset id="a" name="fail_x" static>[]</bn-dataset><bn-dataset id="b" name="fail_y" static>[]</bn-dataset>`,
    });
    const a = page.body.querySelector("#a");
    const b = page.body.querySelector("#b");

    a.setAttribute("name", "fail_y");
    await page.waitForChanges();
    expect(ids(a)).toEqual(["ERR_name"]);
    expect(ids(b)).toEqual(["ERR_name"]);

    b.setAttribute("name", "fail_x");
    await page.waitForChanges();
    expect(ids(a)).toEqual([]);
    expect(ids(b)).toEqual([]);
  });
});
