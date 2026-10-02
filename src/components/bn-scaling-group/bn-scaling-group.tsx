import { Component, Element, Prop, Watch, h, Host } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { formatScalingValue, parseScalingValue } from "../../utils/scaling";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

/**
 * Defines a named scaling value that chart and table components can reference
 * via their `unit-scaling` or `percentage-scaling` attributes, or a bubble
 * chart via its `size` spec's `group` key.
 *
 * Multiple components sharing the same group name will use the same scaling
 * value, allowing synchronized scaling across an entire page or section.
 *
 * The reserved name `"auto"` is not allowed, and neither is a name that would
 * parse as a number/SI value (e.g. `"1M"`); both are rejected with a warning.
 *
 * @example
 * <bn-scaling-group name="revenue" value="250k"></bn-scaling-group>
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
   * Components reference this name in their `unit-scaling` or `percentage-scaling`
   * attributes, or in a bubble chart's `size.group`.
   *
   * The name `"auto"` is reserved, and names that parse as a number/SI value
   * (`"100"`, `"1M"`) are rejected - they would be ambiguous with a literal
   * scaling value.
   */
  @Prop() name!: string;

  /**
   * The scaling value: a positive number with optional SI suffix
   * (`k`/`K` = 1e3, `M` = 1e6, `G` = 1e9, `T` = 1e12), e.g. `"250k"` or `2.5`.
   *
   * The unit depends on which attribute references this group:
   * - from `unit-scaling`: data units per 1 em of bar length
   * - from `percentage-scaling`: percentage points per 1 em of pin length
   * - from a bubble chart's `size.group`: data units per 1 em² of bubble area
   */
  @Prop() value!: string | number;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private stores: ScopedStores;

  /** Name/value of the store entry this element last wrote (ownership tracking). */
  private storedName?: string;
  private storedValue?: number;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
    this.pushToStore();
  }

  disconnectedCallback() {
    this.removeEntryIfOurs(this.storedName);
  }

  @Watch("name")
  onNameChange(newName: string, oldName: string) {
    const trimmedOld = oldName?.toString().trim();
    if (trimmedOld && trimmedOld !== newName?.toString().trim()) {
      this.removeEntryIfOurs(trimmedOld);
    }
    this.pushToStore();
  }

  @Watch("value")
  onValueChange() {
    this.pushToStore();
  }

  /**
   * Removes the store entry for `name` - but only if it still holds the value
   * this element wrote (another bn-scaling-group with the same name may have
   * overwritten it).
   */
  private removeEntryIfOurs(name?: string): void {
    if (!name || !this.stores) return;
    if (this.storedName === name && this.stores.scalingGroups.state[name] === this.storedValue) {
      // @ts-ignore - dynamic key
      this.stores.scalingGroups.set(name, undefined);
    }
    if (this.storedName === name) {
      this.storedName = undefined;
      this.storedValue = undefined;
    }
  }

  private pushToStore() {
    if (!this.stores) return;

    const trimmedName = this.name?.toString().trim();
    const nameParse = parseScalingValue(trimmedName);

    // Validate: "auto" is reserved
    if (nameParse.kind === "auto") {
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

    // Validate: a name that parses as a number/SI value would be ambiguous
    // with a literal scaling value at the referencing component.
    if (nameParse.kind === "number") {
      this.errors.addOrReplace({
        id: "ERR_numeric_name",
        type: "warning",
        message: `bn-scaling-group: name "${trimmedName}" is not allowed - it would be ambiguous with a numeric scaling value.`,
      });
      return;
    }

    this.errors.remove("ERR_numeric_name");

    const parsedValue = parseScalingValue(this.value);
    if (parsedValue.kind !== "number") {
      this.errors.addOrReplace({
        id: "ERR_invalid_value",
        type: "warning",
        message: `bn-scaling-group: invalid value "${this.value}" - must be a positive number, optionally with k/M/G/T suffix.`,
      });
      return;
    }

    this.errors.remove("ERR_invalid_value");

    const existing = this.stores.scalingGroups.state[trimmedName];
    const wroteExisting = this.storedName === trimmedName && this.storedValue === existing;
    if (existing !== undefined && existing !== parsedValue.value && !wroteExisting) {
      this.errors.addOrReplace({
        id: "WARN_duplicate_group",
        type: "warning",
        message: `bn-scaling-group: "${trimmedName}" is already registered with a different value (${formatScalingValue(existing)}); overwriting.`,
      });
    } else {
      this.errors.remove("WARN_duplicate_group");
    }

    if (this.storedName && this.storedName !== trimmedName) {
      this.removeEntryIfOurs(this.storedName);
    }

    // @ts-ignore - dynamic key
    this.stores.scalingGroups.set(trimmedName, parsedValue.value);
    this.storedName = trimmedName;
    this.storedValue = parsedValue.value;
  }

  render() {
    return <Host />;
  }
}
