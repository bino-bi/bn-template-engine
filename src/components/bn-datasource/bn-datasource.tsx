import { Component, Element, Prop, Watch, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, clearStoresCache, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { computeContentHash, decodeCompressedContent } from "../../utils/contentDecoder";
/**
 * Ingests data and writes it to the scoped `datasources` store.
 *
 * Data can be provided in three ways:
 * 1. **Inline JSON** - Place JSON text inside the element body (default).
 * 2. **Compressed payload** - Set `raw="false"` and provide `<hash>:<base64_gzip>` format.
 * 3. **URL** - Set the `src` attribute to fetch JSON from an HTTP endpoint.
 *    Set the `interval` prop (in seconds) to enable periodic re-fetching
 *    (polling).
 *
 * The body is always inline data and is ignored while `src` is set.
 *
 * Other components (e.g. `bn-dataset`) reference the stored data by the
 * `name` prop to run queries against it.
 */
@Component({
  tag: "bn-datasource",
  styleUrl: "bn-datasource.css",
})
export class Datasource {
  @Element() private element: HTMLElement;
  /**
   * Unique (template scope) name of the datasource.
   */
  @Prop() name!: string;

  /**
   * When true (default), body content is plain JSON text.
   * When false, body content is a compressed payload (`<hash>:<base64_gzip>`).
   * Ignored when `src` is set.
   */
  @Prop() raw: boolean = true;

  /**
   * Polling interval in **seconds** for `src`.
   * When set together with `src`, the component re-fetches data at this
   * interval. Has no effect for inline JSON or compressed content.
   * Set to `0` or leave unset to disable polling.
   */
  @Prop() interval: number = 0;

  /**
   * URL to fetch the JSON from. When set, the body is ignored.
   */
  @Prop() src?: string;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private readonly holdStatus: (work: Promise<unknown>) => void;

  private stores: ScopedStores;
  private lastHash: string | null = null;
  /** The table object this element put into the db, to tell it from one another element registered under the same name. */
  private registered: unknown;

  /** The currently active URL (`null` when in inline-JSON mode). */
  private currentUrl: string | null = null;
  /** Timer ID for the polling interval. */
  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** AbortController for cancelling in-flight fetch requests. */
  private abortController: AbortController | null = null;
  /** True until the first request for the current `src` has delivered. A poll tick is skipped meanwhile: it would cancel that request and release readiness with no data. */
  private firstLoadPending = false;

  constructor() {
    this.holdStatus = withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => this.sync(data));
  }

  /** Loads from `src` when it is set, otherwise from the inline body. */
  private sync(data: string): void {
    // a re-attached element may sit in another bn-context
    this.stores = getStores(this.element);

    // --- URL mode ---
    if (this.src) {
      if (this.src === this.currentUrl) return;
      this.currentUrl = this.src;
      this.lastHash = null;
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

    // --- Inline JSON / compressed mode ---
    try {
      let contentHash: string;
      let jsonString: string;

      if (this.raw) {
        contentHash = computeContentHash(data);
        jsonString = data;
      } else {
        const decoded = decodeCompressedContent(data);
        contentHash = decoded.hash;
        jsonString = decoded.json;
      }

      if (contentHash === this.lastHash) return;
      this.lastHash = contentHash;

      const json = JSON.parse(jsonString);
      this.publish(json);
    } catch (e) {
      console.error("Error parsing datasource", e, String(data).slice(0, 200));
      this.publish([]);
    }
  }

  /**
   * Writes the parsed data into the shared alasql database (as a table named
   * after this datasource) and notifies subscribers.
   */
  private publish(json: unknown): void {
    const db = this.stores.db.db;
    db.tables[this.name] = { data: Array.isArray(json) ? json : [] };
    this.registered = db.tables[this.name];
    this.stores.db.notify(this.name);
  }

  @Watch("interval")
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

  @Watch("name")
  nameUpdated(_name: string, oldName: string) {
    this.unregister(oldName);
    if (this.name && this.element.isConnected) this.sync(this.element.textContent ?? "");
  }

  disconnectedCallback(): void {
    this.cancelInFlight();
    this.unregister(this.name);
    clearStoresCache(this.element);
  }

  /** Drops the table registered under `name` and forgets the loaded state, so the next sync loads again. */
  private unregister(name: string): void {
    this.lastHash = null;
    this.currentUrl = null;
    const db = this.stores?.db?.db;
    // another element may have taken the name since: its table and consumers stay untouched
    const taken = db?.tables[name] != null && db.tables[name] !== this.registered;
    this.registered = undefined;
    if (db && name && !taken) {
      if (db.tables[name] != null) {
        delete db.tables[name];
      }
      // @ts-ignore - views typing is loose
      if (db.views && db.views[name] != null) {
        // @ts-ignore
        delete db.views[name];
      }
      this.stores.db.notify(name);
    }
  }

  /**
   * Fetches JSON from the given URL and stores the result.
   * Cancels any in-flight request before starting a new one.
   */
  private async fetchAndStore(url: string): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    if (!this.stores) this.stores = getStores(this.element);

    try {
      const response = await fetch(url, { signal: this.abortController.signal });
      const json = await response.json();
      this.publish(json);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("bn-datasource: error fetching URL", e, url);
      this.publish([]);
    }
    this.firstLoadPending = false;
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
    if (this.currentUrl && this.interval > 0) {
      this.pollTimerId = setInterval(() => {
        if (this.currentUrl && !this.firstLoadPending) {
          this.fetchAndStore(this.currentUrl);
        }
      }, this.interval * 1000);
    }
  }

  render() {
    return <Host />;
  }
}
