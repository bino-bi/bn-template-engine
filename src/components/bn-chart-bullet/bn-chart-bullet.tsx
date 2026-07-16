import { Component, Element, forceUpdate, h, Host, Prop, State, Watch, writeTask } from "@stencil/core";
import { globalLabelKeys } from "../../stores/internationalization";
import { RuleSetConfig } from "../../stores/ruleSets";
import { AggregationLevel } from "../../utils/constants";
import { LayoutObserverHandle, observeParentResize } from "../../utils/layoutObserver";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import { getParentDimensions } from "../../utils/parentDimensions";
import { parseScaling } from "../../utils/scaling";
import { isBlankInput, isValidDirection, isValidInteger, validateOrderList } from "../../utils/validate";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withDataset from "../../utils/withDataset";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withRuleSet from "../../utils/withRuleSet";
import withTranslation from "../../utils/withTranslation";
import { withStyled } from "../../utils/styled/withStyled";
import { resolveMeasure } from "../../utils/xy/VarianceMeasure";
import { parseSpec, SpecResult } from "../../utils/xy/model/AxisConfig";
import { BulletChartStyle } from "./utils/model/BulletChartStyle";
import {
  BulletLabelConfig,
  BulletMeasureConfig,
  parseRanges,
  toBulletLabelConfig,
  toBulletMeasureConfig,
} from "./utils/model/BulletConfig";

/** Auto-detection preference for the target scenario. */
const TARGET_SLOT_PREFERENCE = ["pl1", "pp1", "fc1"];

/**
 * IBCS bullet graph: one horizontal row per KPI with a solid actual bar and
 * a target marker.
 *
 * Subscribes to a dataset (via `withDataset`) and renders in the IBCS
 * default mode with **normalized targets** — every row is scaled to
 * fractions of its target so one continuous target line spans all rows and
 * KPIs become visually comparable — plus integrated variance bars in the
 * IBCS variance colors. The classic Stephen Few look is opt-in via
 * `normalize="none"` (per-row scales) and `ranges` (max two qualitative
 * gray bands). Actual and target scenarios are auto-detected from the
 * dataset meta when not set. The heavy SVG rendering is performed by the
 * inner `ibcs-chart-bullet` element; this facade validates props, resolves
 * auto-detected metadata, and computes styles.
 */
@Component({
  tag: "bn-chart-bullet",
  styleUrl: "bn-chart-bullet.scss",
  shadow: true,
})
export class ChartBullet {
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
  /** Ids of currently-active blocking errors — the chart renders empty while any is set. */
  private readonly activeErrors: Set<string> = new Set();

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

  /**
   * Actual-value measure. JSON object or a bare scenario slot as shorthand:
   * `{"measure":"ac1","label":"Revenue","unit":"EUR k"}`. Only plain
   * scenario slots (`ac1`…`pl4`) are allowed — variance tokens are not.
   * Empty or `"auto"` auto-detects (`ac1`, else the first available
   * scenario).
   */
  @Prop() actual: string = "";
  @Watch("actual")
  validateActual(newValue: string) {
    this.validateMeasureSpec("actual", newValue);
  }

  /**
   * Target measure — same shape as `actual`. Empty or `"auto"` auto-detects
   * (`pl1` > `pp1` > `fc1`); without any target scenario the chart renders
   * actual bars only.
   */
  @Prop() target: string = "";
  @Watch("target")
  validateTarget(newValue: string) {
    this.validateMeasureSpec("target", newValue);
  }

  /**
   * Qualitative range bands as a JSON array of ascending fractions of the
   * target, at most two — e.g. `[0.6, 0.9]` (IBCS rejects a third band of
   * arbitrary length). Classic mode only; ignored while `normalize` is
   * `"target"`.
   */
  @Prop() ranges: string = "";
  @Watch("ranges")
  validateRanges(newValue: string) {
    const errId = "ERR_bullet_json_ranges";
    const warnId = "WARN_bullet_ranges";
    const parsed = parseRanges(newValue);

    if (parsed.parseError) {
      this.setBlockingError(errId, this.t(".bullet-prop-json", { prop: "ranges" }));
      this.errors.remove(warnId);
      return;
    }
    this.setBlockingError(errId, null);

    if (parsed.issues.length > 0) {
      this.errors.addOrReplace({
        id: warnId,
        type: "warning",
        message: this.t(".bullet-ranges-invalid", { detail: parsed.issues.join("; ") }),
      });
    } else {
      this.errors.remove(warnId);
    }
  }

  /**
   * Target normalization: `target` (default — rows share an aligned target
   * position, the IBCS-comparable form) or `none` (classic per-row scales
   * with tick strips).
   */
  @Prop() normalize: string = "target";
  @Watch("normalize")
  validateNormalize(newValue: string) {
    this.validateEnum("normalize", "ERR_normalize", newValue, ["target", "none"], "target");
  }

  /**
   * Variance bars between actual and target: `auto` (default — drawn in
   * normalized mode, favorable/unfavorable in the IBCS variance colors) or
   * `none`.
   */
  @Prop() variances: string = "auto";
  @Watch("variances")
  validateVariances(newValue: string) {
    this.validateEnum("variances", "ERR_variances", newValue, ["auto", "none"], "auto");
  }

  /**
   * KPI row level: `auto` (deepest populated level from the dataset meta),
   * `rowgroup`, `category`, or `subcategory`.
   */
  @Prop() level: string = "auto";
  @Watch("level")
  validateLevel(newValue: string) {
    this.validateEnum("level", "ERR_level", newValue, ["auto", "rowgroup", "category", "subcategory"], "auto");
  }

  /**
   * Sort key(s) of the KPI rows: hierarchy columns or scenario slots (e.g.
   * `"ac1"`), comma-separated for multi-level sorting. Empty or `"auto"`
   * uses the dataset's suggested order.
   */
  @Prop() order: string = "";
  @Watch("order")
  validateOrder(newValue: string) {
    const errId = "ERR_order";
    const invalid = validateOrderList(newValue).filter((entry) => entry !== "");
    if (invalid.length === 0) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `order: invalid value(s) '${invalid.join(", ")}'; using the dataset order.`,
      });
    }
  }

  /**
   * Sorting direction: `asc` or `desc`.
   */
  @Prop() orderDirection: string = "";
  @Watch("orderDirection")
  validateOrderDirection(newValue: string) {
    const errId = "ERR_orderDirection";
    if (isBlankInput(newValue) || isValidDirection(newValue)) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `order-direction: invalid value '${newValue}' — expected asc/desc; using asc.`,
      });
    }
  }

  /**
   * Maximum number of KPI rows (0 = unlimited). Truncates — there is no
   * REST aggregate, summing heterogeneous KPIs would be meaningless.
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
        message: `limit: invalid value '${newValue}' — expected a non-negative integer; using 0.`,
      });
    }
  }

  /**
   * Value labels. JSON object: `{"show":"auto"|"none","decimals":1}`.
   */
  @Prop() labels: string = "";
  @Watch("labels")
  validateLabels(newValue: string) {
    const jsonId = "ERR_bullet_json_labels";
    const fieldsId = "WARN_bullet_fields_labels";

    const { data, parseError } = parseSpec(newValue, null);

    if (parseError) {
      this.setBlockingError(jsonId, this.t(".bullet-prop-json", { prop: "labels" }));
      this.errors.remove(fieldsId);
      return;
    }
    this.setBlockingError(jsonId, null);

    if (data === null) {
      this.errors.remove(fieldsId);
      return;
    }

    this.reportSpecIssues(fieldsId, "labels", toBulletLabelConfig(data, this.labelDefaults()));
  }

  /**
   * Font-size auto-fit: `""`/`auto` shrink to the parent height (with/without
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
        message: `scale: invalid value '${newValue}' — expected none/auto or a positive number.`,
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
    this.componentStyle = withComponentStyle(this);
    this.ruleSetConfig = withRuleSet(this);
    this.t = withTranslation(this).t;
  }

  componentWillLoad() {
    this.validateActual(this.actual);
    this.validateTarget(this.target);
    this.validateRanges(this.ranges);
    this.validateNormalize(this.normalize);
    this.validateVariances(this.variances);
    this.validateLevel(this.level);
    this.validateOrder(this.order);
    this.validateOrderDirection(this.orderDirection);
    this.validateLimit(this.limit);
    this.validateLabels(this.labels);
    this.validateScale(this.scale);
  }

  private _autoScaleGuard = false;
  private _lastScaledParentHeight = 0;

  componentDidRender() {
    // Bullet height is data-driven (rows × rowHeight), so the auto-fit
    // scales against the parent HEIGHT — the structure-chart variant, not
    // the width-based XY one.
    const { mode } = parseScaling(this.scale);

    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      return;
    }

    if (this._autoScaleGuard) {
      this._autoScaleGuard = false;
      return;
    }

    const host = this.element;
    const { height: parentHeight } = getParentDimensions(host);
    if (parentHeight <= 0) return;

    this._lastScaledParentHeight = parentHeight;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const currentHeight = host.scrollHeight;
    const currentFactor = this.appliedScaleFactor;

    // Content fits at the current factor — don't reset to 1, it only fits
    // BECAUSE of the current factor (resetting would oscillate).
    if (currentHeight <= parentHeight + 1) {
      this.errors.remove("AUTO_scale");
      return;
    }

    const computedFactor = Math.max(0.3, (currentFactor * (parentHeight - 1)) / currentHeight);

    if (Math.abs(computedFactor - currentFactor) < 0.01) {
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
  }

  componentDidLoad() {
    // Watch for size changes (window resize, card relayout) — height only.
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { height } = getParentDimensions(this.element);
      if (height > 0 && Math.abs(height - this._lastScaledParentHeight) > 2) {
        this._lastScaledParentHeight = height;
        forceUpdate(this);
      }
    });

    // Double-rAF: guarantees the browser completed at least one full paint
    // cycle so all nested card/body/grid layouts are finalized.
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

  private labelDefaults(): { show: BulletLabelConfig["show"]; decimals: number } {
    return { show: "auto", decimals: 1 };
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

  /** Shared validator for the measure-carrying object props (actual/target). */
  private validateMeasureSpec(prop: "actual" | "target", raw: string): void {
    const jsonId = `ERR_bullet_json_${prop}`;
    const measureId = `ERR_bullet_measure_${prop}`;
    const fieldsId = `WARN_bullet_fields_${prop}`;

    const { data, parseError } = parseSpec(raw, "measure");

    if (parseError) {
      this.setBlockingError(jsonId, this.t(".bullet-prop-json", { prop }));
      this.setBlockingError(measureId, null);
      this.errors.remove(fieldsId);
      return;
    }
    this.setBlockingError(jsonId, null);

    if (data === null) {
      // Blank is valid — the measure is auto-detected.
      this.setBlockingError(measureId, null);
      this.errors.remove(fieldsId);
      return;
    }

    const measure = ((data.measure as string) ?? "").trim();
    const ref = resolveMeasure(measure);
    // Plain scenario slots only — the bullet variance is implicit
    // (actual vs target), variance tokens have no meaning here.
    if (measure.toLowerCase() !== "auto" && (ref === null || ref.kind !== "scenario")) {
      this.setBlockingError(measureId, this.t(".bullet-measure-invalid", { prop, measure }));
    } else {
      this.setBlockingError(measureId, null);
    }

    this.reportSpecIssues(fieldsId, prop, toBulletMeasureConfig(data));
  }

  private validateEnum(prop: string, errId: string, raw: string, valid: string[], fallback: string): void {
    if (isBlankInput(raw) || valid.includes(raw.trim().toLowerCase())) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `${prop}: invalid value '${raw}' — expected ${valid.join("/")}; using '${fallback}'.`,
      });
    }
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

  /**
   * Resolved actual measure. Blank/`auto` auto-detects `ac1`, else the
   * first `ac*` slot, else the first available scenario — blank (unlike an
   * explicit `auto`) additionally raises the `AUTO_actual` info warning
   * (structure-chart convention).
   */
  private prepareActual(): BulletMeasureConfig | null {
    const { data, parseError } = parseSpec(this.actual, "measure");
    if (parseError) {
      return null;
    }
    const config = data !== null ? toBulletMeasureConfig(data).config : null;

    if (config === null || config.measure.toLowerCase() === "auto") {
      const explicitAuto = config !== null;
      const available = this.datasetMeta?.availableScenarios ?? [];
      const detected =
        (available.includes("ac1") ? "ac1" : (available.find((slot) => slot.startsWith("ac")) ?? available[0])) ??
        "ac1";
      if (!explicitAuto && this.datasetMeta !== null) {
        this.errors.addOrReplace({
          id: "AUTO_actual",
          type: "warning",
          message: `actual: not set, auto-detected: ${detected}`,
        });
      } else {
        this.errors.remove("AUTO_actual");
      }
      return config === null ? { measure: detected } : { ...config, measure: detected };
    }

    this.errors.remove("AUTO_actual");
    return resolveMeasure(config.measure)?.kind === "scenario" ? config : null;
  }

  /**
   * Resolved target measure. Blank/`auto` auto-detects `pl1` > `pp1` >
   * `fc1`; when the dataset offers none the chart renders actual bars only
   * (with a warning) and `null` is returned.
   */
  private prepareTarget(): BulletMeasureConfig | null {
    const { data, parseError } = parseSpec(this.target, "measure");
    if (parseError) {
      return null;
    }
    const config = data !== null ? toBulletMeasureConfig(data).config : null;

    if (config === null || config.measure.toLowerCase() === "auto") {
      const explicitAuto = config !== null;
      const available = this.datasetMeta?.availableScenarios ?? [];
      const detected = TARGET_SLOT_PREFERENCE.find((slot) => available.includes(slot));

      if (detected === undefined) {
        this.errors.remove("AUTO_target");
        // Distinct id from the orchestrator-synced WARN_bullet-target-none:
        // the inner element's sync walk would otherwise clear this warning.
        if (this.datasetMeta !== null) {
          this.errors.addOrReplace({
            id: "WARN_bullet_target_unavailable",
            type: "warning",
            message: this.t(".bullet-target-none"),
          });
        } else {
          this.errors.remove("WARN_bullet_target_unavailable");
        }
        return null;
      }

      this.errors.remove("WARN_bullet_target_unavailable");
      if (!explicitAuto && this.datasetMeta !== null) {
        this.errors.addOrReplace({
          id: "AUTO_target",
          type: "warning",
          message: `target: not set, auto-detected: ${detected}`,
        });
      } else {
        this.errors.remove("AUTO_target");
      }
      return config === null ? { measure: detected } : { ...config, measure: detected };
    }

    this.errors.remove("AUTO_target");
    this.errors.remove("WARN_bullet_target_unavailable");
    return resolveMeasure(config.measure)?.kind === "scenario" ? config : null;
  }

  private prepareNormalize(): "target" | "none" {
    return this.normalize?.trim().toLowerCase() === "none" ? "none" : "target";
  }

  private prepareShowVariances(): boolean {
    return this.variances?.trim().toLowerCase() !== "none";
  }

  /** KPI row level; `auto` resolves to the dataset's deepest populated level. */
  private prepareLevel(): AggregationLevel {
    const value = this.level?.trim().toLowerCase();
    if (value === "rowgroup") {
      return AggregationLevel.ROWGROUP;
    }
    if (value === "category") {
      return AggregationLevel.CATEGORY;
    }
    if (value === "subcategory") {
      return AggregationLevel.SUBCATEGORY;
    }
    const suggested = this.datasetMeta?.suggestedLevel;
    if (suggested !== undefined && suggested !== "") {
      const resolved = AggregationLevel[suggested.toUpperCase() as keyof typeof AggregationLevel];
      if (resolved !== undefined) {
        return resolved;
      }
    }
    return AggregationLevel.CATEGORY;
  }

  /** Sort order; blank/`auto` uses the dataset's suggested order (structure-chart convention). */
  private prepareOrder(): Order {
    const isAuto = this.order?.trim().toLowerCase() === "auto";
    let orderStr: string;
    if (isBlankInput(this.order) || isAuto) {
      if (this.datasetMeta?.suggestedOrder) {
        if (!isAuto) {
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
        this.errors.remove("AUTO_order");
        orderStr = "";
      }
    } else {
      this.errors.remove("AUTO_order");
      orderStr = this.order;
    }

    const direction =
      OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection] ?? OrderDirection.ASC;

    if (isBlankInput(orderStr)) {
      return new Order([OrderColumn.CATEGORYINDEX], direction);
    }

    const hierarchy = orderStr
      .split(",")
      .map((entry) => OrderColumn[entry.trim().toUpperCase() as keyof typeof OrderColumn])
      .filter((entry) => entry !== undefined);
    return new Order(hierarchy.length > 0 ? hierarchy : [OrderColumn.CATEGORYINDEX], direction);
  }

  private prepareLabels(): BulletLabelConfig {
    const defaults = this.labelDefaults();
    const { data, parseError } = parseSpec(this.labels, null);
    if (parseError || data === null) {
      return { show: defaults.show, decimals: defaults.decimals };
    }
    return toBulletLabelConfig(data, defaults).config!;
  }

  private prepareLimit(): number {
    const value = Math.floor(Number(this.limit) || 0);
    return value > 0 ? value : 0;
  }

  private i18nLocalKeys(): string[] {
    return ["no-data", "target", "axis.in"];
  }

  private prepareI18n(): Map<string, string> {
    const i18nMapLocal = new Map(this.i18nLocalKeys().map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(globalLabelKeys.map((key) => [key, this.t("global.".concat(key))]));
    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }

  private prepareStyle(): BulletChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: $["bn-chart-bullet"]["scaleFactors"],
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]["fontFamily"]}`,
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-bullet"]["axisStyles"],
        barStyles: $["bn-chart-bullet"]["barStyles"],
        varianceStyles: $["bn-chart-bullet"]["varianceStyles"],
        rangeColors: $["bn-chart-bullet"]["rangeColors"],
        padding: $["bn-chart-bullet"]["padding"],
      } as unknown as BulletChartStyle;
    });
  }

  private getEffectiveScaleFactor(): number {
    const { mode, factor } = parseScaling(this.scale);
    if (mode === "factor") return factor!;
    if (mode === "auto" || mode === "empty") return this.appliedScaleFactor;
    return 1;
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
   * Dataset field map for the editor-companion: hierarchy fields plus the
   * 16 scenario slots; descriptions of currently-mapped slots reflect the
   * live mapping (e.g. `pl1 → "target: Plan"`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const slots: Record<string, { type: string; isOptional: boolean; description: string }> = {};
    for (const family of ["ac", "pp", "fc", "pl"]) {
      for (const index of [1, 2, 3, 4]) {
        slots[`${family}${index}`] = { type: "number", isOptional: true, description: "" };
      }
    }

    const mapped: Record<string, BulletMeasureConfig | null> = {
      actual: this.prepareActual(),
      target: this.prepareTarget(),
    };

    for (const [prop, config] of Object.entries(mapped)) {
      if (config === null || slots[config.measure] === undefined) {
        continue;
      }
      const label = config.label !== undefined ? config.label : config.measure;
      slots[config.measure].description = `${prop}: ${label}`;
    }

    return {
      IBulletChartDataRow: {
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
    const actual = this.prepareActual();
    const target = this.prepareTarget();
    const ranges = parseRanges(this.ranges).ranges;
    const normalize = this.prepareNormalize();

    this.setBlockingError(
      "ERR_bullet_measure_same",
      actual !== null && target !== null && actual.measure === target.measure
        ? this.t(".bullet-measure-same", { measure: actual.measure })
        : null,
    );

    if (ranges.length > 0 && normalize === "target") {
      this.errors.addOrReplace({
        id: "WARN_bullet_ranges_ignored",
        type: "warning",
        message: this.t(".bullet-ranges-ignored"),
      });
    } else {
      this.errors.remove("WARN_bullet_ranges_ignored");
    }

    if (this.hasBlockingErrors() || actual === null) {
      return null;
    }

    return (
      <ibcs-chart-bullet
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.chartTitle}
        actual={actual}
        target={target}
        ranges={ranges}
        normalize={normalize}
        showVariances={this.prepareShowVariances()}
        level={this.prepareLevel()}
        order={this.prepareOrder()}
        limit={this.prepareLimit()}
        labels={this.prepareLabels()}
        filter={this.filter}
        styles={this.prepareStyle()}
        i18n={this.prepareI18n()}
        containerWidth={getParentDimensions(this.element).width}
        ruleSetConfig={this.ruleSetConfig()}
        errors={this.errors}
        translate={this.translateForInner}
      ></ibcs-chart-bullet>
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
