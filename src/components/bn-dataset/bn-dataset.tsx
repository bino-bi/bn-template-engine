import { Component, Prop, h, Host, Watch } from "@stencil/core";
import withDatasource from "../../utils/withDatasource";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { calculateDatasetMeta } from "../../utils/datasetMetaCalculator";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { computeContentHash, decodeCompressedContent } from "../../utils/contentDecoder";

/**
 * Queries data from one or more `bn-datasource` entries via AlaSQL and
 * writes the result to the `datasets` store (+ computed `DatasetMeta`).
 *
 * The body content is observed via `withBodyObserver` and may be:
 * 1. **SQL** (default) — AlaSQL query against referenced `datasources`.
 * 2. **Static JSON** — set `static="true"` to bypass SQL and write the
 *    parsed body directly to the `datasets` store.
 * 3. **URL** — place an `http://`/`https://` URL or a same-origin path
 *    starting with `/` in the body to fetch JSON from an HTTP endpoint and
 *    write it to the `datasets` store. Set the `interval` prop (in seconds)
 *    to enable periodic re-fetching.
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

  private stores!: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    // Datasources already live in the shared db; just re-execute when any upstream notifies.
    withDatasource(this, () => {
      this.executeQuery();
    });

    withBodyObserver(this, (data) => {
      const trimmed = data.trim();

      // --- URL mode ---
      if (this.isUrl(trimmed)) {
        if (trimmed === this.currentUrl) return;
        this.currentUrl = trimmed;
        this.lastBodyHash = null;
        this.fetchAndStore(trimmed);
        this.startPolling();
        return;
      }

      // --- Leaving URL mode → clean up ---
      if (this.currentUrl !== null) {
        this.cancelInFlight();
        this.currentUrl = null;
      }

      let contentHash: string;
      let body: string;

      if (!this.raw && this.static) {
        try {
          const decoded = decodeCompressedContent(data);
          contentHash = decoded.hash;
          body = decoded.json;
        } catch (e) {
          console.error("Error decoding compressed dataset", e, String(data).slice(0, 200));
          return;
        }
      } else {
        contentHash = computeContentHash(data);
        body = data;
      }

      if (contentHash === this.lastBodyHash) return;
      this.lastBodyHash = contentHash;

      this.query = body;
      this.executeQuery();
    });
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
   * Polling interval in **seconds** for URL mode.
   * When set and the body content is a URL, the component re-fetches
   * data at this interval. Has no effect for SQL, inline JSON or
   * compressed content. Set to `0` or leave unset to disable polling.
   */
  @Prop() interval: number = 0;

  private query!: string;
  private lastBodyHash: string | null = null;
  /** The query text last used to (re)create the SQL view, so we only `CREATE VIEW` when it actually changes. */
  private lastViewQuery: string | null = null;
  private latestResult: unknown;

  /** The currently active URL (`null` when not in URL mode). */
  private currentUrl: string | null = null;
  /** Timer ID for the polling interval. */
  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** AbortController for cancelling in-flight fetch requests. */
  private abortController: AbortController | null = null;

  executeQuery() {
    if (!this.stores) this.stores = getStores(this.element);
    if (!this.query || !this.name) return;

    const db = this.stores.db.db;
    let result: unknown;

    if (this.static) {
      // Static JSON: parse and register as a table in the shared db.
      try {
        result = JSON.parse(this.query);
      } catch (e) {
        console.error("Failed to parse static dataset", e);
        result = [];
      }
      db.tables[this.name] = { data: Array.isArray(result) ? result : [] };
      this.lastViewQuery = null;
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
          /* not registered as a view — fine */
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
          db.exec(`CREATE VIEW \`${this.name}\` AS ${this.query}`);
          this.lastViewQuery = this.query;
        } catch (e) {
          console.error("bn-dataset: failed to register SQL view", e, this.query);
          this.lastViewQuery = null;
          result = [];
          this.publish(result);
          return;
        }
      }
      try {
        result = db.exec(`SELECT * FROM \`${this.name}\``);
      } catch (_e) {
        // Most common cause: an upstream datasource referenced by the view hasn't
        // been registered yet (HTML parse/connectedCallback race). `withDatasource`
        // re-fires executeQuery on every upstream notify, so we'll retry then.
        // Skip publish so we don't clobber datasetsMeta with empty data.
        return;
      }
    }

    this.publish(result);
  }

  /** Notifies db subscribers and updates the derived `datasetsMeta` store. */
  private publish(result: unknown): void {
    if (this.latestResult === result) {
      // Even if the materialized object reference is unchanged, upstream data may have moved
      // (notably for views) — fire notify so consumers re-render against the fresh table state.
      this.stores.db.notify(this.name);
      return;
    }
    this.latestResult = result;
    this.stores.db.notify(this.name);
    // @ts-ignore - DatasetMeta is small derived metadata; kept as a @stencil/store per the plan.
    this.stores.datasetsMeta.set(this.name, calculateDatasetMeta(result));
  }

  @Watch("name")
  nameUpdated() {
    this.executeQuery();
  }

  @Watch("interval")
  onIntervalChange(): void {
    if (this.currentUrl) {
      this.startPolling();
    }
  }

  disconnectedCallback(): void {
    this.cancelInFlight();
    if (this.stores?.db?.db && this.name) {
      const db = this.stores.db.db;
      try {
        db.exec(`DROP VIEW \`${this.name}\``);
      } catch (_e) {
        // not registered as a view — fine
      }
      if (db.tables[this.name] != null) {
        delete db.tables[this.name];
      }
      // @ts-ignore - views typing is loose
      if (db.views && db.views[this.name] != null) {
        // @ts-ignore
        delete db.views[this.name];
      }
      this.stores.db.notify(this.name);
    }
  }

  /**
   * Returns `true` if the text is a fetchable URL: an absolute `http(s)://`
   * URL, or a same-origin path starting with `/` (but not `//`, which is a
   * protocol-relative URL we treat as inline-mode escape).
   */
  private isUrl(text: string): boolean {
    if (text.startsWith("http://") || text.startsWith("https://")) return true;
    return text.startsWith("/") && !text.startsWith("//");
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
      const json = await response.json();
      const db = this.stores.db.db;
      db.tables[this.name] = { data: Array.isArray(json) ? json : [] };
      this.lastViewQuery = null;
      this.publish(json);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("bn-dataset: error fetching URL", e, url);
      const db = this.stores.db.db;
      db.tables[this.name] = { data: [] };
      this.lastViewQuery = null;
      this.publish([]);
    }
  }

  /** Stops the polling timer (does NOT touch any in-flight fetch). */
  private clearPollTimer(): void {
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
  }

  /** Stops the polling timer AND cancels any in-flight fetch. Use only when
   *  leaving URL mode entirely (disconnect or body changed to inline). */
  private cancelInFlight(): void {
    this.clearPollTimer();
    this.abortController?.abort();
    this.abortController = null;
  }

  /** Starts (or restarts) the polling timer if in URL mode with a positive
   *  interval. Does NOT abort the kick-off fetch issued by the caller — it
   *  only resets the interval timer. */
  private startPolling(): void {
    this.clearPollTimer();
    if (this.currentUrl && this.interval > 0) {
      this.pollTimerId = setInterval(() => {
        if (this.currentUrl) {
          this.fetchAndStore(this.currentUrl);
        }
      }, this.interval * 1000);
    }
  }

  render() {
    return <Host />;
  }
}
