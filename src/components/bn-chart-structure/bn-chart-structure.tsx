import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import {
  isBlankInput,
  isValidBoolean,
  isValidDirection,
  isValidInteger,
  isValidLevel,
  isValidMeasureScale,
  isValidNumber,
  validateOrderList,
  validateScenarioList,
  validateStackConfig,
  validateVariancesList,
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withInheritedProps, { InheritedResolver, isInheritedValue } from "../../utils/withInheritedProps";
import { getParentDimensions, ParentDimensions } from "../../utils/parentDimensions";
import { parseScaling } from "../../utils/scaling";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { Style } from "../../stores/componentStyles";
import { StructureChartDataRow } from "./utils/model";
import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed } from "./utils/model/StructureChartComponentConfig";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";

/**
 * SVG structure (categorical) bar chart following IBCS standards.
 *
 * Subscribes to a dataset (via `withDataset`) and renders horizontal bar
 * charts grouped by category, with up to four scenario layers, optional
 * variance sub-charts, stacking, and proportional auto-scaling (height-
 * based). The heavy SVG rendering is performed by the inner
 * `ibcs-chart-structure` element; this outer component validates props,
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

  @State() data: StructureChartDataRow[] = [];
  @State() private datasetMeta: DatasetMeta | null = null;
  @State() private appliedScaleFactor: number = 1;

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private readonly errors: ErrorDispatcher;
  private readonly resolveInherited: InheritedResolver;

  /**
   * Title displayed above the chart. When empty, the title is derived
   * from the variance scenario labels (if variances are configured).
   *
   * @example chart-title="Revenue by Category"
   */
  @Prop()
  chartTitle: string = "";

  /**
   * AlaSQL WHERE clause fragment injected into the data query to filter
   * rows before rendering.
   *
   * @example filter="rowGroup = 'Revenue'"
   */
  @Prop()
  filter: string = "";

  /**
   * Comma-separated list of scenario columns to display as bars.
   * Up to 4 scenarios are supported; additional values are ignored.
   *
   * Valid scenario names: `ac1`–`ac4`, `fc1`–`fc4`, `pp1`–`pp4`, `pl1`–`pl4`.
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
   * Controls horizontal bar scaling (pixels per data unit).
   *
   * | Value          | Behavior                                                        |
   * |----------------|-----------------------------------------------------------------|
   * | `"auto"`       | Auto-fit bars to fill the available container width (no warning) |
   * | not set / `""` | Same as auto, but emits `AUTO_unitScaling` warning              |
   * | `"0.03"`, `1`  | Explicit pixels-per-unit value; bars scale proportionally       |
   * | group name     | References a shared scaling group for synchronized charts       |
   *
   * When using a custom value that causes the chart to exceed its container,
   * a `WARN_overflow` error is emitted.
   *
   * @example unit-scaling="auto"
   * @example unit-scaling="0.05"
   */
  @Prop() unitScaling!: string | number;

  @Watch("unitScaling")
  validateUnitScaling(newValue: string | number) {
    const errId: string = "ERR_unitScaling";

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
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
   * Controls scaling of relative variance bars (pixels per percentage point).
   *
   * | Value          | Behavior                                                      |
   * |----------------|---------------------------------------------------------------|
   * | `"auto"`       | Auto-fit to available width                                   |
   * | not set / `""` | Same as auto with warning                                     |
   * | `"50"`, `1.5`  | Explicit pixels-per-percentage-point value                    |
   * | group name     | References a shared scaling group for synchronized charts     |
   *
   * @example percentage-scaling="50"
   */
  @Prop() percentageScaling!: string | number;
  @Watch("percentageScaling")
  validatePercentageScaling(newValue: string | number) {
    const errId: string = "ERR_percentageScaling";

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
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
   * `subCategory`, `subCategoryIndex`, `ac1`–`ac4`, `fc1`–`fc4`, `pp1`–`pp4`, `pl1`–`pl4`.
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
    if (isInheritedValue(newValue)) {
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
  @Prop() showCategories: string = "true";

  @Watch("showCategories")
  validateShowCategories(newValue: string) {
    const errId: string = "ERR_showCategories";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "showCategories: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

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
  @Prop() showMeasureScale: string = "false";

  @Watch("showMeasureScale")
  validateShowMeasureScale(newValue: string) {
    const errId: string = "ERR_grouped";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "showMeasureScale: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

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
   * - `by: "scenarios"` — stacks the scenarios listed in the `scenarios` prop end-to-end.
   * - `by: "dimensions"` — stacks by the next-lower hierarchy level derived from `level`
   *   (e.g. level `"rowGroup"` stacks by category). Only the first scenario is used;
   *   extra scenarios trigger a `WARN_stack_dimensions_scenarios` warning.
   * - `mode: "relative"` — normalizes each bar to 100%, showing proportions.
   * - `mode: "absolute-relative"` — absolute bars with percentage labels.
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
   * | `"0.5"`, `"1.2"`, … | Fixed factor — apply `baseFontSize × factor`                                      |
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

  private scenariosArray: string[] = [""];
  private canvasWidthSegmented: number;
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    withDataset(
      this,
      (_name, data) => {
        this.data = (data || []) as StructureChartDataRow[];
      },
      (_name, meta) => {
        this.datasetMeta = meta;
      },
    );
    this.chartTemplate = this.chartTemplate.bind(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
    this.t = withTranslation(this).t;
    this.resolveInherited = withInheritedProps(this, [
      { propName: "scenarios", ancestorAttr: "title-scenarios" },
      { propName: "variances", ancestorAttr: "title-variances" },
      { propName: "order", ancestorAttr: "title-order" },
      { propName: "orderDirection", ancestorAttr: "title-order-direction" },
    ]);
  }

  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateUnitScaling(this.unitScaling);
    //this.validateSelectedStyle(this.selectedStyle);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateShowCategories(this.showCategories);
    this.validateMeasureScale(this.measureScale);
    this.validateShowMeasureScale(this.showMeasureScale);
    this.validateStack(this.stack);
    this.validateScaling(this.scale);
  }

  private _autoScaleGuard = false;

  componentDidRender() {
    const { mode } = parseScaling(this.scale);

    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      this.checkWidthOverflow();
      return;
    }

    if (this._autoScaleGuard) {
      this._autoScaleGuard = false;
      this.checkWidthOverflow();
      return;
    }

    const host = this.element;
    const { height: parentHeight } = getParentDimensions(host);
    if (parentHeight <= 0) {
      this.checkWidthOverflow();
      return;
    }

    // Measure at base (unscaled) font size to get true content height
    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);
    host.style.setProperty("--bn-font-size", `${baseFontSize}px`);

    // Reading scrollHeight forces a synchronous reflow at base size
    const div = host.shadowRoot?.querySelector(".container");
    const unscaledHeight = div?.scrollHeight ?? host.scrollHeight;

    if (unscaledHeight <= parentHeight + 1) {
      this.errors.remove("AUTO_scale");
      if (this.appliedScaleFactor !== 1) {
        this._autoScaleGuard = true;
        this.appliedScaleFactor = 1;
      }
      this.checkWidthOverflow();
      return;
    }

    const computedFactor = (parentHeight - 1) / unscaledHeight;

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

    if (Math.abs(computedFactor - this.appliedScaleFactor) > 0.001) {
      this._autoScaleGuard = true;
      this.appliedScaleFactor = computedFactor;
    }

    this.checkWidthOverflow();
  }

  /**
   * Emits an error when a custom unit-scaling value causes the chart to exceed its container width.
   * Skipped for auto/unset unit-scaling since auto-fit handles width.
   */
  private checkWidthOverflow(): void {
    const errId = "WARN_overflow";
    const us = String(this.unitScaling ?? "")
      .trim()
      .toLowerCase();
    if (us === "" || us === "auto") {
      this.errors.remove(errId);
      return;
    }
    const parent = getParentDimensions(this.element);
    if (parent.width > 0 && this.element.scrollWidth > parent.width + 1) {
      this.errors.addOrReplace({
        id: errId,
        type: "error",
        message: `Chart exceeds available width (${this.element.scrollWidth}px > ${Math.round(parent.width)}px). Reduce unit-scaling or set to "auto".`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  prepareDimension(): ParentDimensions {
    const parent = getParentDimensions(this.element);
    this.canvasWidthSegmented = parent.width / this.scenariosArray.length;
    return { width: this.canvasWidthSegmented, height: parent.height };
  }

  private prepareScenarios(): string[] {
    const inherited = this.resolveInherited("scenarios", this.scenarios);
    if (inherited !== undefined) {
      this.errors.remove("AUTO_scenarios");
      return inherited.split(",").map((entry) => entry.trim());
    }
    const isAuto = this.scenarios?.trim().toLowerCase() === "auto";
    if (isBlankInput(this.scenarios) || isAuto) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        if (!isAuto) {
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
    return this.scenarios?.split(",").map((entry) => entry.trim());
  }

  private prepareVariances(): string[] {
    const inherited = this.resolveInherited("variances", this.variances);
    if (inherited !== undefined) {
      return inherited.split(",").map((entry) => entry.trim());
    }
    if (isBlankInput(this.variances)) {
      return [];
    }
    return this.variances?.split(",").map((entry) => entry.trim());
  }

  private prepareHideCategories(idx: number): boolean {
    return idx >= 1 || this.showCategories !== "true";
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = [];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    const i18nMapLocal = new Map(i18nMetaLabelsLocal.map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map((key) => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }

  private preparePixelPerUnit(): number {
    if (this.pixelPerUnitGroupMap.has(this.unitScaling as string)) {
      this.errors.remove("AUTO_unitScaling");
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string);
    }

    // Explicit 'auto' → auto-calculate silently
    if ((this.unitScaling as string)?.toString().trim().toLowerCase() === "auto") {
      this.errors.remove("AUTO_unitScaling");
      return 0;
    }

    const numeric = Number(this.unitScaling);
    if (!isNaN(numeric) && numeric > 0) {
      this.errors.remove("AUTO_unitScaling");
      return numeric;
    }

    // Not set / invalid → auto-calculate with warning
    this.errors.addOrReplace({
      id: "AUTO_unitScaling",
      type: "warning",
      message: `unit-scaling: not set, auto-calculated to fit available space.`,
    });
    return 0;
  }

  private preparePixelPerPercentage(): number {
    if (this.pixelPerUnitGroupMap.has(this.percentageScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.percentageScaling as string);
    }

    return Number(this.percentageScaling) * 100;
  }

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
    const inheritedOrder = this.resolveInherited("order", this.order);
    const inheritedDirection = this.resolveInherited("orderDirection", this.orderDirection);

    const effectiveOrder = inheritedOrder ?? this.order;
    const effectiveDirection = inheritedDirection ?? this.orderDirection;

    const isAuto = effectiveOrder?.trim().toLowerCase() === "auto";
    let orderStr: string;
    if (isBlankInput(effectiveOrder) || isAuto) {
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
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-structure"]["axisStyles"],
        barStyles: $["bn-chart-structure"]["barStyles"],
        varianceStyles: $["bn-chart-structure"]["varianceStyles"],
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
    return idx === 0 && this.showMeasureScale === "true";
  }
  prepareMeasureUnit(): string {
    if (this.measureUnit === "" || this.measureUnit == null) {
      return "";
    }
    return this.measureUnit;
  }

  chartTemplate(localScenarioString: string, idx: number) {
    const effectiveFactor = this.getEffectiveScaleFactor();
    const ppu = this.preparePixelPerUnit();
    const ppp = this.preparePixelPerPercentage();
    const stackConfig = this.prepareStackConfig();
    const scenarios = this.prepareScenarios();
    // Dimension stacking uses only the first scenario
    const effectiveScenarios = stackConfig?.by === StackBy.DIMENSIONS ? scenarios.slice(0, 1) : scenarios;

    return (
      <ibcs-chart-structure
        data={this.data}
        chartTitle={this.prepareChartTitle(idx)}
        scenarios={effectiveScenarios}
        variances={[localScenarioString]}
        hideCategories={this.prepareHideCategories(idx)}
        pixelPerUnit={ppu > 0 ? ppu * effectiveFactor : 0}
        pixelPerPercentage={ppp > 0 ? ppp * effectiveFactor : 0}
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
      ></ibcs-chart-structure>
    );
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
