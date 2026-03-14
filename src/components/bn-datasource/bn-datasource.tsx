import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { computeContentHash, decodeCompressedContent } from "../../utils/contentDecoder";
/**
 * Ingests raw JSON data and writes it to the scoped `datasources` store.
 *
 * Data is provided as JSON text inside the element body (observed via
 * `withBodyObserver`). Other components (e.g. `bn-dataset`) reference
 * the stored data by the `name` prop to run queries against it.
 *
 * Set `raw="false"` to accept pre-compressed payloads in `<hash>:<base64_gzip>` format.
 */
@Component({
  tag: "bn-datasource",
  styleUrl: "bn-datasource.css",
})
export class Datasource {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  /**
   * When true (default), body content is plain JSON text.
   * When false, body content is a compressed payload (`<hash>:<base64_gzip>`).
   */
  @Prop() raw: boolean = true;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;
  private lastHash: string | null = null;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      if (!this.stores) this.stores = getStores(this.element);
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
        // @ts-ignore
        this.stores.datasources.set(this.name, json);
      } catch (e) {
        console.error("Error parsing datasource", e, String(data).slice(0, 200));
        // @ts-ignore
        this.stores.datasources.set(this.name, []);
      }
    });
  }

  render() {
    return <Host />;
  }
}
