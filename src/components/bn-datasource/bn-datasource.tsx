import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
/**
 * Ingests raw JSON data and writes it to the scoped `datasources` store.
 *
 * Data is provided as JSON text inside the element body (observed via
 * `withBodyObserver`). Other components (e.g. `bn-dataset`) reference
 * the stored data by the `name` prop to run queries against it.
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

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      if (!this.stores) this.stores = getStores(this.element);
      try {
        const json = JSON.parse(data);
        // @ts-ignore
        this.stores.datasources.set(this.name, json);
      } catch (e) {
        console.error("Error parsing datasource", e, data);
        // @ts-ignore
        this.stores.datasources.set(this.name, []);
      }
    });
  }

  render() {
    return <Host />;
  }
}
