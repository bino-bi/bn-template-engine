import { Component, Element, forceUpdate, h, Host, Prop, State, Watch, writeTask } from "@stencil/core";
import { globalLabelKeys } from "../../stores/internationalization";
import { RuleSetConfig } from "../../stores/ruleSets";
import { getParentDimensions } from "../../utils/parentDimensions";
import { LayoutObserverHandle, observeParentResize } from "../../utils/layoutObserver";
import { parseScaling } from "../../utils/scaling";
import { isBlankInput, isValidInteger, isValidMeasureToken } from "../../utils/validate";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withDataset from "../../utils/withDataset";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withRuleSet from "../../utils/withRuleSet";
import withTranslation from "../../utils/withTranslation";
import { withStyled } from "../../utils/styled/withStyled";
import { resolveMeasure, scenarioFamily } from "../../utils/xy/VarianceMeasure";
import {
  AxisConfig,
  FacetConfig,
  IsoConfig,
  LabelConfig,
  LegendConfig,
  parseSpec,
  SpecResult,
  toAxisConfig,
  toFacetConfig,
  toIsoConfig,
  toLabelConfig,
  toLegendConfig,
} from "../../utils/xy/model/AxisConfig";
import { GroupLevel, PointLevel } from "../../utils/xy/model/XYChartDataRow";
import { XYChartStyle } from "../../utils/xy/model/XYChartStyle";

const HIERARCHY_DEPTH: Record<string, number> = { rowGroup: 0, category: 1, subCategory: 2 };

/**
 * SVG scattergram following IBCS template C09.
 *
 * Subscribes to a dataset (via `withDataset`) and renders an XY point cloud
 * with series hues, selective labels, highlight bands, and hyperbolic
 * iso-lines (`x·y = k`). The heavy SVG rendering is performed by the inner
 * `ibcs-chart-scatter` element; this facade validates props, resolves
 * auto-detected metadata, and computes styles.
 */
@Component({
  tag: "bn-chart-scatter",
  styleUrl: "bn-chart-scatter.scss",
  shadow: true,
})
export class ChartScatter {
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
   * X axis mapping. JSON object (`AxisSpec`) or a bare measure token as
   * shorthand: `{"measure":"ac1","label":"Margin","unit":"%","min":0,
   * "max":40,"refLine":0.5,"highlight":{"from":30}}`. The measure is a
   * scenario column (`ac1`…`pl4`) or a variance token (`d…`/`dr…`,
   * sentiment suffix optional).
   */
  @Prop() x!: string;
  @Watch("x")
  validateX(newValue: string) {
    this.validateAxisSpec("x", newValue);
  }

  /**
   * Y axis mapping — same shape as `x`.
   */
  @Prop() y!: string;
  @Watch("y")
  validateY(newValue: string) {
    this.validateAxisSpec("y", newValue);
  }

  /**
   * Hyperbolic iso-lines `x·y = k` (IBCS 09C/09D). JSON object:
   * `{"values":"auto"|[1,2,3],"label":"Gross profit","unit":"mUSD",
   * "highlight":{"from":3}}`. Requires a strictly positive plot domain.
   */
  @Prop() iso: string = "";
  @Watch("iso")
  validateIso(newValue: string) {
    this.validateObjectSpec("iso", newValue, null, (data) => toIsoConfig(data));
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
        message: `level: invalid value '${newValue}' — expected ${valid.join("/")}; using 'auto'.`,
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
        message: `series-level: invalid value '${newValue}' — expected ${valid.join("/")}; using 'auto'.`,
      });
    }
  }

  /**
   * Small-multiple panels (IBCS 10E/10F/10G style). JSON object:
   * `{"level":"rowgroup"|"category","columns":6}`. The facet level must sit
   * above the series level in the hierarchy.
   */
  @Prop() facet: string = "";
  @Watch("facet")
  validateFacet(newValue: string) {
    this.validateObjectSpec("facet", newValue, null, (data) => toFacetConfig(data));
  }

  /**
   * Point labeling. JSON object: `{"points":"auto"|"none"|"all"|["VAB"],
   * "max":12}` (IBCS requires selective, proximate labels).
   */
  @Prop() labels: string = "";
  @Watch("labels")
  validateLabels(newValue: string) {
    this.validateObjectSpec("labels", newValue, null, (data) => toLabelConfig(data, this.labelDefaults()));
  }

  /**
   * Series-color legend. JSON object: `{"show":true,"position":"right"|"bottom"}`.
   */
  @Prop() legend: string = "";
  @Watch("legend")
  validateLegend(newValue: string) {
    this.validateObjectSpec("legend", newValue, null, (data) => toLegendConfig(data));
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
        message: `aspect: invalid value '${newValue}' — expected "w:h" (e.g. "16:9"); using the default.`,
      });
    }
  }

  /**
   * Maximum number of points per panel (0 = unlimited). Scatter keeps the
   * first N rows in dataset order.
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
    this.validateX(this.x);
    this.validateY(this.y);
    this.validateIso(this.iso);
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
    const { mode } = parseScaling(this.scale);

    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      const parent = getParentDimensions(this.element);
      const errId = "WARN_overflow";
      if (parent.width > 0 && this.element.scrollWidth > parent.width + 1) {
        this.errors.addOrReplace({
          id: errId,
          type: "warning",
          message: "Chart exceeds available space and will be cut off. Check the scale value.",
        });
      } else {
        this.errors.remove(errId);
      }
      return;
    }

    if (this._autoScaleGuard) {
      this._autoScaleGuard = false;
      return;
    }

    const host = this.element;
    const { width: parentWidth } = getParentDimensions(host);
    if (parentWidth <= 0) return;

    this._lastObservedWidth = parentWidth;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const currentWidth = host.scrollWidth;
    const currentFactor = this.appliedScaleFactor;

    if (!Number.isFinite(currentWidth) || currentWidth <= parentWidth + 1) {
      this.errors.remove("AUTO_scale");
      return;
    }

    const computedFactor = Math.max(0.3, (currentFactor * (parentWidth - 1)) / currentWidth);

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
    // Watch for size changes (window resize, card relayout) — width only.
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { width } = getParentDimensions(this.element);
      if (width > 0 && Math.abs(width - this._lastObservedWidth) > 2) {
        this._lastObservedWidth = width;
        forceUpdate(this);
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

  /** Default label behavior differs between scatter (`auto`) and bubble (`all`). */
  protected labelDefaults(): { points: LabelConfig["points"]; values: boolean; max: number } {
    return { points: "auto", values: false, max: 12 };
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

  /** Shared validator for the x/y axis props. */
  protected validateAxisSpec(prop: "x" | "y" | "size" | "share", raw: string): void {
    const jsonId = `ERR_xy_json_${prop}`;
    const measureId = `ERR_xy_measure_${prop}`;
    const fieldsId = `WARN_xy_fields_${prop}`;
    const required = prop === "x" || prop === "y" || prop === "size";

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

    const result = prop === "share" ? null : toAxisConfig(data);
    const measure = (data.measure as string) ?? "";

    if (!isValidMeasureToken(measure)) {
      this.setBlockingError(measureId, this.t(".xy-measure-invalid", { prop, measure }));
    } else {
      this.setBlockingError(measureId, null);
    }

    this.reportSpecIssues(fieldsId, prop, result);
  }

  /** Shared validator for optional object props (iso/facet/labels/legend/…). */
  protected validateObjectSpec<T>(
    prop: string,
    raw: string,
    shorthandKey: string | null,
    convert: (data: Record<string, unknown>) => SpecResult<T>,
  ): void {
    const jsonId = `ERR_xy_json_${prop}`;
    const fieldsId = `WARN_xy_fields_${prop}`;

    const { data, parseError } = parseSpec(raw, shorthandKey);

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

  protected prepareAxis(prop: "x" | "y", raw: string): AxisConfig | null {
    const { data, parseError } = parseSpec(raw, "measure");
    if (parseError || data === null) {
      return null;
    }
    const { config } = toAxisConfig(data);
    if (config === null || !isValidMeasureToken(config.measure)) {
      return null;
    }
    // An inverted explicit domain would silently swallow all points — ignore it.
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

  private prepareIso(): IsoConfig | null {
    const { data, parseError } = parseSpec(this.iso, null);
    if (parseError || data === null) {
      return null;
    }
    return toIsoConfig(data).config;
  }

  protected prepareLabels(): LabelConfig {
    const defaults = this.labelDefaults();
    const { data, parseError } = parseSpec(this.labels, null);
    if (parseError || data === null) {
      return { points: defaults.points, values: defaults.values, max: defaults.max };
    }
    return toLabelConfig(data, defaults).config!;
  }

  protected prepareLegend(): LegendConfig {
    const { data, parseError } = parseSpec(this.legend, null);
    if (parseError || data === null) {
      return { show: true, position: "right" };
    }
    return toLegendConfig(data).config!;
  }

  protected prepareFacet(): FacetConfig | null {
    const { data, parseError } = parseSpec(this.facet, null);
    if (parseError || data === null) {
      return null;
    }
    return toFacetConfig(data).config;
  }

  /** Point identity level; `auto` resolves to the dataset's deepest populated level. */
  protected preparePointLevel(): PointLevel {
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
  protected prepareSeriesLevel(pointLevel: PointLevel): GroupLevel | null {
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
   * Cross-prop checks that need several parsed props at once: the scenario
   * family of all mapped measures and the facet > series > point level
   * order. Runs while preparing the template (stable-id add/remove).
   */
  protected validateCrossProp(measures: (string | undefined)[], facet: FacetConfig | null): void {
    const families = new Set<string>();
    for (const measure of measures) {
      if (measure === undefined) {
        continue;
      }
      const ref = resolveMeasure(measure);
      if (ref !== null && ref.kind === "scenario") {
        families.add(scenarioFamily(ref.slot));
      }
    }
    this.setBlockingError(
      "ERR_xy_family",
      families.size > 1 ? this.t(".xy-family-mixed", { families: [...families].join(", ") }) : null,
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

  protected prepareAspect(): number {
    return this.parseAspect(this.aspect) ?? 16 / 9;
  }

  protected prepareLimit(): number {
    const value = Math.floor(Number(this.limit) || 0);
    return value > 0 ? value : 0;
  }

  /** Local i18n keys handed to the inner element (bubble adds its legend keys). */
  protected i18nLocalKeys(): string[] {
    return ["no-data", "axis.in", "legend.title"];
  }

  protected prepareI18n(): Map<string, string> {
    const i18nMapLocal = new Map(this.i18nLocalKeys().map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(globalLabelKeys.map((key) => [key, this.t("global.".concat(key))]));
    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }

  protected prepareStyle(): XYChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    const tag = this.element.localName as "bn-chart-scatter" | "bn-chart-bubble";
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: $[tag]["scaleFactors"],
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]["fontFamily"]}`,
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $[tag]["axisStyles"],
        seriesColors: $[tag]["seriesColors"],
        padding: $[tag]["padding"],
      } as unknown as XYChartStyle;
    });
  }

  protected getEffectiveScaleFactor(): number {
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
   * live mapping (e.g. `ac1 → "x: Margin"`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const slots: Record<string, { type: string; isOptional: boolean; description: string }> = {};
    for (const family of ["ac", "pp", "fc", "pl"]) {
      for (const index of [1, 2, 3, 4]) {
        slots[`${family}${index}`] = { type: "number", isOptional: true, description: "" };
      }
    }

    for (const [prop, config] of Object.entries(this.mappedAxes())) {
      if (config === null) {
        continue;
      }
      const ref = resolveMeasure(config.measure);
      if (ref === null) {
        continue;
      }
      const label = "label" in config && config.label !== undefined ? config.label : config.measure;
      if (ref.kind === "scenario") {
        slots[ref.slot].description = `${prop}: ${label}`;
      } else {
        slots[ref.measure.base].description = `${prop}: ${config.measure} (base)`;
        slots[ref.measure.delta].description = `${prop}: ${config.measure} (delta)`;
      }
    }

    return {
      [this.dataStructureName()]: {
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

  /** Mapped measure-carrying configs by prop name (overridden by the bubble chart). */
  protected mappedAxes(): Record<string, AxisConfig | null> {
    return {
      x: this.prepareAxis("x", this.x),
      y: this.prepareAxis("y", this.y),
    };
  }

  protected dataStructureName(): string {
    return "IScatterChartDataRow";
  }

  protected chartTemplate() {
    const x = this.prepareAxis("x", this.x);
    const y = this.prepareAxis("y", this.y);
    const facet = this.prepareFacet();
    this.validateCrossProp([x?.measure, y?.measure], facet);

    if (this.hasBlockingErrors() || x === null || y === null) {
      return null;
    }

    const pointLevel = this.preparePointLevel();
    const preparedI18n = this.prepareI18n();
    const preparedStyle = this.prepareStyle();
    const fullParentWidth = getParentDimensions(this.element).width;

    return (
      <ibcs-chart-scatter
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.chartTitle}
        x={x}
        y={y}
        iso={this.prepareIso()}
        labels={this.prepareLabels()}
        legend={this.prepareLegend()}
        facet={facet}
        pointLevel={pointLevel}
        seriesLevel={this.prepareSeriesLevel(pointLevel)}
        aspect={this.prepareAspect()}
        limit={this.prepareLimit()}
        filter={this.filter}
        styles={preparedStyle}
        i18n={preparedI18n}
        containerWidth={fullParentWidth}
        ruleSetConfig={this.ruleSetConfig()}
        errors={this.errors}
        translate={this.translateForInner}
      ></ibcs-chart-scatter>
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
