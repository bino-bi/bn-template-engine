import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { set } from "../../stores/datasources";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
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

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    withBodyObserver(this, (data) => {
      try {
        const json = JSON.parse(data);
        // @ts-ignore
        set(this.name, json);
      } catch (e) {
        console.error("Error parsing datasource", e, data);
        // @ts-ignore
        set(this.name, []);
      }
    });
  }

  render() {
    return <Host />;
  }
}
