import { Component, Element, Prop, h, Host } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withBodyObserver from "../../utils/withBodyObserver";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-asset",
  styleUrl: "bn-asset.css",
  shadow: true,
})
export class Asset {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  /**
   * Unique (template scope) name of the asset
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
        const cleanData = data.replace(/\s/g, "");
        // Using the bino cli also a path must be valid
        // if (!cleanData.startsWith("data:")) {
        //     throw new Error("Invalid data url");
        // }
        this.stores.assets.set(this.name, cleanData);
      } catch (e) {
        console.error("Error parsing asset", e, data);
        // @ts-ignore
        this.stores.assets.set(this.name, undefined);
      }
    });
  }

  render() {
    return <Host />;
  }
}
