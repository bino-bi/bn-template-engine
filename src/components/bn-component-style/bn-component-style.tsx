import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { Style } from "../../stores/componentStyles";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-component-style",
  styleUrl: "bn-component-style.scss",
})
export class ComponentStyle {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  @Prop() name: string = "_default";

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      if (!this.stores) this.stores = getStores(this.element);
      try {
        const parsedData = JSON.parse(data);
        // @ts-ignore
        this.stores.componentStyles.set(this.name, parsedData as Style);
      } catch (e) {
        //TODO: add error chanel for JSON parsing errors
        console.error(e);
      }
    });
  }

  render() {
    return <Host />;
  }
}
