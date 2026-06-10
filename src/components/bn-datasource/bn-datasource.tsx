import { Component, Element, Prop, Watch, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { computeContentHash, decodeCompressedContent } from "../../utils/contentDecoder";
/**
 * Ingests data and writes it to the scoped `datasources` store.
 *
 * Data can be provided in three ways:
 * 1. **Inline JSON** — Place JSON text inside the element body (default).
 * 2. **Compressed payload** — Set `raw="false"` and provide `<hash>:<base64_gzip>` format.
 * 3. **URL** — Place an `http://`/`https://` URL or a same-origin path
 *    starting with `/` in the body to fetch JSON from an HTTP endpoint.
 *
 * In URL mode the component fetches JSON from the URL. Set the `interval`
 * prop (in seconds) to enable periodic re-fetching (polling).
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
   * Ignored in URL mode.
   */
  @Prop() raw: boolean = true;

  /**
   * Polling interval in **seconds** for URL mode.
   * When set and the body content is a URL, the component re-fetches
   * data at this interval. Has no effect for inline JSON or compressed content.
   * Set to `0` or leave unset to disable polling.
   */
  @Prop() interval: number = 0;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;
  private lastHash: string | null = null;

  /** The currently active URL (`null` when in inline-JSON mode). */
  private currentUrl: string | null = null;
  /** Timer ID for the polling interval. */
  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** AbortController for cancelling in-flight fetch requests. */
  private abortController: AbortController | null = null;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      if (!this.stores) this.stores = getStores(this.element);

      const trimmed = data.trim();

      // --- URL mode ---
      if (this.isUrl(trimmed)) {
        if (trimmed === this.currentUrl) return;
        this.currentUrl = trimmed;
        this.lastHash = null;
        this.fetchAndStore(trimmed);
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
    });
  }

  /**
   * Writes the parsed data into the shared alasql database (as a table named
   * after this datasource) and notifies subscribers.
   */
  private publish(json: unknown): void {
    const db = this.stores.db.db;
    db.tables[this.name] = { data: Array.isArray(json) ? json : [] };
    this.stores.db.notify(this.name);
  }

  @Watch("interval")
  onIntervalChange(): void {
    if (this.currentUrl) {
      this.startPolling();
    }
  }

  disconnectedCallback(): void {
    this.cancelInFlight();
    const db = this.stores?.db?.db;
    if (db && this.name) {
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
