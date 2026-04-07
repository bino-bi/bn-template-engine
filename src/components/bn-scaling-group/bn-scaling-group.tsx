import { Component, Element, Prop, Watch, h, Host } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

/**
 * Defines a named scaling value that chart and table components can reference
 * via their `unit-scaling` or `percentage-scaling` attributes.
 *
 * Multiple components sharing the same group name will use the same scaling
 * value, allowing synchronized scaling across an entire page or section.
 *
 * The reserved name `"auto"` is not allowed and will be ignored with a warning.
 *
 * @example
 * <bn-scaling-group name="revenue" value="0.05"></bn-scaling-group>
 * <bn-chart-structure unit-scaling="revenue" ...></bn-chart-structure>
 * <bn-table unit-scaling="revenue" ...></bn-table>
 */
@Component({
  tag: "bn-scaling-group",
  styleUrl: "bn-scaling-group.css",
})
export class ScalingGroup {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError)
  @Element() private element: HTMLElement;

  /**
   * Unique name identifying this scaling group.
   * Components reference this name in their `unit-scaling` or `percentage-scaling` attributes.
   *
   * The name `"auto"` is reserved and cannot be used.
   */
  @Prop() name!: string;

  /**
   * The scaling value (pixels per data unit or pixels per percentage point,
   * depending on which attribute references this group).
   */
  @Prop() value!: number;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
    this.pushToStore();
  }

  @Watch("name")
  onNameChange(newName: string, oldName: string) {
    if (oldName && oldName !== newName && this.stores) {
      // Remove old entry — only if it still points to our value
      // (another bn-scaling-group with the same name may have overwritten it)
      const current = this.stores.scalingGroups.state[oldName];
      if (current === this.value) {
        // @ts-ignore – dynamic key
        this.stores.scalingGroups.set(oldName, undefined);
      }
    }
    this.pushToStore();
  }

  @Watch("value")
  onValueChange() {
    this.pushToStore();
  }

  private pushToStore() {
    if (!this.stores) return;

    const trimmedName = this.name?.toString().trim();

    // Validate: "auto" is reserved
    if (trimmedName?.toLowerCase() === "auto") {
      this.errors.addOrReplace({
        id: "ERR_reserved_name",
        type: "warning",
        message: `bn-scaling-group: name "auto" is reserved and cannot be used.`,
      });
      return;
    }

    this.errors.remove("ERR_reserved_name");

    if (!trimmedName) {
      this.errors.addOrReplace({
        id: "ERR_empty_name",
        type: "warning",
        message: `bn-scaling-group: name is required.`,
      });
      return;
    }

    this.errors.remove("ERR_empty_name");

    // @ts-ignore – dynamic key
    this.stores.scalingGroups.set(trimmedName, this.value);
  }

  render() {
    return <Host />;
  }
}
