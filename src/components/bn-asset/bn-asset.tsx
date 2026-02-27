import { Component, Element, Prop, h, Host } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import { set } from "../../stores/assets";
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

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      try {
        const cleanData = data.replace(/\s/g, "");
        // Using the bino cli also a path must be valid
        // if (!cleanData.startsWith("data:")) {
        //     throw new Error("Invalid data url");
        // }
        set(this.name, cleanData);
      } catch (e) {
        console.error("Error parsing asset", e, data);
        // @ts-ignore
        set(this.name, undefined);
      }
    });
  }

  render() {
    return <Host />;
  }
}
