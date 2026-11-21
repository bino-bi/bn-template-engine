import { Component, Element, forceUpdate, h, Host, Method, Prop, State, Watch, writeTask } from "@stencil/core";
import { hasInlineJs } from "../../context/scopedDb";
import {
  isBlankInput,
  isTableBarColumnWidth,
  isTableCategoryWidth,
  isValidDataFormat,
  isValidDateFormat,
  isValidDirection,
  isValidInteger,
  isValidMeasureScale,
  isValidMeasureType,
  isValidTableType,
  isValidThereofPosition,
  validateAttributesJsonStr,
  validateBarColumnsList,
  validateColumnThereOfJsonStr,
  validateTableOrderList,
  validatePartOfJsonStr,
  validateScenarioList,
  validateThereOfJsonStr,
  validateVariancesList,
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withScalingGroup from "../../utils/withScalingGroup";
import { globalLabelKeys } from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import { ruleSetLabels } from "../../utils/ibcsRuleSet";
import withRuleSet from "../../utils/withRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { Style } from "../../stores/componentStyles";

import withHasError, { ErrorDispatcher, reportOverflow } from "../../utils/withHasError";
import withInheritedProps, { InheritedResolver, isInheritedValue } from "../../utils/withInheritedProps";
import { getParentDimensions } from "../../utils/parentDimensions";
import { AutoScalingReport, formatScalingValue, parseScaling, resolveScalingValue } from "../../utils/scaling";
import { observeParentResize, LayoutObserverHandle } from "../../utils/layoutObserver";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import {
  BAR_COLUMN_WIDTH_EM,
  DataFormat,
  I18nMode,
  MeasureType,
  TableBarColumnWidth,
  TableCategoryWidth,
} from "../../utils/constants";
import { TableType, ThereofPosition } from "./utils/model";
import { coerceSetnameIndex, INTERVAL_NONE, INTERVAL_SETNAME } from "./utils/helper/IntervalColumns";
import { TableDrillGroup } from "./utils/model/TableDrillGroup";
import { parseTableAttributeExpression, TableAttribute } from "./utils/model/TableAttribute";
import { normalizeOrderToken, Order, OrderDirection } from "../../utils/model/Order";
import { DataFormatDigits } from "../../utils/model/DataFormatDigits";
import {
  ComponentLayoutState,
  LAYOUT_STATE_VERSION,
  LayoutStateOptions,
  ScalingInfo,
  measure,
  originsFor,
  readDiagnostics,
  readTableBaseline,
  resolveStandaloneId,
  Baseline,
} from "../../utils/layoutState";
import { TableLayoutDetail } from "./bn-table-renderer/bn-table-renderer";
import { syncEmptyState } from "../../utils/emptyState";

/**
 * Public-facing wrapper for the IBCS table component.
 *
 * Accepts user-facing string/number props, validates them, and converts
 * them into the typed internal format expected by `bn-table-renderer`. Handles
 * auto-scaling, dataset subscription (via `withDataset`), and i18n setup.
 * The actual table rendering (header, body, drill-down rows) is delegated
 * to the inner `bn-table-renderer` element.
 */
@Component({
  tag: "bn-table",
  styleUrl: "bn-table.scss",
  shadow: true,
})
export class Table {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private readonly ruleSetConfig: (layers?: "all" | "user") => RuleSetConfig;
  private readonly resolveInherited: InheritedResolver;
  private layoutObserver: LayoutObserverHandle | null = null;
  /** Last parent width seen, used to suppress ResizeObserver noise. */
  private _lastScaledParentWidth = 0;
  /** Active dataset name (the last subscribed dataset to fire `onUpdate`). */
  @State() private datasetName: string = "";
  /** Bumped on every data update so Stencil re-renders even when the name is unchanged. */
  @State() private dataVersion: number = 0;
  @State() private datasetMeta: DatasetMeta | null = null;
  @State() private appliedScaleFactor: number = 1;
  /** True when the active dataset contains rows with a blank `setname` (relevant for `interval='setname'`). */
  @State() private hasBlankSetnames: boolean = false;
  /** True when the active dataset contains rows with a `setnameIndex` but a blank `setname`. */
  @State() private hasSetnameIndexWithoutSetname: boolean = false;

  /**
   * Name of the dataset to render (the `name` of a `<bn-dataset>`). A name
   * that starts with `$` reads a `<bn-datasource>` directly, which gives a
   * warning.
   */
  @Prop({ reflect: true }) datasets?: string;

  /**
   * Namespace of the translations to use (the `namespace` of a
   * `<bn-internationalization>`). Without it the component takes the
   * `i18n-namespace` of the nearest ancestor that has one, then the built-in
   * texts.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace?: string;

  /**
   * Controls proportional scaling of the entire table relative to the
   * available parent width. All visual dimensions scale together: font size,
   * em-based spacing/padding, SVG bar-chart widths, pin lengths, dot radii,
   * pattern fills, axis strokes, and label offsets.
   *
   * Scaling is driven by a single factor applied to the base font size
   * (`global.fontSizePx` from the component-style store, default 13.3333 px).
   * Because the table's SCSS uses `em` units for padding, borders, and
   * column widths, changing the font size cascades to all layout dimensions.
   * SVG elements (bars, pins, patterns) receive the factor via the
   * `scaleFactor` prop on `bn-table-renderer` and multiply every pixel constant
   * by it, so they stay proportional to the surrounding text.
   *
   * | Value               | Behavior                                                                         |
   * |---------------------|----------------------------------------------------------------------------------|
   * | not set / `""`      | Auto-scale to fit parent width; emit `AUTO_scale` warning with the applied factor |
   * | `"none"`            | No scaling (render at base font size regardless of available space)               |
   * | `"auto"`            | Auto-scale to fit parent width silently (no warning)                             |
   * | `"0.5"`, `"1.2"`, … | Fixed factor - apply `baseFontSize × factor`                                     |
   *
   * **Auto-scale algorithm** (modes `""` and `"auto"`):
   * 1. After each render, the current `scrollWidth` of the host element is
   *    divided by the current `appliedScaleFactor` to derive the unscaled
   *    content width. This avoids resetting `--bn-font-size` to base (which
   *    would only affect em-based widths but not SVG pixel attributes).
   * 2. This unscaled width is compared against the parent's content-box
   *    width (via `getParentDimensions`).
   * 3. If the table overflows, `factor = parentWidth / unscaledWidth`
   *    is computed and applied to both the CSS variable and the
   *    `appliedScaleFactor` state (which re-renders the SVG charts).
   * 4. A guard flag (`_autoScaleGuard`) prevents the subsequent
   *    state-triggered re-render from re-measuring, avoiding an infinite
   *    measure → scale → fits → reset → overflow loop.
   *
   * Invalid values (negative numbers, non-numeric strings that are not
   * `"none"` or `"auto"`) fall back to the default behaviour (auto + warning)
   * and emit an `WARN_scale` warning.
   *
   * **Only the width is fitted.** A table that renders taller than its
   * constrained parent is clipped by the layout cell - bottom rows and the
   * grand total simply disappear - so every render reports the measured
   * overflow in `has-error`: as the error `ERR_overflow` when the size is
   * pinned by `scale` (`"none"` or a factor), as the warning `WARN_overflow`
   * in auto mode. The same item reports a width overflow, which only a fixed `scale`
   * can produce. Setting `scale="auto"` does not fix a height overflow: give
   * the component more space, reduce rows (`limit`), or set a smaller fixed
   * `scale`.
   *
   * @example
   * // Auto-scale to parent (silent)
   * <bn-table scale="auto" ...></bn-table>
   *
   * // Fixed 50 % reduction
   * <bn-table scale="0.5" ...></bn-table>
   *
   * // Double size
   * <bn-table scale="2" ...></bn-table>
   *
   * // No scaling - always render at base font size
   * <bn-table scale="none" ...></bn-table>
   */
  @Prop() scale?: string;

  @Watch("scale")
  validateScaling(newValue: string) {
    if (newValue == null || newValue === "" || newValue === "none" || newValue === "auto") {
      this.errors.remove("WARN_scale");
      return;
    }
    const num = Number(newValue);
    if (isNaN(num) || num <= 0) {
      this.errors.addOrReplace({
        id: "WARN_scale",
        type: "warning",
        message: `Invalid scale value: "${newValue}". Use "none", "auto", or a positive number.`,
      });
    } else {
      this.errors.remove("WARN_scale");
    }
  }

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    withScalingGroup(this);
    this.componentStyle = withComponentStyle(this);
    this.ruleSetConfig = withRuleSet(this);

    withDataset(
      this,
      (name, data) => {
        // Helpers query the shared alasql database directly by name; we just
        // record the active dataset and bump a version counter so Stencil
        // re-renders when the data changes.
        this.datasetName = name?.startsWith("$") ? name.substring(1) : name || "";
        this.dataVersion = this.dataVersion + 1;
        this.hasBlankSetnames =
          Array.isArray(data) && data.some((row) => isBlankInput((row?.setname ?? row?.setName) as string));
        this.hasSetnameIndexWithoutSetname =
          Array.isArray(data) &&
          data.some(
            (row) =>
              coerceSetnameIndex(row?.setnameIndex ?? row?.setNameIndex) !== undefined &&
              isBlankInput((row?.setname ?? row?.setName) as string),
          );
      },
      (_name, meta) => {
        this.datasetMeta = meta;
      },
    );

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

  /**
   * Name of a registered IBCS rule set (see `bn-ruleset`) used for scenario
   * ordering, look and names. Supports `"inherited-closest"` / `"inherited-page"` to
   * take over the value from an ancestor `bn-layout-card` / `bn-layout-page`.
   */
  @Prop({ reflect: true }) ruleset?: string;

  /**
   * Name of a registered component style (see `bn-component-style`). Forwarded
   * to the inner `bn-table-renderer` so bar-chart colors and fonts follow the selected
   * style as well.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * Label of the grand-total row at the bottom of the table. Only rendered for
   * `type="sum"` and `type="opt"`; the other table types have no total row.
   * When empty, the IBCS total symbol (❖) is used.
   */
  @Prop() sumTitle: string = "";

  /**
   * AlaSQL WHERE clause fragment injected into the data query to filter
   * rows before rendering (e.g. `"category = 'Sales'"`).
   */
  @Prop()
  filter: string = "";

  @Watch("filter")
  validateFilter(newValue: string) {
    const errId = "ERR_filter";
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
   * measureUnit displayed in table.
   */
  @Prop() measureUnit: string = "";

  /** List of scenarios displayed in card header.
   *  <br /><br />
   *  If scenarios is empty string (`''` or `null`) the scenarios are omitted
   *  <br /><br />
   *  values:<br /> ```ac // fc // py // pl // null // auto```
   *  <br /><br />
   *  When set to ```auto```, scenarios are detected from the dataset silently.
   *  When left blank (and variances are also blank), scenarios are detected from the dataset with a warning.
   */
  @Prop() readonly scenarios: string;

  @Watch("scenarios")
  validateScenario(newValue: string) {
    const errId = "WARN_scenarios";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errId);
      return;
    }

    const invalidScenarios: string[] = validateScenarioList(newValue);

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "scenarios: invalid value(s) '" + invalidScenarios?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** <br /> <br />
   List of Variances
   The additonal variances which
   are calculated form the given scenarios.
   the scenarios used in the variances have also
   be defined in the *scenarios* property.
   <br /> <br />
   the variance is defiend as  (Scenario A -  ScenarioB)
   neu. neg and pos post fix defines which value is *good*
   a negative or a positive value.
   op follows the row operation: in an opt/optnototal table a "-" row
   acts like neg, "+" and sum rows act like pos (a rising cost is red).
   opinv is the inverse of op. In other table types op acts like pos.
   <br /> <br />
   if empty variance charts are hidden
   <br /> <br />
   each variance creates a chart
   <br /> <br />
   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu/op/opinv]```
   */
  @Prop() readonly variances: string;

  @Watch("variances")
  validateVariances(newValue: string) {
    const errId = "WARN_variances";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "variances: invalid value(s) '" + JSON.stringify(invalidVariances) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * List of column names to render as bar charts instead of numbers.
   * <br /><br />
   * Absolute variances (d_*) render as horizontal bar charts.
   * Relative variances (dr_*) render as pin charts with a square head.
   * Bars take the pattern of the minuend (FC hatched, PL outlined) in the colour
   * of the sentiment; pin heads take the look of the minuend scenario (AC solid
   * dark, PY solid grey, FC hatched, PL outlined); the axis takes the look of the
   * reference scenario.
   * Scenario columns (ac1..pl4) render as horizontal bar charts; when the table
   * contains grouping structure (sum rows, thereof, or partof) they automatically
   * render as an IBCS waterfall - data rows cascade from the running total and
   * sum rows anchor at zero. Waterfall columns auto-scale to fit the bar column
   * width (unit-scaling does not apply) and are not supported in combination
   * with `interval` or `columnthereof`.
   * <br /><br />
   * example:<br />
   * ```dac1_pp1_pos,drac1_pp1_pos,ac1```
   */
  @Prop() readonly barColumns: string;

  @Watch("barColumns")
  validateBarColumns(newValue: string) {
    const errId = "WARN_barColumns";
    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidColumns: string[] = validateBarColumnsList(newValue);
    if (invalidColumns.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "barColumns: invalid value(s) '" + JSON.stringify(invalidColumns) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   *  Set the total width of bar chart columns, in em of the table font - the same
   *  unit and vocabulary as ```categoryWidth```, so ```bar-column-width="w15"```
   *  renders exactly as wide as ```category-width="w15"```. The bar/pin drawing
   *  area is that width minus the value-label gutters.
   *  <br /><br />
   *  values:<br />
   *  ``` w5 // w10 // w15 // w20 // w25 // w30 // w40 // w60 // w80 // w100 ```
   */
  @Prop() barColumnWidth: string = "w10";

  @Watch("barColumnWidth")
  validateBarColumnWidth(newValue: string) {
    const errId = "WARN_barColumnWidth";

    if (!isTableBarColumnWidth(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "barColumnWidth: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Data units displayed per 1 em of bar length for absolute variance bar
   * charts (ΔPY) - map-scale semantics: a larger value means smaller bars.
   * Bars exceeding barColumnWidth are cut with a zigzag break.
   *
   * | Value            | Behavior                                                       |
   * |------------------|----------------------------------------------------------------|
   * | `"auto"`         | Auto-fit the largest bar to the bar column width               |
   * | `"250000"`, `"1M"` | Units per em; optional SI suffix `k`/`K`/`M`/`G`/`T`         |
   * | group name       | References a `<bn-scaling-group>` for synchronized scaling     |
   * | invalid / unknown | Auto-fit + `AUTO_unitScaling` warning                         |
   *
   * Default: `"100"` (1 em of bar represents 100 units)
   *
   * @example unit-scaling="1M"
   * @example unit-scaling="revenue-scale"
   */
  @Prop() unitScaling: string | number = "100";

  @Watch("unitScaling")
  validateUnitScaling(newValue: string | number) {
    const errId = "WARN_unitScaling";

    if (resolveScalingValue(newValue, this.pixelPerUnitGroupMap).kind === "invalid") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "unitScaling: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Percentage points displayed per 1 em of pin length for relative variance
   * pin charts (ΔPY%) - a larger value means shorter pins.
   *
   * | Value            | Behavior                                                       |
   * |------------------|----------------------------------------------------------------|
   * | `"auto"`         | Auto-fit the largest pin to the pin area                       |
   * | `"10"`, `"2.5"`  | Percentage points per em; optional SI suffix `k`/`K`/`M`/`G`/`T` |
   * | group name       | References a `<bn-scaling-group>` for synchronized scaling     |
   * | invalid / unknown | Auto-fit + `AUTO_percentageScaling` warning                   |
   *
   * Default: `"2"` (a +2 % variance pin is 1 em long)
   *
   * @example percentage-scaling="10"
   * @example percentage-scaling="pct-scale"
   */
  @Prop() percentageScaling: string | number = "2";

  @Watch("percentageScaling")
  validatePercentageScaling(newValue: string | number) {
    const errId = "WARN_percentageScaling";

    if (resolveScalingValue(newValue, this.pixelPerUnitGroupMap).kind === "invalid") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "percentageScaling: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  // Global scaling groups map - can be populated externally for shared scaling across components
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

  /**
   *  Defines the data unit type of the tables data.
   *  <br /><br />
   *  If percent is chosen all data values are converted into percent
   *  (0.02 ->  2%)
   *  <br /><br />
   *  values: <br />
   *  ```percent  // decimal```
   */
  @Prop() dataFormat: string = "decimal";

  @Watch("dataFormat")
  validateDataFormat(newValue: string) {
    const errId = "WARN_dataFormat";

    if (!isValidDataFormat(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dataFormat: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   *  Toggles of data should be grouped by
   *  'rowgroup'.
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() grouped: boolean = false;

  /**
   *  Toggles display of measure units in table header
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() showMeasureScale: boolean = false;

  /**
   *  Toggles a title header for each (row-)group
   *  the title header value is found set by 'rowgroup'
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   *
   */
  @Prop() showGroupTitle: boolean = true;

  /**
   *  Turns the sum row of each (row-)group into a running result: the sum of all
   *  rows from the first group down to its own group, with the matching absolute
   *  and relative variances. Use it for a calculation scheme such as an income
   *  statement, where each `rowGroup` ends in a result.
   *  <br /><br />
   *  Needs `grouped` and a type with group sums (```sum // opt // sumnototal // optnototal```).
   *  The total row of ```sum``` and ```opt``` stays and repeats the last running
   *  result, so ```sumnototal``` or ```optnototal``` is the usual choice.
   *  `partof` shares still refer to the sum of their own group.
   *  Not supported together with `columnthereof`: there it has no effect.
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() runningSum: boolean = false;

  /**
   *  Draws every absolute variance column (d_*) listed in ```barColumns``` as a
   *  variance waterfall down the rows instead of single bars from the axis.
   *  A row starts where the row above ended; on ```opt``` and ```optnototal```
   *  tables a "-" row with a positive variance moves to the left. Sum rows are
   *  bars from the axis. Thin lines join the bars. Each row group starts at the
   *  axis again, with ```runningSum``` the walk goes on from the sum row.
   *  The column scales to fit the whole walk (unit-scaling does not apply).
   *  Relative variance columns (dr_*) stay pins.
   *  Has no effect together with ```interval``` or ```columnthereof```.
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() varianceWaterfall: boolean = false;

  /**
   *  Set the table type
   *  <br /><br />
   *  values: <br />
   *  ```list // sum // opt // sumnototal // optnototal```
   *
   */
  @Prop() type: string = "list";

  @Watch("type")
  validateType(newValue: string | boolean) {
    const errId = "WARN_type";

    if (!isValidTableType(newValue as string)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "type: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Set the maximum number of rows for each
   * group. The value 0 means *no limit*
   * <br /><br />
   * rows wich where cut by the limit are cumulated as REST
   *
   */
  @Prop() limit: number = 0;

  @Watch("limit")
  validateLimit(newValue: number) {
    const errId = "WARN_limit";

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "order: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * JSON array of drilldown objects with the keys `rowGroup`, `category` and
   * `subCategory` (all strings, all required).
   * <br /><br />
   * `rowGroup` and `category` name the row the drilldown belongs to,
   * `subCategory` is the label of the data row that is shown below it.
   * <br /><br />
   * example:<br />
   * ```[{"rowGroup": "Umsatz", "category": "Applications", "subCategory": "Applications-A"}]```
   */
  @Prop() thereof: string = "[]";

  @Watch("thereof")
  validateThereOf(newValue: string) {
    const errId = "WARN_thereof";
    const invalidElements: string[] = validateThereOfJsonStr(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "ThereOf: invalid value(s) '" + JSON.stringify(invalidElements) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Position of the `thereof` rows relative to their parent row.
   * <br /><br />
   * ```below``` (default) prints them below the parent, small and italic, with
   * the thereof label. ```above``` prints them before the parent in normal
   * size with an indented label, and the parent row looks like a subtotal
   * (bold, with a line above it). The parent keeps its operation sign and its
   * value, so a parent of `-` rows reads like "- Operating expenses".
   * With ```above``` list all subcategories of the parent (`"subCategory": ""`):
   * with only some of them the parent looks like a subtotal that does not add up.
   * <br /><br />
   * values: <br />
   * ```below // above```
   */
  @Prop() thereofPosition: string = "below";

  @Watch("thereofPosition")
  validateThereofPosition(newValue: string) {
    const errId = "WARN_thereofPosition";

    if (isBlankInput(newValue) || isValidThereofPosition(newValue)) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "thereofPosition: invalid value '" + newValue + "' is not supported.",
      });
    }
  }

  /**
   * JSON array of part-of objects with the keys `rowGroup` and `category`
   * (both strings, both required).
   * <br /><br />
   * Each object names a category. The table shows its share of the row group
   * in percent.
   * <br /><br />
   * example:<br />
   * ```[{"rowGroup": "Umsatz", "category": "Applications"}]```
   */
  @Prop() partof: string = "[]";

  @Watch("partof")
  validatePartOf(newValue: string) {
    const errId = "WARN_partof";
    const invalidElements: string[] = validatePartOfJsonStr(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "partof: invalid value(s) '" + JSON.stringify(invalidElements) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** Comma list of the columns the rows are sorted by, left to right. `orderDirection` applies to all of them.
   *  <br /><br />
   *  values: <br />
   *  ```category // categoryindex // rowgroup // rowgroupindex // subcategory // subcategoryindex // ac[1-4] // fc[1-4] // pp[1-4] // pl[1-4] // auto```
   *  <br />
   *  or a variance, written like a scenario column, the sentiment is optional and ignored: ```dac1_pp1```, ```drfc1_pp1_pos```
   *  <br /><br />
   *  With `interval="setname"` a scenario or variance can name one bucket after `@`: ```dac1_pp1@_November``` sorts
   *  by that block only. Without a bucket the sum over all buckets is used.
   *  <br /><br />
   *  The scenario or variance does not have to be a shown column; the sort arrow appears only on a shown one.
   *  A plain scenario also sorts the row groups by their sum. A variance or a token with `@` sorts only the rows
   *  inside each group, the groups keep their rowgroupindex order. With a variance or `@`, rows without data
   *  (and a relative variance with a zero reference) sort last.
   *  <br /><br />
   *  A data row with the category `REST` is the rest row of its group: sorted by a scenario or variance it stays
   *  the last row of the group. Its label comes from the `REST` translation.
   *  <br /><br />
   *  When set to ```auto```, order is detected from the dataset silently.
   */
  @Prop() order: string = "category";

  @Watch("order")
  validateOrderList(newValue: string) {
    const errId = "WARN_order";
    if (isInheritedValue(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidElements: string[] = validateTableOrderList(newValue);

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

  /** Set sorting order direction
   *  <br /><br />
   *  values: <br />
   * ```asc  // desc```
   */
  @Prop() orderDirection: string = "asc";

  @Watch("orderDirection")
  validateOrderDirection(newValue: string) {
    const errId = "WARN_orderDirection";
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

  /** Sets the Measure Type of the Table
   *  volume is different displayed and interpreted as currency
   *  names of siprefix are adapted.
   *  <br /><br />
   *  values: <br />
   *  ```volume // currency```

   */
  @Prop() measureType: string = "volume";

  @Watch("measureType")
  validateMeasureType(newValue: string) {
    const errId = "WARN_measureType";

    if (!isValidMeasureType(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "measureType: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   *  Sets the SiPrefix of the Mesaurements and converts the
   *  original value.
   *  <br /><br />
   *  values:  <br />
   *  ```_ // k // M // G // T // P // E // Z // Y // m // my (μ) // n // p // f // a // z // y // GREATEST // LEAST```
   *  <br /><br />
   *  SiPrefix overview:
   *  ```     "Y":  1E+24,```<br />
   *  ```    "Z":  1E+21,```<br />
   *  ```   "E":  1E+18,```<br />
   *  ```     "P":  1E+15,```<br />
   *  ```     "T":  1E+12,```<br />
   *  ```     "G":  1000000000,```<br />
   *  ```     "M":  1000000,```<br />
   *  ```     "k":  1000,```<br />
   *  <br />
   *  ```     "m":  0.001,```<br />
   *  ```    "my" (μ):  0.000001,```<br />
   *  ```     "n":  0.000000001,```<br />
   *  ```     "p":  0.000000000001,```<br />
   *  ```     "f":  0.000000000000001,```<br />
   *  ```     "a":  0.000000000000000001,```<br />
   *  ```     "z":  0.000000000000000000001,```<br />
   *  ```     "y":  0.000000000000000000000001,```<br />
   *  <br /><br />
   * Special modes:
   * ```GREATEST``` seaches for the bigest (farest to zero) Value in the dataset and sets this value to SiPrefix<br />
   * ```LEAST```    searches for smallest (closest to zero) Value in the dataset and sets this value to SiPrefix<br />
   *<br /><br />
   * ```_```        is the value for no SiPrefix the value is displayed as in the dataset stored.
   *
   *
   */
  @Prop() measureScale: string = "greatest";

  @Watch("measureScale")
  validateMeasureScale(newValue: string) {
    const errId = "WARN_measureScale";

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
   * Number of decimal digits in a table cell
   */
  @Prop() dataFormatDigitsDecimal: number = 1;

  @Watch("dataFormatDigitsDecimal")
  validateDataFormatDigitsDecimal(newValue: number) {
    const errId = "WARN_dataFormatDigitsDecimal";

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dataFormatDigitsDecimal: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Number of percent digits in a table cell
   */
  @Prop() dataFormatDigitsPercent: number = 2;

  @Watch("dataFormatDigitsPercent")
  validateDateFormatDigitsPercent(newValue: number) {
    const errId = "WARN_dataFormatDigitsPercent";

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dataFormatDigitsPercent: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   *  Set width of category column, in em of the table font. <br />
   *  If INF is selected the columns scaling to the min space they need
   *  seperatly.
   *  <br /><br />
   *  The column is fixed at this width; a category label too long to fit is
   *  truncated with an ellipsis.
   *  <br /><br />
   *  values:<br />
   *  ``` w5 // w10 // w15 // w20 // w25 // w50 // inf ```
   */
  @Prop() categoryWidth: string = "w15";

  @Watch("categoryWidth")
  validateCategoryWidth(newValue: string) {
    const errId = "WARN_categoryWidth";

    if (!isTableCategoryWidth(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "categoryWidth: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * JSON array that defines which drill columns are shown. Each object has
   * the keys `scenario`, `name` and `subGroups` (all required).
   * <br /><br />
   * ```scenario``` the scenario to drill <br/>
   * ```name``` the label of the parent column <br/>
   * ```subGroups``` the list of child columns of the parent <br/><br/>
   * example:<br />
   * ```[{"scenario": "ac1", "name": "DE", "subGroups": ["Berlin"]}, {"scenario": "ac2", "name": "UK", "subGroups": []}]```
   */
  @Prop() columnthereof: string | null = null;

  @Watch("columnthereof")
  validateColumnThereOf(newValue: string | null) {
    const invalidElements: string[] = validateColumnThereOfJsonStr(newValue);
    const errId = "WARN_columnthereof";
    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "columnthereof: invalid value(s) '" + JSON.stringify(invalidElements) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Repeats the entire scenario/variance column block once per interval group,
   * rendered under a spanning header band (e.g. `2023 | 2024 | 2025`, each with
   * the configured columns).
   * <br /><br />
   * values:<br /> ```none // setname // year // quarter // month // week // day // hour // minute // second // millisecond // auto```
   * <br /><br />
   * ```none``` (default) deactivates the feature. ```setname``` groups by the
   * dataset's `setname` column (non-date comparison); rows with a blank setname
   * raise a warning and are grouped under `-`. Date values bucket rows by the
   * `date` column; ```auto``` detects the granularity from the date span.
   * Cannot be combined with `columnthereof`.
   * <br /><br />
   * Date groups are shown in chronological order. Setname groups are shown in
   * order of first appearance in the dataset. When the rows carry the optional
   * numeric column `setnameIndex`, the setname groups are sorted ascending by
   * it: the smallest index of a setname counts, groups without an index come
   * last.
   */
  @Prop() interval: string = "none";

  @Watch("interval")
  validateInterval(newValue: string) {
    const errId = "WARN_interval";
    const value = newValue?.trim().toLowerCase();

    if (isBlankInput(newValue) || value === INTERVAL_NONE || value === INTERVAL_SETNAME || isValidDateFormat(value)) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "interval: invalid value '" + newValue + "' is not supported.",
      });
    }
  }

  /**
   * Number of interval groups that stand left of the category column. Needs
   * an active `interval`.
   * <br /><br />
   * ```0``` (default) keeps the category column first. ```1``` puts one
   * interval group left of it and the rest right. The number of interval
   * groups puts the category column last. A greater value raises a warning
   * and is used as the number of groups.
   * <br /><br />
   * The operation column and the `attributes` columns move with the category
   * column.
   */
  @Prop() categoryIntervalPosition: number = 0;

  @Watch("categoryIntervalPosition")
  validateCategoryIntervalPosition(newValue: number) {
    const errId = "WARN_categoryIntervalPosition";

    if (isBlankInput(newValue) || (isValidInteger(newValue) && Number(newValue) >= 0)) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "categoryIntervalPosition: invalid value '" + newValue + "' is not supported.",
      });
    }
  }

  /**
   * Stringified JSON object defining custom columns computed from dataset fields.<br />
   * Keys are column labels, values are aggregate expressions over the rows that
   * make up each table row.<br /><br />
   * Functions: ```set // first // last // min // max // avg // sum // lit```<br />
   * Fields can be standard dataset fields (e.g. ```ac1```) or custom fields
   * prefixed with ```_``` (e.g. ```_leiter```); ```lit``` takes a constant value.<br /><br />
   * example:<br />
   * ```{"Verkaufsleiter": "set(_leiter)", "Umsatz gesamt": "sum(ac1)"}```
   */
  @Prop({ attribute: "attributes" }) tableAttributes: string = "";

  @Watch("tableAttributes")
  validateTableAttributes(newValue: string) {
    const errId = "WARN_attributes";
    const invalidElements: string[] = validateAttributesJsonStr(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "attributes: invalid value(s) '" + JSON.stringify(invalidElements) + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  componentWillLoad() {
    this.validateFilter(this.filter);
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateDataFormat(this.dataFormat);
    this.validateType(this.type);
    this.validateLimit(this.limit);
    this.validateThereOf(this.thereof);
    this.validateThereofPosition(this.thereofPosition);
    this.validatePartOf(this.partof);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateDataFormatDigitsDecimal(this.dataFormatDigitsDecimal);
    this.validateDateFormatDigitsPercent(this.dataFormatDigitsPercent);
    this.validateCategoryWidth(this.categoryWidth);
    this.validateMeasureType(this.measureType);
    this.validateMeasureScale(this.measureScale);
    this.validateColumnThereOf(this.columnthereof);
    this.validateInterval(this.interval);
    this.validateCategoryIntervalPosition(this.categoryIntervalPosition);
    this.validateTableAttributes(this.tableAttributes);
    this.validateBarColumns(this.barColumns);
    this.validateBarColumnWidth(this.barColumnWidth);
    this.validateUnitScaling(this.unitScaling);
    this.validatePercentageScaling(this.percentageScaling);
    this.validateScaling(this.scale);
  }

  componentDidLoad() {
    // Observe the parent container for size changes so auto-scaling
    // reacts to genuine container resizes (window resize, card relayout).
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { width } = getParentDimensions(this.element);
      // Only react to WIDTH changes - table scales by width.
      // Height changes (e.g. from page-fit-to-content auto grid rows)
      // are irrelevant and would cause an infinite render loop.
      if (width > 0 && Math.abs(width - this._lastScaledParentWidth) > 2) {
        this._lastScaledParentWidth = width;
        forceUpdate(this);
      }
    });
  }

  disconnectedCallback() {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
  }

  private _autoScaleGuard = false;

  componentDidRender() {
    syncEmptyState(this.element, "bn-table-renderer");

    const { mode } = parseScaling(this.scale);

    // Only auto-scale for 'auto' and 'empty' (blank) modes
    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      this.checkOverflow();
      return;
    }

    // Skip re-measurement after the state-triggered re-render
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

    this._lastScaledParentWidth = parentWidth;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const currentWidth = host.scrollWidth;
    const currentFactor = this.appliedScaleFactor;

    // Content fits at current factor - done. Don't estimate unscaled width
    // and reset to factor 1; that estimate is approximate due to pixel
    // rounding and causes oscillation (reset → overflow → scale → reset).
    if (currentWidth <= parentWidth + 1) {
      this.errors.remove("AUTO_scale");
      this.checkOverflow();
      return;
    }

    // Content overflows. Compute a new factor based on the ratio of
    // parent to current content width, scaled by the current factor.
    // Floor at 0.3 to prevent illegible micro-rendering in very small containers.
    const computedFactor = Math.max(0.3, (currentFactor * (parentWidth - 1)) / currentWidth);

    // Only apply if the change is significant (> 0.1% of current factor).
    if (Math.abs(computedFactor - currentFactor) < 0.001) {
      this.checkOverflow();
      return;
    }

    // Apply immediately via CSS var for smooth visual (before state re-render)
    host.style.setProperty("--bn-font-size", `${baseFontSize * computedFactor}px`);

    if (mode === "empty") {
      this.errors.addOrReplace({
        id: "AUTO_scale",
        type: "warning",
        message: `Auto-scaled table by factor ${computedFactor.toFixed(3)}`,
      });
    } else {
      this.errors.remove("AUTO_scale");
    }

    // Defer state update to avoid Stencil "changed during rendering" warning.
    // The CSS var is already applied, so the visual update is immediate;
    // the deferred state change triggers a re-render for SVG bar charts.
    this._autoScaleGuard = true;
    writeTask(() => {
      this.appliedScaleFactor = computedFactor;
    });

    // Check with the current (pre-factor) content so overflow is reported
    // even if the scheduled re-render stalls; the follow-up render re-checks
    // in the guard branch and clears any transiently reported overflow.
    this.checkOverflow();
  }

  /**
   * Reports an overflow item when the rendered table exceeds its
   * container. The table only auto-fits its WIDTH, so nothing prevents it
   * from growing taller than the layout cell, which clips the bottom rows
   * (grand total included) without a trace - this item is the only signal.
   * Overflow under a fixed `scale` is an error: the author pinned the size.
   * In auto mode it is a warning.
   */
  private checkOverflow(): void {
    const parent = getParentDimensions(this.element);
    const contentWidth = this.element.scrollWidth;
    const contentHeight = this.element.scrollHeight;
    const widthOver = parent.width > 0 && contentWidth > parent.width + 1;
    const heightOver = parent.height > 0 && contentHeight > parent.height + 1;

    if (!widthOver && !heightOver) {
      reportOverflow(this.errors, null);
      return;
    }

    const { mode } = parseScaling(this.scale);
    const fixedScale = mode !== "auto" && mode !== "empty";

    const dims: string[] = [];
    if (widthOver) dims.push(`width (${Math.round(contentWidth)}px > ${Math.round(parent.width)}px)`);
    if (heightOver) dims.push(`height (${Math.round(contentHeight)}px > ${Math.round(parent.height)}px)`);

    reportOverflow(
      this.errors,
      `Table exceeds available ${dims.join(" and ")}. ` +
        "Give the component more space, reduce rows (e.g. limit), or set a smaller scale.",
      fixedScale,
    );
  }

  private prepareDataFormat(): DataFormat {
    return DataFormat[this.dataFormat?.toUpperCase() as keyof typeof DataFormat];
  }

  private prepareGrouped(): boolean {
    return this.grouped;
  }

  private prepareShowGroupTitle(): boolean {
    return this.showGroupTitle;
  }

  private prepareThereofPosition(): ThereofPosition {
    return this.thereofPosition?.toLowerCase() === ThereofPosition.ABOVE
      ? ThereofPosition.ABOVE
      : ThereofPosition.BELOW;
  }

  private prepareTableType(): TableType {
    return TableType[this.type?.toUpperCase() as keyof typeof TableType];
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareThereOf(): TableDrillGroup[] {
    if (this.thereof == null || this.thereof.trim() === "") {
      return [];
    }

    try {
      return JSON.parse(this.thereof!) as TableDrillGroup[];
    } catch (_e) {
      // invalid JSON already reported by validateThereOf
      return [];
    }
  }

  private preparePartOf(): TableDrillGroup[] {
    if (this.partof == null || this.partof.trim() === "") {
      return [];
    }
    try {
      return JSON.parse(this.partof!) as TableDrillGroup[];
    } catch (_e) {
      // invalid JSON already reported by validatePartOf
      return [];
    }
  }

  private prepareOrder(): Order {
    // An unresolved keyword falls back to the prop defaults.
    const effectiveOrder = this.resolveInherited("order", this.order, "category").value;
    const effectiveDirection = this.resolveInherited("orderDirection", this.orderDirection, "asc").value;

    const isAuto = effectiveOrder?.trim().toLowerCase() === "auto";
    let orderStr = effectiveOrder;
    if (isAuto && this.datasetMeta?.suggestedOrder) {
      orderStr = this.datasetMeta.suggestedOrder;
    }

    const tableOrder: Order = {
      hierarchy: orderStr.split(",").map((entry) => normalizeOrderToken(entry)),
      direction: OrderDirection[effectiveDirection?.toUpperCase() as keyof typeof OrderDirection],
    };

    return tableOrder;
  }

  private prepareI18nMode(): I18nMode {
    return I18nMode.META;
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["in", "category", "operation", "thereof", "part_of", "SUM_TOTAL", "no-data", "REST"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    // system
    const i18nMapLocal = new Map(i18nMetaLabelsLocal.map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map((key) => [key, this.t("global.".concat(key))]));

    // a name from a <bn-ruleset> wins over the i18n label of the scenario
    return new Map([
      ...i18nMapGlobal.entries(),
      ...i18nMapLocal.entries(),
      ...ruleSetLabels(this.ruleSetConfig("user")),
    ]);
  }

  private prepareDataFormatDigits(): DataFormatDigits {
    const formatDigits: DataFormatDigits = {
      percent: this.dataFormatDigitsPercent,
      decimal: this.dataFormatDigitsDecimal,
    };

    return formatDigits;
  }

  private prepareScenarios(): string[] {
    const scenariosProp = this.resolveInherited("scenarios", this.scenarios);
    const variancesProp = this.resolveInherited("variances", this.variances);

    if (scenariosProp.inherited || variancesProp.inherited) {
      this.errors.remove("AUTO_scenarios");
      let scenarios: string[] = [];
      if (!isBlankInput(scenariosProp.value)) {
        scenarios = scenarios.concat(scenariosProp.value.split(","));
      } else if (scenariosProp.unresolved) {
        // Inherited variances do not take the fallback away from an unresolved scenarios keyword.
        scenarios = scenarios.concat(this.datasetMeta?.availableScenarios ?? []);
      }
      if (variancesProp.value?.trim().length > 0) {
        scenarios = scenarios.concat(variancesProp.value.split(","));
      }
      return scenarios.map((entry) => entry.trim());
    }

    // An unresolved keyword has its own warning, so it gets no AUTO_scenarios on top.
    const isAuto = scenariosProp.value?.trim().toLowerCase() === "auto";
    const isSilent = isAuto || scenariosProp.unresolved;
    if ((isBlankInput(scenariosProp.value) || isAuto) && isBlankInput(variancesProp.value)) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        if (!isSilent) {
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

    let scenarios = [];

    if (isAuto || isBlankInput(scenariosProp.value)) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        if (!isSilent) {
          this.errors.addOrReplace({
            id: "AUTO_scenarios",
            type: "warning",
            message: `scenarios: not set, auto-detected: ${this.datasetMeta.availableScenarios.join(",")}`,
          });
        } else {
          this.errors.remove("AUTO_scenarios");
        }
        scenarios = scenarios.concat(this.datasetMeta.availableScenarios);
      }
    } else {
      this.errors.remove("AUTO_scenarios");
      scenarios = scenarios.concat(scenariosProp.value?.split(","));
    }

    if (variancesProp.value?.trim().length > 0) {
      scenarios = scenarios.concat(variancesProp.value?.split(","));
    }
    return scenarios.map((entry) => entry.trim());
  }

  private prepareCategoryWidth(): TableCategoryWidth {
    if (isBlankInput(this.categoryWidth)) {
      return TableCategoryWidth.INF;
    }
    return TableCategoryWidth[this.categoryWidth?.toUpperCase() as keyof typeof TableCategoryWidth];
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

  private prepareMeasureType(): MeasureType {
    if (isBlankInput(this.measureType)) {
      return MeasureType.VOLUME;
    }
    return MeasureType[this.measureType?.toUpperCase() as keyof typeof MeasureType];
  }

  private prepareColumnThereOf(): Map<string, Record<string, unknown>[]> {
    if (this.columnthereof == null || this.columnthereof.trim() === "") {
      return new Map();
    }
    const map = new Map();
    try {
      const parsedString = JSON.parse(this.columnthereof);

      for (const [_key, value] of Object.entries(parsedString)) {
        if (map.has(value["scenario"]) === false) {
          map.set(value["scenario"], []);
        }
        map.get(value["scenario"]).push(value);
      }
    } catch (_e) {
      // invalid JSON already reported by validateColumnThereOf
      return new Map();
    }

    return map;
  }

  private prepareInterval(): string {
    const conflictErrId = "WARN_intervalConflict";
    const noDateErrId = "WARN_intervalNoDate";
    const setnameErrId = "WARN_intervalSetname";
    const setnameIndexErrId = "WARN_intervalSetnameIndex";

    const interval = isBlankInput(this.interval) ? INTERVAL_NONE : this.interval.trim().toLowerCase();
    const isValid = interval === INTERVAL_NONE || interval === INTERVAL_SETNAME || isValidDateFormat(interval);

    // invalid values are already reported by validateInterval
    if (!isValid || interval === INTERVAL_NONE) {
      this.errors.remove(conflictErrId);
      this.errors.remove(noDateErrId);
      this.errors.remove(setnameErrId);
      this.errors.remove(setnameIndexErrId);
      return INTERVAL_NONE;
    }

    if (this.columnthereof != null && this.columnthereof.trim() !== "") {
      this.errors.addOrReplace({
        id: conflictErrId,
        type: "warning",
        message: "interval: cannot be combined with columnthereof, interval is ignored.",
      });
      this.errors.remove(noDateErrId);
      this.errors.remove(setnameErrId);
      this.errors.remove(setnameIndexErrId);
      return INTERVAL_NONE;
    }
    this.errors.remove(conflictErrId);

    if (interval === INTERVAL_SETNAME) {
      if (this.hasBlankSetnames) {
        this.errors.addOrReplace({
          id: setnameErrId,
          type: "warning",
          message: "interval: rows with blank setname found, they are grouped under '-'.",
        });
      } else {
        this.errors.remove(setnameErrId);
      }
      if (this.hasSetnameIndexWithoutSetname) {
        this.errors.addOrReplace({
          id: setnameIndexErrId,
          type: "warning",
          message: "interval: rows with setnameIndex but blank setname found, setnameIndex needs setname.",
        });
      } else {
        this.errors.remove(setnameIndexErrId);
      }
      this.errors.remove(noDateErrId);
      return INTERVAL_SETNAME;
    }
    this.errors.remove(setnameErrId);
    this.errors.remove(setnameIndexErrId);

    if (this.datasetMeta && !this.datasetMeta.dateRange?.hasData) {
      this.errors.addOrReplace({
        id: noDateErrId,
        type: "warning",
        message: "interval: dataset has no date values, interval is ignored.",
      });
      return INTERVAL_NONE;
    }
    this.errors.remove(noDateErrId);

    return interval;
  }

  private prepareCategoryIntervalPosition(): number {
    const position = Number(this.categoryIntervalPosition);
    return Number.isInteger(position) && position > 0 ? position : 0;
  }

  private prepareAttributes(): TableAttribute[] {
    if (this.tableAttributes == null || this.tableAttributes.trim() === "") {
      return [];
    }

    try {
      const parsedString = JSON.parse(this.tableAttributes);
      if (parsedString === null || typeof parsedString !== "object" || parsedString instanceof Array) {
        return [];
      }
      return Object.entries(parsedString)
        .map(([label, expression], index) =>
          typeof expression === "string" ? parseTableAttributeExpression(label, `attr_${index}`, expression) : null,
        )
        .filter((attribute): attribute is TableAttribute => attribute !== null);
    } catch (_e) {
      // invalid JSON already reported by validateTableAttributes
      return [];
    }
  }

  private prepareSumTitle(): string {
    if (this.sumTitle === "" || this.sumTitle == null) {
      return "SUM_TOTAL";
    }
    return this.sumTitle;
  }

  prepareShowMeasureScale(): boolean {
    return this.showMeasureScale;
  }
  prepareMeasureUnit(): string {
    if (this.measureUnit === "" || this.measureUnit == null) {
      return "";
    }
    return this.measureUnit;
  }

  private prepareFilter(): string {
    if (this.filter.length === 0) {
      return "";
    }

    return this.filter;
  }

  private prepareBarColumnWidth(): number {
    const key = this.barColumnWidth?.toUpperCase() as keyof typeof TableBarColumnWidth;
    const preset = TableBarColumnWidth[key];
    if (preset) {
      return BAR_COLUMN_WIDTH_EM[preset];
    }
    return BAR_COLUMN_WIDTH_EM[TableBarColumnWidth.W10];
  }

  private prepareBarColumns(): string[] {
    if (isBlankInput(this.barColumns)) {
      return [];
    }
    return this.barColumns.split(",").map((col) => col.trim());
  }

  private autoUnitWarningActive = false;
  private autoPctWarningActive = false;
  private lastReportedUnitsPerEm?: number;
  private lastReportedPpPerEm?: number;
  /** Last auto-fit report from the inner table (em/unit, em/pp), kept for getLayoutState(). */
  private lastAutoScalingReport?: AutoScalingReport;

  private prepareUnitScaling(): number {
    const resolved = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap);
    if (resolved.kind === "value") {
      this.errors.remove("AUTO_unitScaling");
      this.autoUnitWarningActive = false;
      this.lastReportedUnitsPerEm = undefined;
      // Inner bn-table-renderer expects em per unit; the attribute is units per em.
      return 1 / resolved.value;
    }
    if (resolved.kind === "auto") {
      this.errors.remove("AUTO_unitScaling");
      this.autoUnitWarningActive = false;
      this.lastReportedUnitsPerEm = undefined;
      return 0;
    }
    this.autoUnitWarningActive = true;
    this.errors.addOrReplace({
      id: "AUTO_unitScaling",
      type: "warning",
      message: `unit-scaling: invalid value "${resolved.raw}" - auto-fitting to the bar column width.`,
    });
    return 0;
  }

  private preparePercentageScaling(): number {
    const resolved = resolveScalingValue(this.percentageScaling, this.pixelPerUnitGroupMap);
    if (resolved.kind === "value") {
      this.errors.remove("AUTO_percentageScaling");
      this.autoPctWarningActive = false;
      this.lastReportedPpPerEm = undefined;
      // Inner bn-table-renderer expects em per percentage point.
      return 1 / resolved.value;
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
      message: `percentage-scaling: invalid value "${resolved.raw}" - auto-fitting to the pin area.`,
    });
    return 0;
  }

  /**
   * Receives the auto-fitted scaling values from the inner bn-table-renderer
   * (em per unit / em per percentage point) and surfaces them in the AUTO_*
   * warnings, converted back to the attribute's units-per-em form so users
   * can copy them into a bn-scaling-group.
   */
  private handleAutoScalingReport = (report: AutoScalingReport): void => {
    // A report only carries the auto-resolved quantities - keep the other one.
    this.lastAutoScalingReport = {
      unit: report.unit ?? this.lastAutoScalingReport?.unit,
      percentage: report.percentage ?? this.lastAutoScalingReport?.percentage,
    };
    const changed = (next: number, last?: number): boolean =>
      last === undefined || Math.abs(next - last) > Math.abs(next) * 1e-3;

    if (report.unit !== undefined && report.unit > 0 && this.autoUnitWarningActive) {
      const unitsPerEm = 1 / report.unit;
      if (changed(unitsPerEm, this.lastReportedUnitsPerEm)) {
        this.lastReportedUnitsPerEm = unitsPerEm;
        this.errors.addOrReplace({
          id: "AUTO_unitScaling",
          type: "warning",
          message: `unit-scaling: invalid value "${this.unitScaling}" - auto-fitted to 1 em ≈ ${formatScalingValue(unitsPerEm)} units.`,
        });
      }
    }
    if (report.percentage !== undefined && report.percentage > 0 && this.autoPctWarningActive) {
      const ppPerEm = 1 / report.percentage;
      if (changed(ppPerEm, this.lastReportedPpPerEm)) {
        this.lastReportedPpPerEm = ppPerEm;
        this.errors.addOrReplace({
          id: "AUTO_percentageScaling",
          type: "warning",
          message: `percentage-scaling: invalid value "${this.percentageScaling}" - auto-fitted to 1 em ≈ ${formatScalingValue(ppPerEm)} percentage points.`,
        });
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const dataSetStructure: Record<string, unknown> = {
      ITableDataRow: {
        setName: { type: "string", isOptional: false, description: "" },
        setNameIndex: { type: "number", isOptional: true, description: "" },
        date: { type: "string", isOptional: false, description: "" },
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

  /**
   * The line this table wants to be aligned on, in CSS px from the host's
   * top-left corner: `y` is the bottom of the header, `x` the left edge of
   * the first value column. Empty before the table has drawn.
   */
  @Method()
  async getBaseline(): Promise<Baseline> {
    return this.readBaseline();
  }

  private readBaseline(): Baseline {
    const table = this.element.shadowRoot?.querySelector("bn-table-renderer")?.shadowRoot?.querySelector("table");
    return readTableBaseline(table, this.element);
  }

  /**
   * Lazily generates this table's layout state: host box (context- and
   * component-relative, CSS px), header/body regions, row/column/cell counts,
   * diagnostics and resolved scaling. With `detail: "full"` every cell is
   * listed with its geometry, model value, column key and in-cell bar chart.
   *
   * @param options - `{ detail: "summary" | "full" }`, default `"summary"`
   */
  @Method()
  async getLayoutState(options?: LayoutStateOptions): Promise<ComponentLayoutState> {
    const detail = options?.detail ?? "summary";
    const origins = originsFor(this.element);
    const rawFactor = this.getEffectiveScaleFactor();
    // Auto-scale can be mid-measurement (or unmeasurable in tests) - report a sane factor.
    const effectiveFactor = Number.isFinite(rawFactor) && rawFactor > 0 ? rawFactor : 1;
    const fontSizePx = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333) * effectiveFactor;

    const state: ComponentLayoutState = {
      version: LAYOUT_STATE_VERSION,
      tag: this.element.localName,
      id: resolveStandaloneId(this.element),
      slot: this.element.getAttribute("slot") ?? undefined,
      rect: measure(this.element, origins),
      em: {
        fontSizePx,
        appliedScaleFactor: effectiveFactor,
        scaleMode: parseScaling(this.scale).mode === "factor" ? "fixed" : "auto",
      },
      regions: [],
      metadata: {},
      diagnostics: readDiagnostics(this.element),
      scaling: this.resolveScalingInfo(fontSizePx),
      baseline: this.readBaseline(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = this.element.shadowRoot?.querySelector("bn-table-renderer") as any;
    if (inner) {
      const scenarios: string[] = inner.scenarios ?? [];
      state.metadata.scenarios = scenarios.filter((name) => !name.startsWith("d"));
      state.metadata.variances = scenarios.filter((name) => name.startsWith("d"));
      if (typeof inner.getLayoutDetail === "function") {
        const layoutDetail: TableLayoutDetail = await inner.getLayoutDetail(origins, detail);
        state.regions = layoutDetail.regions;
        state.metadata = { ...state.metadata, ...layoutDetail.metadata };
        state.diagnostics = [...state.diagnostics, ...layoutDetail.diagnostics];
        if (layoutDetail.elements) state.elements = layoutDetail.elements;
        if (layoutDetail.table) state.table = layoutDetail.table;
      }
    }
    return state;
  }

  /**
   * Resolved value scaling without re-triggering validation side effects.
   * The table's internal scale unit is em per unit / em per percentage point;
   * auto-fitted values come from the last inner report.
   */
  private resolveScalingInfo(emPx: number): ScalingInfo {
    const info: ScalingInfo = {};
    const unit = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap);
    if (unit.kind === "value") {
      info.unitMode = "fixed";
      info.unitsPerEm = unit.value;
      info.unitPxPerUnit = emPx / unit.value;
    } else {
      info.unitMode = "auto";
      const emPerUnit = this.lastAutoScalingReport?.unit;
      if (emPerUnit !== undefined && emPerUnit > 0) {
        info.unitsPerEm = 1 / emPerUnit;
        info.unitPxPerUnit = emPerUnit * emPx;
      }
    }
    const pct = resolveScalingValue(this.percentageScaling, this.pixelPerUnitGroupMap);
    if (pct.kind === "value") {
      info.percentageMode = "fixed";
      info.percentagePointsPerEm = pct.value;
      info.percentagePxPerPoint = emPx / pct.value;
    } else {
      info.percentageMode = "auto";
      const emPerPoint = this.lastAutoScalingReport?.percentage;
      if (emPerPoint !== undefined && emPerPoint > 0) {
        info.percentagePointsPerEm = 1 / emPerPoint;
        info.percentagePxPerPoint = emPerPoint * emPx;
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
    const fontStyles = this.getFontStyles();
    const effectiveFactor = this.getEffectiveScaleFactor();

    return (
      <Host style={fontStyles}>
        <div>
          <bn-table-renderer
            tableName={this.datasetName}
            dataVersion={this.dataVersion}
            sumTitle={this.prepareSumTitle()}
            scenarios={this.prepareScenarios()}
            scenariosDataFormat={this.prepareDataFormat()}
            grouped={this.prepareGrouped()}
            limit={this.prepareLimit()}
            showGroupTitle={this.prepareShowGroupTitle()}
            runningSum={this.runningSum}
            varianceWaterfall={this.varianceWaterfall}
            thereof={this.prepareThereOf()}
            thereofPosition={this.prepareThereofPosition()}
            partof={this.preparePartOf()}
            order={this.prepareOrder()}
            categorythereof={this.prepareColumnThereOf()}
            attributeColumns={this.prepareAttributes()}
            type={this.prepareTableType()}
            categoryWidth={this.prepareCategoryWidth()}
            dataFormatDigits={this.prepareDataFormatDigits()}
            i18n={this.prepareI18n()}
            i18nMode={this.prepareI18nMode()}
            measureScale={this.prepareMeasureScale()}
            measureType={this.prepareMeasureType()}
            measureUnit={this.prepareMeasureUnit()}
            showMeasureScale={this.prepareShowMeasureScale()}
            filter={this.prepareFilter()}
            barColumns={this.prepareBarColumns()}
            interval={this.prepareInterval()}
            categoryIntervalPosition={this.prepareCategoryIntervalPosition()}
            barColumnMaxWidth={this.prepareBarColumnWidth()}
            unitScaling={this.prepareUnitScaling()}
            percentageScaling={this.preparePercentageScaling()}
            reportAutoScaling={this.handleAutoScalingReport}
            errors={this.errors}
            scaleFactor={effectiveFactor}
            ruleSetConfig={this.ruleSetConfig()}
            selectedStyle={this.selectedStyle}
          ></bn-table-renderer>
        </div>
      </Host>
    );
  }
}
