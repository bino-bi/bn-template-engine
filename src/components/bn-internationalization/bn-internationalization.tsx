import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { get, set } from "../../stores/internationalization";
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

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      try {
        const i18n = flattenObject(JSON.parse(data));

        // @ts-ignore
        const namespace = { ...get(this.namespace) };
        namespace[this.code] = i18n;

        // @ts-ignore
        set(this.namespace, namespace);
      } catch (e) {
        console.error(e);
      }
    });
  }

  @Prop() code: string;
  @Prop() namespace: string;

  render() {
    return <Host />;
  }
}
