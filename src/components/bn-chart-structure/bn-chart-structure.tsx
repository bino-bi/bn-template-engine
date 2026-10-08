import { Component, Element, forceUpdate, h, Host, Method, Prop, State, Watch, writeTask } from "@stencil/core";
import { hasInlineJs } from "../../context/scopedDb";
import {
  isBlankInput,
  isValidDirection,
  isValidInteger,
  isValidLevel,
  isValidMeasureScale,
  validateOrderList,
  validateScenarioList,
  validateStackConfig,
  validateVariancesList,
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import withScalingGroup from "../../utils/withScalingGroup";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withRuleSet from "../../utils/withRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withInheritedProps, { InheritedResolver, isInheritedValue } from "../../utils/withInheritedProps";
import { getParentDimensions, ParentDimensions } from "../../utils/parentDimensions";
import { AutoScalingReport, formatScalingValue, parseScaling, resolveScalingValue } from "../../utils/scaling";
import { observeParentResize, LayoutObserverHandle } from "../../utils/layoutObserver";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { Style } from "../../stores/componentStyles";
import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed } from "./utils/model/StructureChartComponentConfig";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import {
  ComponentLayoutState,
  LAYOUT_STATE_VERSION,
  LayoutStateOptions,
  ScalingInfo,
  collectChartFacadeLayout,
  measure,
  originsFor,
  readDiagnostics,
  resolveStandaloneId,
} from "../../utils/layoutState";
import { syncEmptyState } from "../../utils/emptyState";

/**
 * SVG structure (categorical) bar chart following IBCS standards.
 *
 * Subscribes to a dataset (via `withDataset`) and renders horizontal bar
 * charts grouped by category, with up to four scenario layers, optional
 * variance sub-charts, stacking, and proportional auto-scaling (height-
 * based). The heavy SVG rendering is performed by the inner
 * `bn-chart-structure-renderer` element; this outer component validates props,
 * resolves auto-detected metadata, and computes styles.
 */
@Component({
  tag: "bn-chart-structure",
  styleUrl: "bn-chart-structure.scss",
  shadow: true,
})
export class Chart {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  /** Active dataset name (the last subscribed dataset to fire `onUpdate`). */
  @State() private datasetName: string = "";
  /** Bumped on every data update so Stencil re-renders even when the name is unchanged. */
  @State() private dataVersion: number = 0;
  @State() private datasetMeta: DatasetMeta | null = null;
  @State() private appliedScaleFactor: number = 1;

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private readonly ruleSetConfig: () => RuleSetConfig;
  private readonly errors: ErrorDispatcher;
  private readonly resolveInherited: InheritedResolver;
  private layoutObserver: LayoutObserverHandle | null = null;
  /** Last parent height seen, used to suppress ResizeObserver noise. */
  private _lastScaledParentHeight = 0;

  /**
   * Name of the dataset to render (the `name` of a `<bn-dataset>`). A name
   * that starts with `$` reads a `<bn-datasource>` directly, which gives a
   * warning.
   */
  @Prop({ reflect: true }) datasets?: string;

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * Namespace of the translations to use (the `namespace` of a
   * `<bn-internationalization>`). Without it the component takes the
   * `i18n-namespace` of the nearest ancestor that has one, then the built-in
   * texts.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace?: string;

  /**
   * Title displayed above the chart. When empty, the title is derived
   * from the variance scenario labels (if variances are configured).
   *
   * @example chart-title="Revenue by Category"
   */
  @Prop()
  chartTitle: string = "";

  /**
   * Name of a registered IBCS rule set (see `bn-ruleset`) used for scenario
   * ordering. Supports `"inherited-closest"` / `"inherited-page"` to take
   * over the value from an ancestor `bn-layout-card` / `bn-layout-page`.
   */
  @Prop({ reflect: true })
  ruleset?: string;

  /**
   * AlaSQL WHERE clause fragment injected into the data query to filter
   * rows before rendering.
   *
   * @example filter="rowGroup = 'Revenue'"
   */
  @Prop()
  filter: string = "";

  @Watch("filter")
  validateFilter(newValue: string) {
    const errId: string = "ERR_filter";
    if (hasInlineJs(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "error",
        message: "filter: double backticks are not allowed.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Comma-separated list of scenario columns to display as bars.
   * Up to 4 scenarios are supported; additional values are ignored.
   *
   * Valid scenario names: `ac1`-`ac4`, `fc1`-`fc4`, `pp1`-`pp4`, `pl1`-`pl4`.
   *
   * | Value         | Behavior                                                    |
   * |---------------|-------------------------------------------------------------|
   * | `"ac1,fc1"`   | Show the listed scenarios                                   |
   * | `"auto"`      | Auto-detect from dataset metadata (no warning)              |
   * | not set / `""` | Auto-detect from dataset metadata (emits `AUTO_scenarios` warning) |
   *
   * @example scenarios="ac1,pp1,pl1"
   */
  @Prop() scenarios!: string;
  @Watch("scenarios")
  validateScenario(newValue: string) {
    const errId: string = "ERR_scenarios";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidScenarios: string[] = validateScenarioList(newValue);

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "scenarios: invalid value(s) '" + JSON.stringify(invalidScenarios) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }
  /**
   * Comma-separated list of variance definitions. Each variance adds
   * a separate sub-chart next to the main bar chart.
   *
   * **Pattern:** `d<base>_<comparison>_<sentiment>` (absolute)
   * or `dr<base>_<comparison>_<sentiment>` (relative / percentage).
   *
   * - `base` / `comparison`: scenario names that must also appear in `scenarios`.
   * - `sentiment`: `pos` (positive is good), `neg` (negative is good), `neu` (neutral).
   *
   * When empty, no variance charts are shown.
   *
   * @example variances="dpp1_ac1_neg,dfc1_ac1_neg"
   * @example variances="drac1_pl1_pos"
   */
  @Prop() variances!: string;
  @Watch("variances")
  validateVariances(newValue: string) {
    const errIdVar: string = "ERR_variances";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errIdVar);
      return;
    }
    const invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({
        id: errIdVar,
        type: "warning",
        message: "variances: invalid value(s) '" + JSON.stringify(invalidVariances) + "' are not supported.",
      });
    } else {
      this.errors.remove(errIdVar);
    }
  }

  /**
   * Data units displayed per 1 em of bar length (horizontal bars) - map-scale
   * semantics: a larger value means smaller bars.
   *
   * | Value              | Behavior                                                    |
   * |--------------------|-------------------------------------------------------------|
   * | `"auto"`           | Auto-fit bars to fill the available container width         |
   * | not set / invalid  | Same as auto, but emits `AUTO_unitScaling` warning          |
   * | `"250000"`, `"1M"` | Units per em; optional SI suffix `k`/`K`/`M`/`G`/`T`        |
   * | group name         | References a `<bn-scaling-group>` for synchronized scaling  |
   *
   * When using a custom value that causes the chart to exceed its container,
   * a `WARN_overflow` error is emitted.
   *
   * @example unit-scaling="auto"
   * @example unit-scaling="1M"
   * @example unit-scaling="revenue-scale"
   */
  @Prop() unitScaling!: string | number;

  @Watch("unitScaling")
  validateUnitScaling(newValue: string | number) {
    const errId: string = "ERR_unitScaling";

    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (resolveScalingValue(newValue, this.pixelPerUnitGroupMap).kind === "invalid") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "unitScaling: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Percentage points displayed per 1 em of bar length for relative
   * variances - a larger value means shorter bars.
   *
   * | Value             | Behavior                                                      |
   * |-------------------|---------------------------------------------------------------|
   * | `"auto"`          | Auto-fit to available width                                   |
   * | not set / invalid | Same as auto with `AUTO_percentageScaling` warning            |
   * | `"10"`, `"2.5"`   | Percentage points per em; optional SI suffix `k`/`K`/`M`/`G`/`T` |
   * | group name        | References a `<bn-scaling-group>` for synchronized scaling    |
   *
   * @example percentage-scaling="10"
   * @example percentage-scaling="pct-scale"
   */
  @Prop() percentageScaling!: string | number;
  @Watch("percentageScaling")
  validatePercentageScaling(newValue: string | number) {
    const errId: string = "ERR_percentageScaling";

    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (resolveScalingValue(newValue, this.pixelPerUnitGroupMap).kind === "invalid") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "percentageScaling: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Aggregation level that determines which hierarchy dimension each bar represents.
   *
   * | Value              | Bars represent            |
   * |--------------------|---------------------------|
   * | `"rowGroup"`       | Row groups                |
   * | `"rowGroupIndex"`  | Row groups (dataset order)|
   * | `"category"`       | Categories                |
   * | `"categoryIndex"`  | Categories (dataset order)|
   * | `"subCategory"`    | Sub-categories            |
   * | `"subCategoryIndex"` | Sub-categories (dataset order)|
   * | `"auto"`           | Auto-detect from dataset metadata (no warning) |
   * | not set / `""`     | Auto-detect with `AUTO_level` warning          |
   *
   * Index variants preserve the original dataset order instead of sorting alphabetically.
   * When `stack.by` is `"dimensions"`, the chart automatically stacks by the next-lower
   * level (e.g. level `"rowGroup"` stacks by category).
   *
   * @example level="category"
   */
  @Prop() level!: string;

  @Watch("level")
  validateLevel(newValue: string) {
    const errId: string = "ERR_level";

    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (!isValidLevel(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "level: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Comma-separated list of columns that define the sort order of bars.
   * When ordering by a scenario column, that scenario must also be listed in `scenarios`.
   *
   * Valid values: `category`, `categoryIndex`, `rowGroup`, `rowGroupIndex`,
   * `subCategory`, `subCategoryIndex`, `ac1`-`ac4`, `fc1`-`fc4`, `pp1`-`pp4`, `pl1`-`pl4`.
   *
   * | Value          | Behavior                                            |
   * |----------------|-----------------------------------------------------|
   * | `"ac1"`        | Sort bars by the ac1 scenario values                |
   * | `"category"`   | Sort bars alphabetically by category name           |
   * | `"auto"`       | Auto-detect from dataset metadata (no warning)      |
   * | not set / `""` | Auto-detect with `AUTO_order` warning               |
   *
   * @example order="ac1"
   */
  @Prop() order!: string;

  @Watch("order")
  validateOrderList(newValue: string) {
    const errId: string = "ERR_order";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidElements: string[] = validateOrderList(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "order: invalid value(s) '" + JSON.stringify(invalidElements) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Sort direction applied to the columns specified in `order`.
   *
   * Values: `"asc"` (ascending) | `"desc"` (descending).
   *
   * @default "asc"
   * @example order-direction="desc"
   */
  @Prop() orderDirection!: string;
  @Watch("orderDirection")
  validateOrderDirection(newValue: string) {
    const errId: string = "ERR_orderDirection";
    if (isInheritedValue(newValue) || isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "orderDirection: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }
  /**
   * Maximum number of bars to display. Excess rows are aggregated into
   * a "REST" summary bar. `0` means no limit (all rows are shown).
   *
   * @default 0
   * @example limit="5"
   */
  @Prop() limit: number = 0;

  @Watch("limit")
  validateLimit(newValue: number) {
    const errId: string = "ERR_limit";

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "limit: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Whether to display category labels on the left side of the chart.
   *
   * Values: `"true"` | `"false"`.
   *
   * @default "true"
   * @example show-categories="false"
   */
  @Prop() showCategories: boolean = true;

  /**
   * SI prefix applied to data values, dividing them for display
   * (e.g. `"k"` divides by 1 000, showing 14 000 as "14").
   *
   * Common prefixes: `"k"` (×10³), `"M"` (×10⁶), `"G"` (×10⁹), `"T"` (×10¹²).
   * Use `"_"` for no prefix (raw values).
   *
   * | Special value | Behavior                                                     |
   * |---------------|--------------------------------------------------------------|
   * | `"GREATEST"`  | Auto-select prefix based on the largest value in the dataset |
   * | `"LEAST"`     | Auto-select prefix based on the smallest value               |
   *
   * The selected prefix is shown in the chart footer when `show-measure-scale` is enabled.
   *
   * @default "greatest"
   * @example measure-scale="k"
   */
  @Prop() measureScale: string = "greatest";

  @Watch("measureScale")
  validateMeasureScale(newValue: string) {
    const errId: string = "ERR_measureScale";

    if (!isValidMeasureScale(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "measureScale: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Toggles display of the SI prefix and unit label in the chart footer
   * (e.g. "k EUR").
   *
   * Values: `"true"` | `"false"`.
   *
   * @default "false"
   * @example show-measure-scale="true"
   */
  @Prop() showMeasureScale: boolean = false;

  /**
   * Unit label displayed alongside the SI prefix in the chart footer
   * (e.g. "EUR", "USD", "pcs"). Only visible when `show-measure-scale` is `"true"`.
   *
   * @default ""
   * @example measure-unit="EUR"
   */
  @Prop() measureUnit: string = "";

  /**
   * Stacking configuration as a JSON string. When set, bars are drawn as
   * stacked segments instead of side-by-side.
   *
   * **Properties:**
   *
   * | Key     | Values                                        | Description                                        |
   * |---------|-----------------------------------------------|----------------------------------------------------|
   * | `by`    | `"scenarios"` \| `"dimensions"`               | **Required.** What to stack.                       |
   * | `mode`  | `"absolute"` \| `"relative"` \| `"absolute-relative"` | Stacking mode. Default: `"absolute"`.        |
   * | `order` | `"asc"` \| `"desc"` \| `"dataset"`           | Segment sort order. Default: `"dataset"`.          |
   *
   * - `by: "scenarios"` - stacks the scenarios listed in the `scenarios` prop end-to-end.
   * - `by: "dimensions"` - stacks by the next-lower hierarchy level derived from `level`
   *   (e.g. level `"rowGroup"` stacks by category). Only the first scenario is used;
   *   extra scenarios trigger a `WARN_stack_dimensions_scenarios` warning.
   * - `mode: "relative"` - normalizes each bar to 100%, showing proportions.
   * - `mode: "absolute-relative"` - absolute bars with percentage labels.
   *
   * Segment colors are configurable via the `stackColors` array in component styles.
   *
   * @default "" (no stacking)
   * @example stack='{"by":"scenarios","mode":"absolute"}'
   * @example stack='{"by":"dimensions","mode":"relative"}'
   */
  @Prop() stack: string = "";

  @Watch("stack")
  validateStack(newValue: string) {
    const errId: string = "ERR_stack";
    const errors = validateStackConfig(newValue);

    if (errors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: errors.join("; "),
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Controls proportional scaling of the chart to fit the available parent height.
   *
   * | Value               | Behavior                                                                          |
   * |---------------------|-----------------------------------------------------------------------------------|
   * | not set / `""`      | Auto-scale to fit parent height; emit `AUTO_scale` warning with the applied factor |
   * | `"none"`            | No scaling (render at base font size regardless of available space)                |
   * | `"auto"`            | Auto-scale to fit parent height silently (no warning)                             |
   * | `"0.5"`, `"1.2"`, … | Fixed factor - apply `baseFontSize × factor`                                      |
   */
  @Prop() scale?: string;

  @Watch("scale")
  validateScaling(newValue: string) {
    if (newValue == null || newValue === "" || newValue === "none" || newValue === "auto") {
      this.errors.remove("ERR_scale");
      return;
    }
    const num = Number(newValue);
    if (isNaN(num) || num <= 0) {
      this.errors.addOrReplace({
        id: "ERR_scale",
        type: "warning",
        message: `Invalid scale value: "${newValue}". Use "none", "auto", or a positive number.`,
      });
    } else {
      this.errors.remove("ERR_scale");
    }
  }

  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    withDataset(
      this,
      (name, _data) => {
        this.datasetName = name?.startsWith("$") ? name.substring(1) : name || "";
        this.dataVersion = this.dataVersion + 1;
      },
      (_name, meta) => {
        this.datasetMeta = meta;
      },
    );
    this.chartTemplate = this.chartTemplate.bind(this);
    this.errors = withHasError(this);
    withScalingGroup(this);
    this.componentStyle = withComponentStyle(this);
    this.ruleSetConfig = withRuleSet(this);
    this.t = withTranslation(this).t;
    this.resolveInherited = withInheritedProps(
      this,
      [
        { propName: "scenarios", ancestorAttr: "title-scenarios" },
        { propName: "variances", ancestorAttr: "title-variances" },
        { propName: "order", ancestorAttr: "title-order" },
        { propName: "orderDirection", ancestorAttr: "title-order-direction" },
      ],
      this.errors,
    );
  }

  componentWillLoad() {
    this.validateFilter(this.filter);
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateUnitScaling(this.unitScaling);
    //this.validateSelectedStyle(this.selectedStyle);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateMeasureScale(this.measureScale);
    this.validateStack(this.stack);
    this.validateScaling(this.scale);
  }

  private _autoScaleGuard = false;

  componentDidRender() {
    syncEmptyState(this.element, "bn-chart-structure-renderer");

    const { mode } = parseScaling(this.scale);

    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      this.checkOverflow();
      return;
    }

    if (this._autoScaleGuard) {
      this._autoScaleGuard = false;
      this.checkOverflow();
      return;
    }

    const host = this.element;
    const { height: parentHeight } = getParentDimensions(host);
    if (parentHeight <= 0) {
      this.checkOverflow();
      return;
    }

    // Record height so the ResizeObserver callback can tell
    // whether the container genuinely resized or just reflowed.
    this._lastScaledParentHeight = parentHeight;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    // The chart host is display:inline-block - it sizes to its content.
    // scrollHeight gives the actual rendered height at the current factor.
    const currentHeight = host.scrollHeight;
    const currentFactor = this.appliedScaleFactor;

    // Primary check: does the content ACTUALLY fit at the current factor?
    // This avoids oscillation from non-linear SVG scaling where the
    // divide-by-factor estimate overshoots.
    if (currentHeight <= parentHeight + 1) {
      // Content fits. Don't reset to factor 1 - the content only fits
      // BECAUSE of the current factor. Resetting would cause oscillation.
      this.errors.remove("AUTO_scale");
      this.checkOverflow();
      return;
    }

    // Content overflows. Compute a new factor based on the ratio of
    // parent to current content height, scaled by the current factor.
    const computedFactor = Math.max(0.3, (currentFactor * (parentHeight - 1)) / currentHeight);

    // Only apply if the change is significant (> 1% of current factor).
    // SVG charts have non-linear scaling so we use a wider tolerance
    // than tables to avoid oscillation from sub-pixel rounding.
    if (Math.abs(computedFactor - currentFactor) < 0.01) {
      this.checkOverflow();
      return;
    }

    host.style.setProperty("--bn-font-size", `${baseFontSize * computedFactor}px`);

    if (mode === "empty") {
      this.errors.addOrReplace({
        id: "AUTO_scale",
        type: "warning",
        message: `Auto-scaled chart by factor ${computedFactor.toFixed(3)}`,
      });
    } else {
      this.errors.remove("AUTO_scale");
    }

    this._autoScaleGuard = true;
    writeTask(() => {
      this.appliedScaleFactor = computedFactor;
    });

    // Check with the current (pre-factor) content so overflow is reported
    // even if the scheduled re-render stalls; the follow-up render re-checks
    // in the guard branch and clears any transiently reported overflow.
    this.checkOverflow();
  }

  componentDidLoad() {
    // Observe the parent container for size changes so auto-scaling
    // reacts to genuine container resizes (window resize, card relayout).
    // Only trigger a re-render when the parent height actually changed
    // compared to what auto-scaling last measured - this prevents the
    // ResizeObserver's initial fire (and content-reflow noise) from
    // creating an infinite auto-scale loop.
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { height } = getParentDimensions(this.element);
      // Only react to HEIGHT changes - structure chart scales by height.
      // Width changes are handled separately via checkWidthOverflow.
      if (height > 0 && Math.abs(height - this._lastScaledParentHeight) > 2) {
        this._lastScaledParentHeight = height;
        forceUpdate(this);
      }
    });

    // Double-rAF guarantees the browser has completed at least one full
    // paint cycle so all nested shadow DOM layouts are finalized.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._autoScaleGuard) return;
        const { height } = getParentDimensions(this.element);
        this._lastScaledParentHeight = height;
        forceUpdate(this);
      });
    });
  }

  disconnectedCallback() {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
  }

  /**
   * Content width from the rendered SVG width attributes (segments render
   * side by side) - immune to the inner hosts' overflow:hidden clipping:
   * flex items with hidden overflow shrink below their content size, so the
   * host's scrollWidth cannot see the overflow. Falls back to scrollWidth
   * before the inner charts have rendered.
   */
  private measureContentWidth(): number {
    const inners = this.element.shadowRoot?.querySelectorAll("bn-chart-structure-renderer");
    let total = 0;
    let found = false;
    inners?.forEach((inner) => {
      const width = parseFloat(inner.shadowRoot?.querySelector("svg#drawCanvas")?.getAttribute("width") ?? "");
      if (!Number.isNaN(width)) {
        total += width;
        found = true;
      }
    });
    // scrollWidth additionally sees non-SVG chrome, but is blind to clipped
    // segments (see above) - take the larger of the two measurements.
    // Floor the fractional SVG widths so borderline sub-pixel overhangs are
    // judged with the same integer tolerance as the scroll metrics.
    return found ? Math.max(Math.floor(total), this.element.scrollWidth) : this.element.scrollWidth;
  }

  /**
   * Reports a WARN_overflow item when the rendered chart exceeds its
   * container. Overflow attributable to a fixed scaling attribute is an
   * error (width: unit-scaling / percentage-scaling, height: scale);
   * overflow in fully-auto mode is a warning - auto-fit prevents it by
   * construction, so it only fires when the content cannot fit at any scale.
   */
  private checkOverflow(): void {
    const errId = "WARN_overflow";
    const parent = getParentDimensions(this.element);
    const contentWidth = this.measureContentWidth();
    const contentHeight = this.element.scrollHeight;
    const widthOver = parent.width > 0 && contentWidth > parent.width + 1;
    const heightOver = parent.height > 0 && contentHeight > parent.height + 1;

    if (!widthOver && !heightOver) {
      this.errors.remove(errId);
      return;
    }

    const hasRelativeVariance = this.prepareVariances().some((variance) => variance.startsWith("dr"));
    const fixedUnit = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap).kind === "value";
    const fixedPercent =
      hasRelativeVariance && resolveScalingValue(this.percentageScaling, this.pixelPerUnitGroupMap).kind === "value";
    const { mode } = parseScaling(this.scale);
    const fixedScale = mode !== "auto" && mode !== "empty";

    const fixedAttrs: string[] = [];
    if (widthOver && fixedUnit) fixedAttrs.push("unit-scaling");
    if (widthOver && fixedPercent) fixedAttrs.push("percentage-scaling");
    if (heightOver && fixedScale) fixedAttrs.push("scale");

    const dims: string[] = [];
    if (widthOver) dims.push(`width (${Math.round(contentWidth)}px > ${Math.round(parent.width)}px)`);
    if (heightOver) dims.push(`height (${Math.round(contentHeight)}px > ${Math.round(parent.height)}px)`);

    this.errors.addOrReplace({
      id: errId,
      type: fixedAttrs.length > 0 ? "error" : "warning",
      message:
        `Chart exceeds available ${dims.join(" and ")}. ` +
        (fixedAttrs.length > 0
          ? `Adjust ${fixedAttrs.join(" / ")} or set to "auto".`
          : "Content does not fit even at minimum auto scaling; enlarge the container."),
    });
  }

  prepareDimension(): ParentDimensions {
    const parent = getParentDimensions(this.element);
    const variancesList = this.prepareVariances();
    const segmentCount = 1 + variancesList.length;
    this.canvasWidthSegmented = parent.width / segmentCount;
    return { width: this.canvasWidthSegmented, height: parent.height };
  }

  private prepareScenarios(): string[] {
    const scenarios = this.resolveInherited("scenarios", this.scenarios);
    if (scenarios.inherited) {
      this.errors.remove("AUTO_scenarios");
      return scenarios.value.split(",").map((entry) => entry.trim());
    }
    const isAuto = scenarios.value?.trim().toLowerCase() === "auto";
    if (isBlankInput(scenarios.value) || isAuto) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        // An unresolved keyword has its own warning, so it gets no AUTO_scenarios on top.
        if (!isAuto && !scenarios.unresolved) {
          this.errors.addOrReplace({
            id: "AUTO_scenarios",
            type: "warning",
            message: `scenarios: not set, auto-detected: ${this.datasetMeta.availableScenarios.join(",")}`,
          });
        } else {
          this.errors.remove("AUTO_scenarios");
        }
        return this.datasetMeta.availableScenarios;
      }
      return [];
    }
    this.errors.remove("AUTO_scenarios");
    return scenarios.value?.split(",").map((entry) => entry.trim());
  }

  private prepareVariances(): string[] {
    const variances = this.resolveInherited("variances", this.variances).value;
    if (isBlankInput(variances)) {
      return [];
    }
    return variances?.split(",").map((entry) => entry.trim());
  }

  private prepareHideCategories(idx: number): boolean {
    return idx >= 1 || !this.showCategories;
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["no-data", "REST"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    const i18nMapLocal = new Map(i18nMetaLabelsLocal.map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map((key) => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }

  private autoUnitWarningActive = false;
  private autoPctWarningActive = false;
  private lastReportedUnitsPerEm?: number;
  private lastReportedPpPerEm?: number;
  /** Last auto-fit report from the inner chart (px/unit, px/1.0), kept for getLayoutState(). */
  private lastAutoScalingReport?: AutoScalingReport;

  /** "not set" for blank input, `invalid value "x"` otherwise - for AUTO_* messages. */
  private static describeScalingInput(raw: string): string {
    return raw === "" ? "not set" : `invalid value "${raw}"`;
  }

  private preparePixelPerUnit(): number {
    const resolved = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap);
    if (resolved.kind === "value") {
      this.errors.remove("AUTO_unitScaling");
      this.autoUnitWarningActive = false;
      this.lastReportedUnitsPerEm = undefined;
      // The attribute is data units per em; the inner chart expects px for one data unit.
      return this.getEffectiveFontPx() / resolved.value;
    }

    // Explicit 'auto' → auto-calculate silently
    if (resolved.kind === "auto") {
      this.errors.remove("AUTO_unitScaling");
      this.autoUnitWarningActive = false;
      this.lastReportedUnitsPerEm = undefined;
      return 0;
    }

    // Not set / invalid → auto-calculate with warning
    this.autoUnitWarningActive = true;
    this.errors.addOrReplace({
      id: "AUTO_unitScaling",
      type: "warning",
      message: `unit-scaling: ${Chart.describeScalingInput(resolved.raw)}, auto-calculated to fit available space.`,
    });
    return 0;
  }

  private preparePixelPerPercentage(): number {
    const resolved = resolveScalingValue(this.percentageScaling, this.pixelPerUnitGroupMap);
    if (resolved.kind === "value") {
      this.errors.remove("AUTO_percentageScaling");
      this.autoPctWarningActive = false;
      this.lastReportedPpPerEm = undefined;
      // The attribute is percentage points per em; the inner chart expects
      // px per 1.0 fraction (= per 100 percentage points).
      return (100 * this.getEffectiveFontPx()) / resolved.value;
    }

    if (resolved.kind === "auto") {
      this.errors.remove("AUTO_percentageScaling");
      this.autoPctWarningActive = false;
      this.lastReportedPpPerEm = undefined;
      return 0;
    }

    this.autoPctWarningActive = true;
    this.errors.addOrReplace({
      id: "AUTO_percentageScaling",
      type: "warning",
      message: `percentage-scaling: ${Chart.describeScalingInput(resolved.raw)}, auto-calculated to fit available space.`,
    });
    return 0;
  }

  /**
   * Receives the auto-fitted values from the inner bn-chart-structure-renderer (px
   * per unit / px per 1.0 fraction) and surfaces them in the AUTO_* warnings,
   * converted back to the attribute's units-per-em form so users can copy
   * them into a bn-scaling-group.
   */
  private handleAutoScalingReport = (report: AutoScalingReport): void => {
    // A report only carries the auto-resolved quantities - keep the other one.
    this.lastAutoScalingReport = {
      unit: report.unit ?? this.lastAutoScalingReport?.unit,
      percentage: report.percentage ?? this.lastAutoScalingReport?.percentage,
    };
    const changed = (next: number, last?: number): boolean =>
      last === undefined || Math.abs(next - last) > Math.abs(next) * 1e-3;
    const effFontPx = this.getEffectiveFontPx();

    if (report.unit !== undefined && report.unit > 0 && this.autoUnitWarningActive) {
      const unitsPerEm = effFontPx / report.unit;
      if (changed(unitsPerEm, this.lastReportedUnitsPerEm)) {
        this.lastReportedUnitsPerEm = unitsPerEm;
        this.errors.addOrReplace({
          id: "AUTO_unitScaling",
          type: "warning",
          message: `unit-scaling: ${Chart.describeScalingInput(String(this.unitScaling ?? "").trim())}, auto-fitted to 1 em ≈ ${formatScalingValue(unitsPerEm)} units.`,
        });
      }
    }
    if (report.percentage !== undefined && report.percentage > 0 && this.autoPctWarningActive) {
      const ppPerEm = (100 * effFontPx) / report.percentage;
      if (changed(ppPerEm, this.lastReportedPpPerEm)) {
        this.lastReportedPpPerEm = ppPerEm;
        this.errors.addOrReplace({
          id: "AUTO_percentageScaling",
          type: "warning",
          message: `percentage-scaling: ${Chart.describeScalingInput(String(this.percentageScaling ?? "").trim())}, auto-fitted to 1 em ≈ ${formatScalingValue(ppPerEm)} percentage points.`,
        });
      }
    }
  };

  private prepareLevel(): AggregationLevel {
    const isAuto = this.level?.trim().toLowerCase() === "auto";
    if (isBlankInput(this.level) || isAuto) {
      if (this.datasetMeta?.suggestedLevel) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: "AUTO_level",
            type: "warning",
            message: `level: not set, auto-detected: ${this.datasetMeta.suggestedLevel}`,
          });
        } else {
          this.errors.remove("AUTO_level");
        }
        return AggregationLevel[this.datasetMeta.suggestedLevel.toUpperCase() as keyof typeof AggregationLevel];
      }
      return undefined;
    }
    this.errors.remove("AUTO_level");
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): Order {
    const order = this.resolveInherited("order", this.order);
    const effectiveOrder = order.value;
    const effectiveDirection = this.resolveInherited("orderDirection", this.orderDirection).value;

    const isAuto = effectiveOrder?.trim().toLowerCase() === "auto";
    let orderStr: string;
    if (isBlankInput(effectiveOrder) || isAuto) {
      if (this.datasetMeta?.suggestedOrder) {
        // An unresolved keyword has its own warning, so it gets no AUTO_order on top.
        if (!isAuto && !order.unresolved) {
          this.errors.addOrReplace({
            id: "AUTO_order",
            type: "warning",
            message: `order: not set, auto-detected: ${this.datasetMeta.suggestedOrder}`,
          });
        } else {
          this.errors.remove("AUTO_order");
        }
        orderStr = this.datasetMeta.suggestedOrder;
      } else {
        orderStr = effectiveOrder;
      }
    } else {
      this.errors.remove("AUTO_order");
      orderStr = effectiveOrder;
    }

    const tableOrder: Order = {
      hierarchy: orderStr?.split(",").map((entry) => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[effectiveDirection?.toUpperCase() as keyof typeof OrderDirection],
    };

    return tableOrder;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prepareStyle(): any {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-structure"]["scaleFactors"]["scenarioOffset"],
          scenarioLabelToBar: $["bn-chart-structure"]["scaleFactors"]["scenarioLabelToBar"],
          labelToBar: $["bn-chart-structure"]["scaleFactors"]["labelToBar"],
          labelToAxis: $["bn-chart-structure"]["scaleFactors"]["labelToAxis"],
          needleWidth: $["bn-chart-structure"]["scaleFactors"]["needleWidth"],
          needleHeadWidth: $["bn-chart-structure"]["scaleFactors"]["needleHeadWidth"],
          barWidth: $["bn-chart-structure"]["scaleFactors"]["barWidth"],
          varianceAxisLineWidth: $["bn-chart-structure"]["scaleFactors"]["varianceAxisLineWidth"],
          axisLineWidth: $["bn-chart-structure"]["scaleFactors"]["axisLineWidth"],
          auxiliaryLineWidth: $["bn-chart-structure"]["scaleFactors"]["auxiliaryLineWidth"],
          scenarioLineWidth: $["bn-chart-structure"]["scaleFactors"]["scenarioLineWidth"],
          markerWidth: $["bn-chart-structure"]["scaleFactors"]["markerWidth"],
          markerOffset: $["bn-chart-structure"]["scaleFactors"]["markerOffset"],
          categoryWidth: $["bn-chart-structure"]["scaleFactors"]["categoryWidth"],
          axisTickLength: $["bn-chart-structure"]["scaleFactors"]["axisTickLength"],
        },
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]["fontFamily"]}`,
          family: $["global"]["fontFamily"],
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-structure"]["axisStyles"],
        barStyles: $["bn-chart-structure"]["barStyles"],
        varianceStyles: $["bn-chart-structure"]["varianceStyles"],
        stackColors: $["bn-chart-structure"]["stackColors"],
        padding: $["bn-chart-structure"]["padding"],
        pattern: null,
      };
    });
  }

  private prepareChartTitle(idx: number): string {
    if (idx >= 1) {
      return "";
    }

    return this.chartTitle;
  }

  private prepareStackConfig(): StackConfigParsed | null {
    if (isBlankInput(this.stack)) {
      this.errors.remove("WARN_stack_dimensions_scenarios");
      return null;
    }
    try {
      const parsed = JSON.parse(this.stack);
      const by = parsed.by as StackBy;

      const errId = "WARN_stack_dimensions_scenarios";
      if (by === StackBy.DIMENSIONS) {
        const scenarios = this.prepareScenarios();
        if (scenarios.length > 1) {
          this.errors.addOrReplace({
            id: errId,
            type: "warning",
            message: `stack by dimensions: only the first scenario "${scenarios[0]}" is used, the rest (${scenarios.slice(1).join(", ")}) are discarded.`,
          });
        } else {
          this.errors.remove(errId);
        }
      } else {
        this.errors.remove(errId);
      }

      return {
        by,
        mode: (parsed.mode as StackMode) || StackMode.ABSOLUTE,
        order: (parsed.order as StackOrder) || StackOrder.DATASET,
      };
    } catch {
      this.errors.remove("WARN_stack_dimensions_scenarios");
      return null;
    }
  }

  private prepareFilter(): string {
    if (this.filter.length === 0) {
      return "";
    }

    return this.filter;
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const dataSetStructure: Record<string, unknown> = {
      IStructureChartDataRow: {
        operation: { type: "string", isOptional: false, description: "" },
        rowGroup: { type: "string", isOptional: false, description: "" },
        rowGroupIndex: { type: "number", isOptional: false, description: "" },
        category: { type: "string", isOptional: false, description: "" },
        categoryIndex: { type: "number", isOptional: false, description: "" },
        subCategory: { type: "string", isOptional: false, description: "" },
        subCategoryIndex: { type: "number", isOptional: false, description: "" },
        columnGroup: { type: "string", isOptional: false, description: "" },
        columnGroupIndex: { type: "number", isOptional: false, description: "" },
        columnSubGroup: { type: "string", isOptional: false, description: "" },
        columnSubGroupIndex: { type: "number", isOptional: false, description: "" },
        ac1: { type: "number", isOptional: false, description: "" },
        ac2: { type: "number", isOptional: false, description: "" },
        ac3: { type: "number", isOptional: false, description: "" },
        ac4: { type: "number", isOptional: false, description: "" },
        pp1: { type: "number", isOptional: false, description: "" },
        pp2: { type: "number", isOptional: false, description: "" },
        pp3: { type: "number", isOptional: false, description: "" },
        pp4: { type: "number", isOptional: false, description: "" },
        fc1: { type: "number", isOptional: false, description: "" },
        fc2: { type: "number", isOptional: false, description: "" },
        fc3: { type: "number", isOptional: false, description: "" },
        fc4: { type: "number", isOptional: false, description: "" },
        pl1: { type: "number", isOptional: false, description: "" },
        pl2: { type: "number", isOptional: false, description: "" },
        pl3: { type: "number", isOptional: false, description: "" },
        pl4: { type: "number", isOptional: false, description: "" },
      },
    };

    return dataSetStructure;
  }

  private prepareMeasureScale(): string {
    if (isBlankInput(this.measureScale)) {
      return "GREATEST";
    }

    if (
      ["_", "k", "M", "G", "T", "P", "E", "Z", "Y", "m", "μ", "n", "p", "P", "f", "a", "z", "y"].includes(
        this.measureScale.trim(),
      )
    ) {
      return this.measureScale.trim();
    }

    if (this.measureScale.trim().toUpperCase() === "LEAST") {
      return this.measureScale.trim();
    }

    return "GREATEST";
  }

  prepareShowMeasureScale(idx: number): boolean {
    return idx === 0 && this.showMeasureScale;
  }
  prepareMeasureUnit(): string {
    if (this.measureUnit === "" || this.measureUnit == null) {
      return "";
    }
    return this.measureUnit;
  }

  chartTemplate(localScenarioString: string, idx: number) {
    const ppu = this.preparePixelPerUnit();
    const ppp = this.preparePixelPerPercentage();
    const stackConfig = this.prepareStackConfig();
    const scenarios = this.prepareScenarios();
    // Dimension stacking uses only the first scenario
    const effectiveScenarios = stackConfig?.by === StackBy.DIMENSIONS ? scenarios.slice(0, 1) : scenarios;

    return (
      <bn-chart-structure-renderer
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.prepareChartTitle(idx)}
        scenarios={effectiveScenarios}
        variances={[localScenarioString]}
        hideCategories={this.prepareHideCategories(idx)}
        pixelPerUnit={ppu}
        pixelPerPercentage={ppp}
        reportAutoScaling={this.handleAutoScalingReport}
        errors={this.errors}
        limit={this.prepareLimit()}
        styles={this.prepareStyle()}
        i18n={this.prepareI18n()}
        order={this.prepareOrder()}
        level={this.prepareLevel()}
        filter={this.prepareFilter()}
        measure-scale={this.prepareMeasureScale()}
        measure-unit={this.prepareMeasureUnit()}
        showMeasureScale={this.prepareShowMeasureScale(idx)}
        stackConfig={stackConfig}
        parentDimensions={this.prepareDimension()}
        ruleSetConfig={this.ruleSetConfig()}
      ></bn-chart-structure-renderer>
    );
  }

  /**
   * Lazily generates this chart's layout state: host box (context- and
   * component-relative, CSS px), one `canvas:<segment>` region per rendered
   * segment (base + variances), metadata (scenarios, bar count), diagnostics
   * and resolved scaling. With `detail: "full"` every bar, label and axis of
   * every segment is listed with its geometry.
   *
   * @param options - `{ detail: "summary" | "full" }`, default `"summary"`
   */
  @Method()
  async getLayoutState(options?: LayoutStateOptions): Promise<ComponentLayoutState> {
    const detail = options?.detail ?? "summary";
    const origins = originsFor(this.element);
    const rawFactor = this.getEffectiveScaleFactor();
    // Auto-scale can be mid-measurement (or unmeasurable in tests) - report a sane factor.
    const factor = Number.isFinite(rawFactor) && rawFactor > 0 ? rawFactor : 1;
    const fontSizePx = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333) * factor;

    const variances = this.prepareVariances();
    const layout = collectChartFacadeLayout(
      this.element,
      "bn-chart-structure-renderer",
      ["base", ...variances],
      origins,
      detail,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstInner = this.element.shadowRoot?.querySelector("bn-chart-structure-renderer") as any;

    const state: ComponentLayoutState = {
      version: LAYOUT_STATE_VERSION,
      tag: this.element.localName,
      id: resolveStandaloneId(this.element),
      slot: this.element.getAttribute("slot") ?? undefined,
      rect: measure(this.element, origins),
      em: { fontSizePx, appliedScaleFactor: factor },
      regions: layout.regions,
      metadata: {
        title: this.chartTitle || undefined,
        scenarios: firstInner?.scenarios ?? [],
        variances,
        barCount: layout.barCount,
        hasNoData: layout.barCount === 0,
      },
      diagnostics: readDiagnostics(this.element),
      scaling: this.resolveScalingInfo(fontSizePx),
    };
    if (layout.elements) state.elements = layout.elements;
    return state;
  }

  /**
   * Resolved value scaling without re-triggering validation side effects.
   * The inner chart's scale unit is px per unit / px per 1.0 fraction;
   * auto-fitted values come from the last inner report.
   */
  private resolveScalingInfo(effFontPx: number): ScalingInfo {
    const info: ScalingInfo = {};
    const unit = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap);
    if (unit.kind === "value") {
      info.unitMode = "fixed";
      info.unitsPerEm = unit.value;
      info.unitPxPerUnit = effFontPx / unit.value;
    } else {
      info.unitMode = "auto";
      const pxPerUnit = this.lastAutoScalingReport?.unit;
      if (pxPerUnit !== undefined && pxPerUnit > 0) {
        info.unitPxPerUnit = pxPerUnit;
        info.unitsPerEm = effFontPx / pxPerUnit;
      }
    }
    const pct = resolveScalingValue(this.percentageScaling, this.pixelPerUnitGroupMap);
    if (pct.kind === "value") {
      info.percentageMode = "fixed";
      info.percentagePointsPerEm = pct.value;
      info.percentagePxPerPoint = effFontPx / pct.value;
    } else {
      info.percentageMode = "auto";
      const pxPerFraction = this.lastAutoScalingReport?.percentage;
      if (pxPerFraction !== undefined && pxPerFraction > 0) {
        info.percentagePxPerPoint = pxPerFraction / 100;
        info.percentagePointsPerEm = (100 * effFontPx) / pxPerFraction;
      }
    }
    return info;
  }

  private getEffectiveScaleFactor(): number {
    const { mode, factor } = parseScaling(this.scale);
    if (mode === "factor") return factor!;
    if (mode === "auto" || mode === "empty") return this.appliedScaleFactor;
    return 1;
  }

  /** Effective font size in px: base font from the style store × effective scale factor. */
  private getEffectiveFontPx(): number {
    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);
    return baseFontSize * this.getEffectiveScaleFactor();
  }

  private getFontStyles(): { [key: string]: string } {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]?.["fontSizePx"] || 13.3333;
      return {
        "--bn-font-family": $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
        "--bn-font-size": `${baseFontSize * effectiveFactor}px`,
        "--bn-font-color": $["global"]?.["fontColor"] || "#000000",
        "--bn-font-background": $["global"]?.["fontBackgroundColor"] || "#ffffff",
      };
    });
  }

  render() {
    let scenariosArray = [""];
    const variancesArray = this.prepareVariances();

    if (variancesArray.length > 0) {
      scenariosArray = [...scenariosArray, ...variancesArray];
    }

    const fontStyles = this.getFontStyles();

    return (
      <Host style={fontStyles}>
        <div class="container">{scenariosArray.map(this.chartTemplate)}</div>
      </Host>
    );
  }
}
