import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { getStores, ScopedStores } from "../../context/context-protocol";
import flattenObject from "../../utils/flattenObject";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-internationalization",
  styleUrl: "bn-internationalization.scss",
})
export class Internationalization {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      if (!this.stores) this.stores = getStores(this.element);
      try {
        const i18n = flattenObject(JSON.parse(data));
        const ns = this.namespace || "_system";

        const namespace = { ...(this.stores.internationalization.get(ns) as Record<string, unknown>) };
        // Merge over the existing bundle (built-ins or earlier manifests) so
        // partial overrides don't wipe unrelated keys.
        namespace[this.code] = { ...(namespace[this.code] as Record<string, string>), ...i18n };

        this.stores.internationalization.set(ns, namespace);
      } catch (e) {
        console.error(e);
      }
    });
  }

  @Prop() code: string;
  @Prop() namespace: string = "_system";

  render() {
    return <Host />;
  }
}
