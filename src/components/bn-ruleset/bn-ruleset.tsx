import { Component, Element, h, Prop, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import { RuleSetConfig } from "../../stores/ruleSets";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-ruleset",
  styleUrl: "bn-ruleset.scss",
})
export class Ruleset {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError)
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
        this.stores.ruleSets.set(this.name, parsedData as RuleSetConfig);
        this.errors.remove("ERR_body");
      } catch (e) {
        this.errors.addOrReplace({
          id: "ERR_body",
          type: "error",
          message: `bn-ruleset: Failed to parse JSON body - ${(e as Error).message}`,
        });
        console.error(e);
      }
    });
  }

  render() {
    return <Host />;
  }
}
