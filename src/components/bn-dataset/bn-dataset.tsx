import { Component, Prop, h, Host, Watch } from "@stencil/core";
import withDatasource from "../../utils/withDatasource";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { hasInlineJs } from "../../context/scopedDb";
import { calculateDatasetMeta } from "../../utils/datasetMetaCalculator";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { computeContentHash, decodeCompressedContent } from "../../utils/contentDecoder";
import { errorText } from "../../utils/queryError";

/**
 * Queries data from one or more `bn-datasource` entries via AlaSQL and
 * writes the result to the `datasets` store (+ computed `DatasetMeta`).
 *
 * The body content is observed via `withBodyObserver` and is always inline:
 * 1. **SQL** (default) - AlaSQL query against referenced `datasources`.
 * 2. **Static JSON** - set `static="true"` to bypass SQL and write the
 *    parsed body directly to the `datasets` store.
 *
 * Set the `src` attribute to fetch JSON from an HTTP endpoint instead and
 * write it to the `datasets` store. Set the `refresh-interval` attribute (in seconds)
 * to enable periodic re-fetching.
 */
@Component({
  tag: "bn-dataset",
  styleUrl: "bn-dataset.css",
})
export class Dataset {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private readonly holdStatus: (work: Promise<unknown>) => void;

  private stores!: ScopedStores;

  constructor() {
    this.holdStatus = withComponentStatus(this);
    this.errors = withHasError(this);
    // Datasources already live in the shared db; just re-execute when any upstream notifies.
    withDatasource(this, () => {
      this.executeQuery();
    });

    withBodyObserver(this, (data) => this.sync(data));
  }
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  /**
   * Commaseperated list of datasourcees
   * <br /><br />
   *  example: <br />
   *  ```source1,source2```
   *
   */
  @Prop() datasources: string = "";

  /**
   * When true, bypasses the AlaSQL query engine and parses the body
   * content as raw JSON, writing it directly to the datasets store.
   */
  @Prop() static: boolean = false;

  /**
   * When true (default), body content is plain text (SQL or JSON).
   * When false, body content is a compressed payload (`<hash>:<base64_gzip>`).
   */
  @Prop() raw: boolean = true;

  /**
   * Polling interval in **seconds** for `src`.
   * When set together with `src`, the component re-fetches data at this
   * interval. Has no effect for SQL, inline JSON or compressed content.
   * Set to `0` or leave unset to disable polling.
   */
  @Prop() refreshInterval: number = 0;

  /**
   * URL to fetch the dataset JSON from. When set, the body is ignored and
   * the fetched payload is written directly to the `datasets` store
   * (`static` and `raw` do not apply).
   */
  @Prop() src?: string;

  private query!: string;
  private lastBodyHash: string | null = null;
  /** The query text last used to (re)create the SQL view, so we only `CREATE VIEW` when it actually changes. */
  private lastViewQuery: string | null = null;
  private latestResult: unknown;
  /** The table or view object this element put into the db, to tell it from one another element registered under the same name. */
  private registered: unknown;
  /** Gives the name back that `claim` of the scoped db announced. */
  private releaseName: (() => void) | undefined;
  private nameShared = false;
  /** The meta this dataset wrote last, to tell it from the meta of another producer of the name. */
  private publishedMeta: unknown;

  /** The currently active URL (`null` when not in URL mode). */
  private currentUrl: string | null = null;
  /** Timer ID for the polling interval. */
  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** AbortController for cancelling in-flight fetch requests. */
  private abortController: AbortController | null = null;
  /** True until the first request for the current `src` has delivered. A poll tick is skipped meanwhile: it would cancel that request and release readiness with no data. */
  private firstLoadPending = false;

  /** Loads from `src` when it is set, otherwise from the inline body. */
  private sync(data: string): void {
    // a re-attached element may sit in another bn-context
    this.stores = getStores(this.element);
    if (!this.releaseName && this.name) this.releaseName = this.stores.db.claim(this.name, this.onNameShared);

    // --- URL mode ---
    if (this.src) {
      if (this.src === this.currentUrl) return;
      this.currentUrl = this.src;
      this.lastBodyHash = null;
      // an upstream notify must not rebuild the view from the body while src is set
      this.query = "";
      this.errors.remove("ERR_sql");
      this.errors.remove("ERR_body");
      this.firstLoadPending = true;
      this.holdStatus(this.fetchAndStore(this.src));
      this.startPolling();
      return;
    }

    // --- Leaving URL mode → clean up ---
    if (this.currentUrl !== null) {
      this.cancelInFlight();
      this.currentUrl = null;
    }
    this.errors.remove("ERR_src");

    let contentHash: string;
    let body: string;

    // an empty body is "no data given": nothing to decode
    if (!this.raw && this.static && data.trim() !== "") {
      try {
        const decoded = decodeCompressedContent(data);
        contentHash = decoded.hash;
        body = decoded.json;
      } catch (e) {
        this.errors.addOrReplace({ id: "ERR_body", type: "error", message: `Body: ${errorText(e)}` });
        // the body that was loaded before must be read again when it comes back
        this.lastBodyHash = null;
        return;
      }
    } else {
      contentHash = computeContentHash(data);
      body = data;
    }

    if (contentHash === this.lastBodyHash) return;
    this.lastBodyHash = contentHash;
    this.errors.remove("ERR_body");

    this.query = body;
    this.executeQuery();
  }

  executeQuery() {
    if (!this.stores) this.stores = getStores(this.element);
    if (!this.query) this.errors.remove("ERR_sql");
    if (!this.name) return;
    // nothing to run: a SQL dataset without a body, or a dataset that loads from src
    if (!this.query && (!this.static || this.currentUrl !== null)) return;

    const db = this.stores.db.db;
    let result: unknown;

    if (this.static) {
      // Static JSON: parse and register as a table in the shared db.
      try {
        // an empty body and the JSON value null are a dataset without rows
        result = this.query.trim() === "" ? [] : (JSON.parse(this.query) ?? []);
        if (Array.isArray(result)) {
          this.errors.remove("ERR_body");
        } else {
          this.errors.addOrReplace({ id: "ERR_body", type: "error", message: "Body: not a JSON array." });
        }
      } catch (e) {
        this.errors.addOrReplace({ id: "ERR_body", type: "error", message: `Body: ${errorText(e)}` });
        result = [];
      }
      db.tables[this.name] = { data: Array.isArray(result) ? result : [] };
      this.registered = db.tables[this.name];
      this.dropViewStatements();
      this.errors.remove("ERR_sql");
    } else {
      // SQL: register the dataset as a view in the shared db. Recreate only when the
      // query text changes; otherwise we just re-materialize so upstream data updates
      // flow through.
      if (this.lastViewQuery !== this.query) {
        // alasql tracks names in BOTH `db.tables` and `db.views`, and its
        // CREATE-conflict check looks at `db.tables`. Clean both locations
        // before creating so devtools "Edit as HTML" (which destroys the old
        // element and creates a new one without giving us a clean slate)
        // doesn't trip the "already exists" guard.
        try {
          db.exec(`DROP VIEW \`${this.name}\``);
        } catch (_e) {
          /* not registered as a view - fine */
        }
        if (db.tables[this.name] != null) {
          delete db.tables[this.name];
        }
        // @ts-ignore - views typing is loose
        if (db.views && db.views[this.name] != null) {
          // @ts-ignore
          delete db.views[this.name];
        }
        try {
          // checked before exec: in "SELECT ...; <inline js>" alasql would run the second statement right away
          if (hasInlineJs(this.query)) throw new Error("double backticks are not allowed.");
          db.exec(`CREATE VIEW \`${this.name}\` AS ${this.query}`);
          this.registered = db.tables[this.name];
          // alasql caches compiled statements per SQL text: one compiled while the name was a plain table reads no rows from a view
          db.resetSqlCache();
          this.lastViewQuery = this.query;
        } catch (e) {
          console.error("bn-dataset: failed to register SQL view", e, this.query);
          this.errors.addOrReplace({
            id: "ERR_sql",
            type: "error",
            message: `SQL: ${e instanceof Error ? e.message : e}`,
          });
          // the view is gone: a statement that was compiled for it must not meet a plain table under this name later
          db.resetSqlCache();
          this.lastViewQuery = null;
          result = [];
          this.publish(result);
          return;
        }
      } else {
        // alasql compiles the select of a view once and binds every source as view or as table.
        // A source that changed its kind since needs a new compile, which the next read does.
        // @ts-ignore - select is not in the public typings
        delete db.tables[this.name]?.select;
      }
      try {
        result = db.exec(`SELECT * FROM \`${this.name}\``);
        this.errors.remove("ERR_sql");
      } catch (e) {
        // Most common cause: an upstream datasource referenced by the view hasn't
        // been registered yet (HTML parse/connectedCallback race). `withDatasource`
        // re-fires executeQuery on every upstream notify, so we'll retry then.
        // Skip publish so we don't clobber datasetsMeta with empty data.
        if (this.latestResult === undefined) return;
        // after a load the source was renamed or removed: consumers must not keep the old rows
        this.errors.addOrReplace({
          id: "ERR_sql",
          type: "error",
          message: `SQL: ${e instanceof Error ? e.message : e}`,
        });
        this.publish([]);
        return;
      }
    }

    this.publish(result);
  }

  /** Notifies db subscribers and updates the derived `datasetsMeta` store. */
  private publish(result: unknown): void {
    if (this.latestResult === result) {
      // Even if the materialized object reference is unchanged, upstream data may have moved
      // (notably for views) - fire notify so consumers re-render against the fresh table state.
      this.stores.db.notify(this.name);
      return;
    }
    this.latestResult = result;
    this.stores.db.notify(this.name);
    this.publishedMeta = calculateDatasetMeta(result as Record<string, unknown>[]);
    // @ts-ignore - DatasetMeta is small derived metadata; kept as a @stencil/store per the plan.
    this.stores.datasetsMeta.set(this.name, this.publishedMeta);
  }

  @Watch("name")
  nameUpdated(_name: string, oldName: string) {
    this.unregister(oldName);
    if (this.name && this.element.isConnected) this.sync(this.element.textContent ?? "");
  }

  @Watch("refreshInterval")
  onIntervalChange(): void {
    if (this.currentUrl) {
      this.startPolling();
    }
  }

  @Watch("src")
  onSrcChange(): void {
    // a detached element must not fetch or poll; the body callback reads src again on connect
    if (this.element.isConnected) this.sync(this.element.textContent ?? "");
  }

  disconnectedCallback(): void {
    this.cancelInFlight();
    this.unregister(this.name);
  }

  /** Drops what is registered under `name` and forgets the loaded state, so the next sync loads again. */
  private unregister(name: string): void {
    const db = this.stores?.db?.db;
    // The name may come back as a plain table, which statements compiled for the view cannot read.
    // Before the release: a producer that shares the name loads and notifies its readers inside of it.
    if (db && this.lastViewQuery !== null) db.resetSqlCache();
    this.releaseName?.();
    this.releaseName = undefined;
    // another element may have taken the name since: its table, meta and consumers stay untouched
    const taken = db?.tables[name] != null && db.tables[name] !== this.registered;
    // a datasource that took the name writes no meta: the meta of this dataset must not stay for its rows
    // @ts-ignore - the store is typed per dataset name
    if (taken && this.publishedMeta !== undefined && this.stores.datasetsMeta.get(name) === this.publishedMeta) {
      // @ts-ignore
      this.stores.datasetsMeta.set(name, null);
    }
    this.publishedMeta = undefined;
    this.registered = undefined;
    this.lastBodyHash = null;
    this.lastViewQuery = null;
    this.currentUrl = null;
    this.latestResult = undefined;
    if (db && name && !taken) {
      try {
        db.exec(`DROP VIEW \`${name}\``);
      } catch (_e) {
        // not registered as a view - fine
      }
      if (db.tables[name] != null) {
        delete db.tables[name];
      }
      // @ts-ignore - views typing is loose
      if (db.views && db.views[name] != null) {
        // @ts-ignore
        delete db.views[name];
      }
      // the store has no delete; null is what consumers start with
      this.stores.datasetsMeta.set(name, null);
      this.stores.db.notify(name);
    }
  }

  /**
   * Fetches JSON from the given URL and stores the result as the dataset.
   * Cancels any in-flight request before starting a new one.
   */
  private async fetchAndStore(url: string): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    if (!this.stores) this.stores = getStores(this.element);

    try {
      const response = await fetch(url, { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // the JSON value null is a response without rows
      const json = (await response.json()) ?? [];
      if (!Array.isArray(json)) throw new Error("not a JSON array.");
      const db = this.stores.db.db;
      db.tables[this.name] = { data: json };
      this.registered = db.tables[this.name];
      this.dropViewStatements();
      this.errors.remove("ERR_src");
      this.publish(json);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      this.errors.addOrReplace({ id: "ERR_src", type: "error", message: `src: ${errorText(e)}` });
      const db = this.stores.db.db;
      db.tables[this.name] = { data: [] };
      this.registered = db.tables[this.name];
      this.dropViewStatements();
      this.publish([]);
    }
    this.firstLoadPending = false;
  }

  /** Two producers of one name overwrite each other's data. Both report it. */
  private readonly onNameShared = (shared: boolean): void => {
    const wasShared = this.nameShared;
    this.nameShared = shared;
    if (shared) {
      this.errors.addOrReplace({
        id: "ERR_name",
        type: "error",
        message: `name: "${this.name}" is used by more than one dataset or datasource.`,
      });
    } else {
      this.errors.remove("ERR_name");
      // the other producer may have written the name last: load the own data again
      if (wasShared) this.reload();
    }
  };

  /** Forgets what was loaded and loads again from `src` or the body. */
  private reload(): void {
    if (this.lastViewQuery !== null) this.stores.db.db.resetSqlCache();
    this.lastBodyHash = null;
    this.lastViewQuery = null;
    this.currentUrl = null;
    this.latestResult = undefined;
    this.sync(this.element.textContent ?? "");
  }

  /** After a view was replaced by a plain table: statements alasql compiled for the view cannot read the table. */
  private dropViewStatements(): void {
    if (this.lastViewQuery !== null) this.stores.db.db.resetSqlCache();
    this.lastViewQuery = null;
  }

  /** Stops the polling timer (does NOT touch any in-flight fetch). */
  private clearPollTimer(): void {
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  /** Stops the polling timer AND cancels any in-flight fetch. Use only when
   *  leaving URL mode entirely (disconnect or `src` removed). */
  private cancelInFlight(): void {
    this.clearPollTimer();
    this.abortController?.abort();
    this.abortController = null;
  }

  /** Starts (or restarts) the polling timer if in URL mode with a positive
   *  interval. Does NOT abort the kick-off fetch issued by the caller - it
   *  only resets the interval timer. */
  private startPolling(): void {
    this.clearPollTimer();
    if (this.currentUrl && this.refreshInterval > 0) {
      this.pollTimerId = setInterval(() => {
        if (this.currentUrl && !this.firstLoadPending) {
          this.fetchAndStore(this.currentUrl);
        }
      }, this.refreshInterval * 1000);
    }
  }

  render() {
    return <Host />;
  }
}
