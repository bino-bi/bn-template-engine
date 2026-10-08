import { Component, Element, forceUpdate, h, Host, Method, Prop, State, Watch, writeTask } from "@stencil/core";
import { hasInlineJs } from "../../context/scopedDb";
import { ComponentLayoutState, LayoutStateOptions, collectXYFacadeState, originsFor } from "../../utils/layoutState";
import { globalLabelKeys } from "../../stores/internationalization";
import { RuleSetConfig } from "../../stores/ruleSets";
import { getParentDimensions } from "../../utils/parentDimensions";
import { checkXYOverflow } from "../../utils/xy/checkXYOverflow";
import { LayoutObserverHandle, observeParentResize } from "../../utils/layoutObserver";
import { parseScaling } from "../../utils/scaling";
import { isBlankInput, isValidInteger, isValidMeasureToken } from "../../utils/validate";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withDataset from "../../utils/withDataset";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withRuleSet from "../../utils/withRuleSet";
import withScalingGroup from "../../utils/withScalingGroup";
import withTranslation from "../../utils/withTranslation";
import { withStyled } from "../../utils/styled/withStyled";
import { resolveMeasure, scenarioFamily } from "../../utils/xy/VarianceMeasure";
import {
  AxisConfig,
  FacetConfig,
  LabelConfig,
  LegendConfig,
  parseSpec,
  ShareConfig,
  SizeConfig,
  SpecResult,
  toAxisConfig,
  toFacetConfig,
  toLabelConfig,
  toLegendConfig,
  toShareConfig,
  toSizeConfig,
} from "../../utils/xy/model/AxisConfig";
import { GroupLevel, PointLevel } from "../../utils/xy/model/XYChartDataRow";
import { XYChartStyle } from "../../utils/xy/model/XYChartStyle";
import { syncEmptyState } from "../../utils/emptyState";

const HIERARCHY_DEPTH: Record<string, number> = { rowGroup: 0, category: 1, subCategory: 2 };

const COMPARE_FAMILIES = ["ac", "pp", "fc", "pl"];

/**
 * SVG bubble chart following IBCS template C10.
 *
 * Subscribes to a dataset (via `withDataset`) and renders an XY bubble
 * portfolio: bubble **area** is proportional to the size measure, marks
 * compose series hues with scenario treatments, an optional comparison
 * family overlays behind the primary set (10D), and `share` draws pie
 * sectors inside the bubbles (10E). The heavy SVG rendering is performed
 * by the inner `bn-chart-bubble-renderer` element; this facade validates props,
 * resolves auto-detected metadata, and computes styles.
 */
@Component({
  tag: "bn-chart-bubble",
  styleUrl: "bn-chart-bubble.scss",
  shadow: true,
})
export class ChartBubble {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  /** Active dataset name (the last subscribed dataset to fire `onUpdate`). */
  @State() private datasetName: string = "";
  /** Bumped on every data update so Stencil re-renders even when the name is unchanged. */
  @State() private dataVersion: number = 0;
  @State() private datasetMeta: DatasetMeta | null = null;
  @State() private appliedScaleFactor: number = 1;

  private readonly t: (key: string, data?: object) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly componentStyle: <T>(q: (s: any) => T) => T;
  private readonly ruleSetConfig: () => RuleSetConfig;
  private readonly errors: ErrorDispatcher;
  private layoutObserver: LayoutObserverHandle | null = null;
  /** Ids of currently-active blocking errors - the chart renders empty while any is set. */
  private readonly activeErrors: Set<string> = new Set();
  /** Named scaling-group values, synced from the scoped store by `withScalingGroup`. */
  private pixelPerUnitGroupMap: Map<string, number> = new Map();

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
   * Name of a registered IBCS rule set (see `bn-ruleset`) used for scenario
   * treatments and display names. Supports `"inherited-closest"` /
   * `"inherited-page"` to take over the value from an ancestor
   * `bn-layout-card` / `bn-layout-page`.
   */
  @Prop({ reflect: true })
  ruleset?: string;

  /**
   * Custom chart title
   */
  @Prop()
  chartTitle: string = "";

  /**
   * AlaSQL WHERE clause fragment injected into the data query to filter
   * rows before rendering (e.g. `"rowGroup = 'Revenue'"`).
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
   * X axis mapping. JSON object (`AxisSpec`) or a bare measure token as
   * shorthand: `{"measure":"ac1","label":"Market attractiveness",
   * "refLine":0.5}`. A relative variance (`dr…`) gives an axis in percent:
   * the ticks print `20%`, and `min`, `max`, `refLine` and `highlight` are
   * written in percent too (`20` for 20 %).
   */
  @Prop() x!: string;
  @Watch("x")
  validateX(newValue: string) {
    this.validateMeasureSpec("x", newValue, true, (data) => toAxisConfig(data));
  }

  /**
   * Y axis mapping - same shape as `x`.
   */
  @Prop() y!: string;
  @Watch("y")
  validateY(newValue: string) {
    this.validateMeasureSpec("y", newValue, true, (data) => toAxisConfig(data));
  }

  /**
   * Bubble size mapping (required). Bubble **area** is proportional to the
   * value; values must be >= 0. JSON object or bare token:
   * `{"measure":"ac3","label":"Net sales","unit":"mEUR",
   * "group":"netsales-area"}`. `group` references a `bn-scaling-group` for
   * cross-chart value→area synchronization.
   */
  @Prop() size!: string;
  @Watch("size")
  validateSize(newValue: string) {
    this.validateMeasureSpec("size", newValue, true, (data) => toSizeConfig(data));
    this.validateSizeScaling();
  }

  /**
   * Pie-share slices inside the bubbles (IBCS 10E). JSON object or bare
   * token; the measure holds a fraction 0..1 of the bubble.
   */
  @Prop() share: string = "";
  @Watch("share")
  validateShare(newValue: string) {
    this.validateMeasureSpec("share", newValue, false, (data) => toShareConfig(data));
  }

  /**
   * Comparison scenario family (`ac`/`pp`/`fc`/`pl`) overlaid behind the
   * primary set from the same slot numbers (IBCS 10D). Must differ from the
   * primary family; invalid with variance-token axes.
   */
  @Prop() compareWith: string = "";
  @Watch("compareWith")
  validateCompareWith(newValue: string) {
    const errId = "ERR_compareWith";
    if (isBlankInput(newValue) || COMPARE_FAMILIES.includes(newValue.trim().toLowerCase())) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `compare-with: invalid value '${newValue}' - expected ${COMPARE_FAMILIES.join("/")}; ignored.`,
      });
    }
  }

  /**
   * Point identity level: `auto` (deepest populated level from the dataset
   * meta), `category`, or `subcategory`.
   */
  @Prop() level: string = "auto";
  @Watch("level")
  validateLevel(newValue: string) {
    const errId = "ERR_level";
    const valid = ["auto", "category", "subcategory"];
    if (isBlankInput(newValue) || valid.includes(newValue.trim().toLowerCase())) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `level: invalid value '${newValue}' - expected ${valid.join("/")}; using 'auto'.`,
      });
    }
  }

  /**
   * Series (color) grouping level: `auto` (parent of the point level),
   * `rowgroup`, `category`, or `none` (single series).
   */
  @Prop() seriesLevel: string = "auto";
  @Watch("seriesLevel")
  validateSeriesLevel(newValue: string) {
    const errId = "ERR_seriesLevel";
    const valid = ["auto", "rowgroup", "category", "none"];
    if (isBlankInput(newValue) || valid.includes(newValue.trim().toLowerCase())) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `series-level: invalid value '${newValue}' - expected ${valid.join("/")}; using 'auto'.`,
      });
    }
  }

  /**
   * Small-multiple panels (IBCS 10E/10F/10G). JSON object:
   * `{"level":"rowgroup"|"category","columns":6}`. The facet level must sit
   * above the series level in the hierarchy.
   */
  @Prop() facet: string = "";
  @Watch("facet")
  validateFacet(newValue: string) {
    this.validateObjectSpec("facet", newValue, (data) => toFacetConfig(data));
  }

  /**
   * Point labeling. JSON object: `{"points":"auto"|"none"|"all"|["VAB"],
   * "values":true,"max":12}`. Bubble charts label every point by default;
   * `values` renders the value inside the bubble.
   */
  @Prop() labels: string = "";
  @Watch("labels")
  validateLabels(newValue: string) {
    this.validateObjectSpec("labels", newValue, (data) => toLabelConfig(data, this.labelDefaults()));
  }

  /**
   * Legend (series colors, bubble size caption, comparison scenarios).
   * JSON object: `{"show":true,"position":"right"|"bottom"}`.
   */
  @Prop() legend: string = "";
  @Watch("legend")
  validateLegend(newValue: string) {
    this.validateObjectSpec("legend", newValue, (data) => toLegendConfig(data));
  }

  /**
   * Plot aspect ratio as `"w:h"` (default `"16:9"`). XY charts have no
   * data-driven height; this is the explicit height control.
   */
  @Prop() aspect: string = "16:9";
  @Watch("aspect")
  validateAspect(newValue: string) {
    const errId = "ERR_aspect";
    if (isBlankInput(newValue) || this.parseAspect(newValue) !== null) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `aspect: invalid value '${newValue}' - expected "w:h" (e.g. "16:9"); using the default.`,
      });
    }
  }

  /**
   * Maximum number of bubbles per panel (0 = unlimited); keeps the top N
   * by size.
   */
  @Prop() limit: number = 0;
  @Watch("limit")
  validateLimit(newValue: number) {
    const errId = "ERR_limit";
    if (isValidInteger(newValue) && Number(newValue) >= 0) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `limit: invalid value '${newValue}' - expected a non-negative integer; using 0.`,
      });
    }
  }

  /**
   * Font-size auto-fit: `""`/`auto` shrink to the parent width (with/without
   * a warning), `none` disables, a number applies a fixed factor.
   */
  @Prop() scale?: string;
  @Watch("scale")
  validateScale(newValue: string) {
    const errId = "ERR_scale";
    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const { mode, factor } = parseScaling(newValue);
    if (mode === "factor" && (factor === undefined || factor <= 0)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `scale: invalid value '${newValue}' - expected none/auto or a positive number.`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

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
    this.errors = withHasError(this);
    withScalingGroup(this);
    this.componentStyle = withComponentStyle(this);
    this.ruleSetConfig = withRuleSet(this);
    this.t = withTranslation(this).t;
  }

  componentWillLoad() {
    this.validateFilter(this.filter);
    this.validateX(this.x);
    this.validateY(this.y);
    this.validateSize(this.size);
    this.validateShare(this.share);
    this.validateCompareWith(this.compareWith);
    this.validateLevel(this.level);
    this.validateSeriesLevel(this.seriesLevel);
    this.validateFacet(this.facet);
    this.validateLabels(this.labels);
    this.validateLegend(this.legend);
    this.validateAspect(this.aspect);
    this.validateLimit(this.limit);
    this.validateScale(this.scale);
  }

  private _autoScaleGuard = false;
  private _lastObservedWidth = 0;

  componentDidRender() {
    syncEmptyState(this.element, "bn-chart-bubble-renderer");

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
    const { width: parentWidth } = getParentDimensions(host);
    if (parentWidth <= 0) {
      this.checkOverflow();
      return;
    }

    this._lastObservedWidth = parentWidth;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const currentWidth = host.scrollWidth;
    const currentFactor = this.appliedScaleFactor;

    if (!Number.isFinite(currentWidth) || currentWidth <= parentWidth + 1) {
      this.errors.remove("AUTO_scale");
      this.checkOverflow();
      return;
    }

    const computedFactor = Math.max(0.3, (currentFactor * (parentWidth - 1)) / currentWidth);

    if (Math.abs(computedFactor - currentFactor) < 0.01) {
      // Converged (possibly at the 0.3 floor) but still too wide - report it.
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

    // The follow-up render checks again in the guard branch.
    this.checkOverflow();
  }

  private checkOverflow(): void {
    checkXYOverflow(this.element, "bn-chart-bubble-renderer", this.errors);
  }

  componentDidLoad() {
    // Watch for size changes (window resize, card relayout) - width only.
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { width } = getParentDimensions(this.element);
      if (width > 0 && Math.abs(width - this._lastObservedWidth) > 2) {
        this._lastObservedWidth = width;
        forceUpdate(this);
      } else {
        // only the height of the parent changed: the chart keeps its size, what is cut off may differ
        this.checkOverflow();
      }
    });

    // Double-rAF: guarantees the browser completed at least one full paint
    // cycle so all nested card/body/grid layouts are finalized.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._autoScaleGuard) return;
        const { width } = getParentDimensions(this.element);
        this._lastObservedWidth = width;
        forceUpdate(this);
      });
    });
  }

  disconnectedCallback() {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
  }

  /** Bubble charts label every point by default and show values inside bubbles. */
  private labelDefaults(): { points: LabelConfig["points"]; values: boolean; max: number } {
    return { points: "all", values: true, max: 12 };
  }

  /** Sets or clears a blocking error (type `error`) with a stable id. */
  private setBlockingError(id: string, message: string | null): void {
    if (message === null) {
      this.errors.remove(id);
      this.activeErrors.delete(id);
    } else {
      this.errors.addOrReplace({ id, type: "error", message });
      this.activeErrors.add(id);
    }
  }

  private hasBlockingErrors(): boolean {
    return this.activeErrors.size > 0;
  }

  /**
   * Revalidation hook probed by `withScalingGroup` on every scaling-group
   * store change: an unknown `size.group` name is a blocking error.
   */
  public validateSizeScaling(): void {
    const group = this.prepareSize()?.group;
    this.setBlockingError(
      "ERR_xy_scale_group",
      group !== undefined && !this.pixelPerUnitGroupMap.has(group)
        ? this.t(".bubble-scale-group-unknown", { group })
        : null,
    );
  }

  /** Shared validator for measure-carrying object props (x/y/size/share). */
  private validateMeasureSpec<T>(
    prop: "x" | "y" | "size" | "share",
    raw: string,
    required: boolean,
    convert: (data: Record<string, unknown>) => SpecResult<T>,
  ): void {
    const jsonId = `ERR_xy_json_${prop}`;
    const measureId = `ERR_xy_measure_${prop}`;
    const fieldsId = `WARN_xy_fields_${prop}`;

    const { data, parseError } = parseSpec(raw, "measure");

    if (parseError) {
      this.setBlockingError(jsonId, this.t(".xy-prop-json", { prop }));
      this.setBlockingError(measureId, null);
      this.errors.remove(fieldsId);
      return;
    }
    this.setBlockingError(jsonId, null);

    if (data === null) {
      this.setBlockingError(measureId, required ? this.t(".xy-measure-invalid", { prop, measure: "" }) : null);
      this.errors.remove(fieldsId);
      return;
    }

    const measure = (data.measure as string) ?? "";
    if (!isValidMeasureToken(measure)) {
      this.setBlockingError(measureId, this.t(".xy-measure-invalid", { prop, measure }));
    } else {
      this.setBlockingError(measureId, null);
    }

    this.reportSpecIssues(fieldsId, prop, convert(data));
  }

  /** Shared validator for optional object props (facet/labels/legend). */
  private validateObjectSpec<T>(
    prop: string,
    raw: string,
    convert: (data: Record<string, unknown>) => SpecResult<T>,
  ): void {
    const jsonId = `ERR_xy_json_${prop}`;
    const fieldsId = `WARN_xy_fields_${prop}`;

    const { data, parseError } = parseSpec(raw, null);

    if (parseError) {
      this.setBlockingError(jsonId, this.t(".xy-prop-json", { prop }));
      this.errors.remove(fieldsId);
      return;
    }
    this.setBlockingError(jsonId, null);

    if (data === null) {
      this.errors.remove(fieldsId);
      return;
    }

    this.reportSpecIssues(fieldsId, prop, convert(data));
  }

  /** Unknown sub-fields → warning, never error (forward compatibility). */
  private reportSpecIssues<T>(errId: string, prop: string, result: SpecResult<T> | null): void {
    const issues: string[] = [];
    if (result !== null && result.invalidFields.length > 0) {
      issues.push(`invalid: ${result.invalidFields.join(", ")}`);
    }
    if (result !== null && result.unknownKeys.length > 0) {
      issues.push(`unknown: ${result.unknownKeys.join(", ")}`);
    }

    if (issues.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `${prop}: ignored sub-fields (${issues.join("; ")}).`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  private prepareAxis(prop: "x" | "y", raw: string): AxisConfig | null {
    const { data, parseError } = parseSpec(raw, "measure");
    if (parseError || data === null) {
      return null;
    }
    const { config } = toAxisConfig(data);
    if (config === null || !isValidMeasureToken(config.measure)) {
      return null;
    }
    // An inverted explicit domain would silently swallow all points - ignore it.
    if (config.min !== undefined && config.max !== undefined && config.min >= config.max) {
      this.errors.addOrReplace({
        id: `WARN_xy_domain_${prop}`,
        type: "warning",
        message: `${prop}: min must be smaller than max; the override is ignored.`,
      });
      config.min = undefined;
      config.max = undefined;
    } else {
      this.errors.remove(`WARN_xy_domain_${prop}`);
    }
    return config;
  }

  private prepareSize(): SizeConfig | null {
    const { data, parseError } = parseSpec(this.size, "measure");
    if (parseError || data === null) {
      return null;
    }
    const { config } = toSizeConfig(data);
    if (config === null || !isValidMeasureToken(config.measure)) {
      return null;
    }
    return config;
  }

  private prepareShare(): ShareConfig | null {
    const { data, parseError } = parseSpec(this.share, "measure");
    if (parseError || data === null) {
      return null;
    }
    const { config } = toShareConfig(data);
    if (config === null || !isValidMeasureToken(config.measure)) {
      return null;
    }
    return config;
  }

  private prepareCompareFamily(): string | null {
    const value = this.compareWith?.trim().toLowerCase();
    return COMPARE_FAMILIES.includes(value) ? value : null;
  }

  private prepareLabels(): LabelConfig {
    const defaults = this.labelDefaults();
    const { data, parseError } = parseSpec(this.labels, null);
    if (parseError || data === null) {
      return { points: defaults.points, values: defaults.values, max: defaults.max };
    }
    return toLabelConfig(data, defaults).config!;
  }

  private prepareLegend(): LegendConfig {
    const { data, parseError } = parseSpec(this.legend, null);
    if (parseError || data === null) {
      return { show: true, position: "right" };
    }
    return toLegendConfig(data).config!;
  }

  private prepareFacet(): FacetConfig | null {
    const { data, parseError } = parseSpec(this.facet, null);
    if (parseError || data === null) {
      return null;
    }
    return toFacetConfig(data).config;
  }

  /** Point identity level; `auto` resolves to the dataset's deepest populated level. */
  private preparePointLevel(): PointLevel {
    const value = this.level?.trim().toLowerCase();
    if (value === "category") {
      return "category";
    }
    if (value === "subcategory") {
      return "subCategory";
    }
    const suggested = this.datasetMeta?.suggestedLevel;
    if (suggested === "rowGroup" || suggested === "category" || suggested === "subCategory") {
      return suggested;
    }
    return "category";
  }

  /** Series level; `auto` resolves to the parent of the point level. */
  private prepareSeriesLevel(pointLevel: PointLevel): GroupLevel | null {
    const value = this.seriesLevel?.trim().toLowerCase();
    if (value === "none") {
      return null;
    }
    if (value === "rowgroup") {
      return "rowGroup";
    }
    if (value === "category") {
      return "category";
    }
    if (pointLevel === "subCategory") {
      return "category";
    }
    if (pointLevel === "category") {
      return "rowGroup";
    }
    return null;
  }

  /**
   * Cross-prop checks: scenario-family consistency across all mapped
   * measures, `compareWith` constraints (differs from the primary family,
   * rejected with variance axes), and the facet > series > point level
   * order. Runs while preparing the template (stable-id add/remove).
   */
  private validateCrossProp(measures: (string | undefined)[], facet: FacetConfig | null): void {
    const families = new Set<string>();
    let hasVarianceMeasure = false;
    for (const measure of measures) {
      if (measure === undefined) {
        continue;
      }
      const ref = resolveMeasure(measure);
      if (ref === null) {
        continue;
      }
      if (ref.kind === "scenario") {
        families.add(scenarioFamily(ref.slot));
      } else {
        hasVarianceMeasure = true;
      }
    }
    this.setBlockingError(
      "ERR_xy_family",
      families.size > 1 ? this.t(".xy-family-mixed", { families: [...families].join(", ") }) : null,
    );

    const compareFamily = this.prepareCompareFamily();
    this.setBlockingError(
      "ERR_xy_compare_variance",
      compareFamily !== null && hasVarianceMeasure ? this.t(".xy-compare-variance") : null,
    );
    this.setBlockingError(
      "ERR_xy_compare_family",
      compareFamily !== null && families.size === 1 && families.has(compareFamily)
        ? `compare-with: '${compareFamily}' is already the primary scenario family.`
        : null,
    );

    const pointLevel = this.preparePointLevel();
    const seriesLevel = this.prepareSeriesLevel(pointLevel);
    const facetLevel: GroupLevel | null =
      facet !== null ? (facet.level === "rowgroup" ? "rowGroup" : "category") : null;

    let orderViolation: string | null = null;
    if (seriesLevel !== null && HIERARCHY_DEPTH[seriesLevel] >= HIERARCHY_DEPTH[pointLevel]) {
      orderViolation = `series '${seriesLevel}' vs point '${pointLevel}'`;
    }
    if (facetLevel !== null) {
      const below = seriesLevel ?? pointLevel;
      if (HIERARCHY_DEPTH[facetLevel] >= HIERARCHY_DEPTH[below]) {
        orderViolation = `facet '${facetLevel}' vs '${below}'`;
      }
    }
    this.setBlockingError(
      "ERR_xy_level_order",
      orderViolation !== null ? this.t(".xy-level-order", { detail: orderViolation }) : null,
    );
  }

  private parseAspect(value: string): number | null {
    const match = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(value ?? "");
    if (match === null) {
      return null;
    }
    const w = Number(match[1]);
    const numericH = Number(match[2]);
    if (w <= 0 || numericH <= 0) {
      return null;
    }
    return w / numericH;
  }

  private prepareAspect(): number {
    return this.parseAspect(this.aspect) ?? 16 / 9;
  }

  private prepareLimit(): number {
    const value = Math.floor(Number(this.limit) || 0);
    return value > 0 ? value : 0;
  }

  /**
   * Scaling-group mode: the group value is data units per em² of bubble
   * area; the inner chart expects area px² per unit, so the effective font
   * size applies squared.
   */
  private prepareSizeAreaPerUnit(): number {
    const group = this.prepareSize()?.group;
    if (group === undefined || !this.pixelPerUnitGroupMap.has(group)) {
      return 0;
    }
    const unitsPerEm2 = this.pixelPerUnitGroupMap.get(group)!;
    if (!(unitsPerEm2 > 0)) {
      return 0;
    }
    const effFontPx = this.getEffectiveFontPx();
    return (effFontPx * effFontPx) / unitsPerEm2;
  }

  private i18nLocalKeys(): string[] {
    return ["no-data", "axis.in", "legend.title", "legend.size", "legend.compare"];
  }

  private prepareI18n(): Map<string, string> {
    const i18nMapLocal = new Map(this.i18nLocalKeys().map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(globalLabelKeys.map((key) => [key, this.t("global.".concat(key))]));
    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }

  private prepareStyle(): XYChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: $["bn-chart-bubble"]["scaleFactors"],
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]["fontFamily"]}`,
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-bubble"]["axisStyles"],
        seriesColors: $["bn-chart-bubble"]["seriesColors"],
        padding: $["bn-chart-bubble"]["padding"],
      } as unknown as XYChartStyle;
    });
  }

  /**
   * Lazily generates this chart's layout state: host box (context- and
   * component-relative, CSS px), the canvas region, point count and
   * diagnostics. With `detail: "full"` the rendered marks and labels are
   * listed with their geometry (tag-classified - XY marks carry no ids).
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
    return collectXYFacadeState(
      this.element,
      "bn-chart-bubble-renderer",
      this.chartTitle || undefined,
      { fontSizePx, appliedScaleFactor: factor },
      origins,
      detail,
    );
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

  /** Facade-bound translator handed to the inner element for warning messages. */
  private readonly translateForInner = (key: string, data?: object): string => this.t(key, data);

  /**
   * Dataset field map: hierarchy fields plus the
   * 16 scenario slots; descriptions of currently-mapped slots reflect the
   * live mapping (e.g. `ac3 → "size: Net sales"`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const slots: Record<string, { type: string; isOptional: boolean; description: string }> = {};
    for (const family of ["ac", "pp", "fc", "pl"]) {
      for (const index of [1, 2, 3, 4]) {
        slots[`${family}${index}`] = { type: "number", isOptional: true, description: "" };
      }
    }

    const mapped: Record<string, { measure: string; label?: string } | null> = {
      x: this.prepareAxis("x", this.x),
      y: this.prepareAxis("y", this.y),
      size: this.prepareSize(),
      share: this.prepareShare(),
    };

    for (const [prop, config] of Object.entries(mapped)) {
      if (config === null) {
        continue;
      }
      const ref = resolveMeasure(config.measure);
      if (ref === null) {
        continue;
      }
      const label = config.label !== undefined ? config.label : config.measure;
      if (ref.kind === "scenario") {
        slots[ref.slot].description = `${prop}: ${label}`;
      } else {
        slots[ref.measure.base].description = `${prop}: ${config.measure} (base)`;
        slots[ref.measure.delta].description = `${prop}: ${config.measure} (delta)`;
      }
    }

    const compareFamily = this.prepareCompareFamily();
    if (compareFamily !== null) {
      for (const [prop, config] of Object.entries(mapped)) {
        if (config === null || prop === "share") {
          continue;
        }
        const ref = resolveMeasure(config.measure);
        if (ref !== null && ref.kind === "scenario") {
          const slot = compareFamily + ref.slot.replace(/^[a-z]+/, "");
          if (slots[slot].description === "") {
            slots[slot].description = `${prop}: compareWith`;
          }
        }
      }
    }

    return {
      IBubbleChartDataRow: {
        operation: { type: "string", isOptional: false, description: "" },
        rowGroup: { type: "string", isOptional: true, description: "" },
        rowGroupIndex: { type: "number", isOptional: true, description: "" },
        category: { type: "string", isOptional: false, description: "" },
        categoryIndex: { type: "number", isOptional: false, description: "" },
        subCategory: { type: "string", isOptional: true, description: "" },
        subCategoryIndex: { type: "number", isOptional: true, description: "" },
        ...slots,
      },
    };
  }

  private chartTemplate() {
    const x = this.prepareAxis("x", this.x);
    const y = this.prepareAxis("y", this.y);
    const size = this.prepareSize();
    const share = this.prepareShare();
    const facet = this.prepareFacet();
    this.validateCrossProp([x?.measure, y?.measure, size?.measure, share?.measure], facet);
    this.validateSizeScaling();

    if (this.hasBlockingErrors() || x === null || y === null || size === null) {
      return null;
    }

    const pointLevel = this.preparePointLevel();
    const preparedI18n = this.prepareI18n();
    const preparedStyle = this.prepareStyle();
    const fullParentWidth = getParentDimensions(this.element).width;

    return (
      <bn-chart-bubble-renderer
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.chartTitle}
        x={x}
        y={y}
        size={size}
        share={share}
        compareFamily={this.prepareCompareFamily()}
        labels={this.prepareLabels()}
        legend={this.prepareLegend()}
        facet={facet}
        pointLevel={pointLevel}
        seriesLevel={this.prepareSeriesLevel(pointLevel)}
        aspect={this.prepareAspect()}
        limit={this.prepareLimit()}
        filter={this.filter}
        sizeAreaPerUnit={this.prepareSizeAreaPerUnit()}
        styles={preparedStyle}
        i18n={preparedI18n}
        containerWidth={fullParentWidth}
        ruleSetConfig={this.ruleSetConfig()}
        errors={this.errors}
        translator={this.translateForInner}
      ></bn-chart-bubble-renderer>
    );
  }

  render() {
    return (
      <Host style={this.getFontStyles()}>
        <div class="container">{this.chartTemplate()}</div>
      </Host>
    );
  }
}
