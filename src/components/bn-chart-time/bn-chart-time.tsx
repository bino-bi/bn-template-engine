import { Component, Element, forceUpdate, h, Host, Method, Prop, State, Watch, writeTask } from "@stencil/core";
import { hasInlineJs } from "../../context/scopedDb";
import {
  isBlankInput,
  isValidAxisLabelsMode,
  isValidBoolean,
  isValidDateFormat,
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
import { TimeChartStyle } from "./utils/model";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import { Formatter } from "../../utils/formatter";
import { AxisLabelsMode, ChartMode, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed } from "./utils/model/TimeChartComponentConfig";
import { DateDistance } from "../../utils/DateStringFactory";
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

enum AggregationLevel {
  ROWGROUP = "rowGroup",
  ROWGROUPINDEX = "rowGroupIndex",
  CATEGORY = "category",
  CATEGORYINDEX = "categoryIndex",
  SUBCATEGORY = "subCategory",
  SUBCATEGORYINDEX = "subCategoryIndex",
}

/**
 * SVG time-series chart following IBCS standards.
 *
 * Subscribes to a dataset (via `withDataset`) and renders date-axis bar or
 * line charts with up to four scenario layers, optional variance sub-charts,
 * stacking, and proportional auto-scaling. Date normalization and interval
 * detection are delegated to `DateStringFactory`. The heavy SVG rendering
 * is performed by the inner `ibcs-chart-time` element; this outer component
 * validates props, resolves auto-detected metadata, and computes styles.
 */
@Component({
  tag: "bn-chart-time",
  styleUrl: "bn-chart-time.scss",
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
  private readonly componentStyle: <T>(q: (Style) => T) => T;
  private readonly ruleSetConfig: () => RuleSetConfig;
  private readonly errors: ErrorDispatcher;
  private readonly resolveInherited: InheritedResolver;
  private layoutObserver: LayoutObserverHandle | null = null;

  /**
   * Name of a registered IBCS rule set (see `bn-ruleset`) used for scenario
   * ordering. Supports `"inherited-closest"` / `"inherited-page"` to take
   * over the value from an ancestor `bn-layout-card` / `bn-layout-page`.
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
   * List of Scenarios Map.
   *<br /> <br />
   * per chart there are up to 4 different scenarios supported.
   * The first 4 scenarios in the list are used, the rest ignored.
   *
   *<br /> <br />
   *  values:<br /> ```ac // fc // pp // pl  [1-4] // auto```
   *  example:<br /> ```ac1,ac2,ac3,ac4```
   *<br /> <br />
   *  When set to ```auto```, scenarios are detected from the dataset silently.
   *  When left blank, scenarios are detected from the dataset with a warning.
   *
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
   * List of Variance Map.
   *<br /> <br />
   *   Variance chart can be added by seperating the scenarios
   *   of each chart with ```;```<br />
   *   The additonal variances which
   *   are calculated form the given scenarios.
   *   the scenarios used in the variances have also
   *   be defined in the *scenarios* property.
   *<br /> <br />
   *   the variance is defiend as  (Scenario A -  ScenarioB)
   *   neu. neg and pos post fix defines which value is *good*
   *   a negative or a positive value.
   *<br /> <br />
   *   if empty variance charts are hidden
   *<br /> <br />
   *   each variance creates a chart
   *<br /> <br />
   *   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```
   *
   *    example: <br />```'dpp1_ac1_neg,dfc1_ac1_neg'```
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

  @Prop() syncSpaceLeft: number = -1;

  @Watch("syncSpaceLeft")
  validateLeftSync(newValue: string | number) {
    const errId: string = "ERR_syncSpaceLeft";

    if (!isValidNumber(newValue as number)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "syncSpaceLeft: invalid value(s) '" + newValue + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Set the maximum number of columns stacks The value 0 means *no limit*
   * <br /><br />
   *
   * columns stacks wich where cut by the limit are cumulated as REST
   *
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
   * Data units displayed per 1 em of bar length (vertical bars) - map-scale
   * semantics: a larger value means smaller bars.
   *
   * | Value              | Behavior                                                    |
   * |--------------------|-------------------------------------------------------------|
   * | `"auto"`           | Auto-fit bars to fill the available container height        |
   * | not set / invalid  | Same as auto, but emits `AUTO_unitScaling` warning          |
   * | `"250000"`, `"1M"` | Units per em; optional SI suffix `k`/`K`/`M`/`G`/`T`        |
   * | group name         | References a `<bn-scaling-group>` for synchronized scaling  |
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
   * Percentage points displayed per 1 em of pin/bar length for relative
   * variances - a larger value means shorter pins.
   *
   * | Value             | Behavior                                                      |
   * |-------------------|---------------------------------------------------------------|
   * | `"auto"`          | Auto-fit to available height (same two-pass as unit-scaling)  |
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
   * Determines level on which the chart is aggregated on.
   * <br /> <br />
   *
   * values:<br/>
   * ``` rowcategory // category // subcategory // auto```
   * <br /> <br />
   *  When set to ```auto```, level is detected from the dataset silently.
   *  When left blank, level is detected from the dataset with a warning.
   *
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

  /** List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *  <br /><br />
   *  values:<br />
   *  ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac[1-4] // fc[1-4] // py[1-4] // pl[1-4] // auto```
   *  <br /><br />
   *  When set to ```auto```, order is detected from the dataset silently.
   *  When left blank, order is detected from the dataset with a warning.
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

  /** set sorting order direction
   *  <br /><br />
   *  values:<br />
   *  ```asc // desc```
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

  /** Axis Date Interval
   *  <br /><br />
   *  values:<br />
   *  ```year // quarter // month // week // day // hour // minute // second // millisecond // auto```
   *  <br /><br />
   *  When set to ```auto```, dateInterval is detected from the dataset silently.
   *  When left blank, dateInterval is detected from the dataset with a warning.
   */
  @Prop() dateInterval!: string;

  @Watch("dateInterval")
  validateDateInterval(newValue: string) {
    const errId: string = "ERR_dateInterval";

    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (!isValidDateFormat(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "dateInterval: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** Chart Mode - controls how the chart is rendered
   *  <br /><br />
   *  values:<br />
   *  ```bar // line // auto```
   *  <br /><br />
   *  When set to 'auto', the chart will switch to line mode
   *  when the number of data points exceeds maxBars.
   */
  @Prop() chartMode: string = "bar";

  @Watch("chartMode")
  validateChartMode(newValue: string) {
    const errId: string = "ERR_chartMode";
    const validModes = ["bar", "line", "auto"];

    if (!validModes.includes(newValue?.toLowerCase())) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message:
          "chartMode: invalid value '" +
          newValue?.toString() +
          "' is not supported. Valid values are: bar, line, auto.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** Max Bars - threshold for auto-switching to line mode
   *  <br /><br />
   *  When chartMode is set to 'auto' and the number of data points
   *  exceeds this value, the chart will render as a line chart.
   */
  @Prop() maxBars: number = 28;

  @Watch("maxBars")
  validateMaxBars(newValue: number) {
    const errId: string = "ERR_maxBars";

    if (!isValidInteger(newValue) || newValue < 1) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "maxBars: invalid value '" + newValue?.toString() + "' is not supported. Must be a positive integer.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Stacking configuration for the chart as a JSON string.
   *
   * When set, bars/columns are drawn stacked (additive layers) instead of
   * side-by-side. In line mode (`chart-mode="line"`), stacking produces a
   * stacked area chart with filled regions between cumulative lines.
   *
   * **JSON schema:**
   * ```json
   * {
   *   "by": "scenario" | "category" | "subcategory" | "rowgroup",
   *   "mode": "absolute" | "relative" | "absolute-relative",
   *   "order": "asc" | "desc" | "dataset"
   * }
   * ```
   *
   * - `by` (required): The dimension to stack.
   *   - `"scenario"` - stack the scenarios from the `scenarios` prop as layers.
   *   - `"category"` / `"subcategory"` / `"rowgroup"` - decompose a single
   *     scenario by this data dimension. Must be finer than `level`.
   * - `mode` (optional, default `"absolute"`):
   *   - `"absolute"` - additive stacking, axis shows absolute units.
   *   - `"relative"` - 100% stacking, axis shows 0%-100%. `unit-scaling` is
   *     interpreted as pixels per percentage point (e.g. `0.4` → 40px full
   *     stack); `"auto"` fits the stack to the available height as usual.
   *   - `"absolute-relative"` - bar height is absolute (real value), but
   *     segment labels inside show percentages.
   * - `order` (optional, default `"dataset"`): Segment order within each stack.
   *   `"asc"` / `"desc"` sort segments by value; `"dataset"` preserves the
   *   original data/scenario order.
   *
   * @default '' (empty - no stacking)
   *
   * @example
   * // Stack scenarios
   * stack='{"by":"scenario"}'
   *
   * @example
   * // Stack by category, relative mode
   * stack='{"by":"category","mode":"relative"}'
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
   * Controls proportional scaling of the chart to fit the available parent width.
   *
   * | Value               | Behavior                                                                          |
   * |---------------------|-----------------------------------------------------------------------------------|
   * | not set / `""`      | Auto-scale to fit parent width; emit `AUTO_scale` warning with the applied factor  |
   * | `"none"`            | No scaling (render at base font size regardless of available space)                |
   * | `"auto"`            | Auto-scale to fit parent width silently (no warning)                              |
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

  /** Max number of collumns
   *  is used to calculate Axis Date Interval (if dateInterval is set to AUTO)
   */
  @Prop()
  intervalSpanLimit: number = 28;

  /** Axis Labels Mode defines in which mode the labels are rendered.
   *  long, and short mode uses the long an short styles for the date
   *  smart only displays relevant information if a change/ transition occured
   *  (eg.  only on 1.Jan  the year is displayed)
   *  <br /><br />
   *  values:<br />
   *  ```smart // long // short```
   */
  @Prop() axisLabelsMode!: string;

  @Watch("axisLabelsMode")
  validateAxisLabelsMode(newValue: string) {
    const errId: string = "ERR_axisLabelsMode";

    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }

    if (!isValidAxisLabelsMode(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "axisLabelsMode: invalid value '" + newValue?.toString() + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /** When true (default), line charts stretch to fill the full parent width
   *  instead of using fixed per-data-point spacing.
   *  Has no effect in bar mode.
   *  <br /><br />
   *  values:<br />
   *  ```true // false```
   */
  @Prop() lineFullWidth: string = "true";

  @Watch("lineFullWidth")
  validateLineFullWidth(newValue: string) {
    const errId: string = "ERR_lineFullWidth";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "lineFullWidth: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

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
   *  Toggles display of measure units in table header
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
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

  @Prop() showOverlayAvg: string = "true";
  @Watch("showOverlayAvg")
  validateShowOverlayAvg(newValue: string) {
    const errId: string = "ERR_grouped";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "showOverlayAvg: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  @Prop() showOverlayMedian: string = "false";
  @Watch("showOverlayMedian")
  validateShowOverlayMedian(newValue: string) {
    const errId: string = "ERR_grouped";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "showOverlayMedian: invalid value(s) '" + newValue?.toString() + "' are not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * measureUnit displayed in table.
   */
  @Prop() measureUnit: string = "";
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
    this.resolveInherited = withInheritedProps(this, [
      { propName: "scenarios", ancestorAttr: "title-scenarios" },
      { propName: "variances", ancestorAttr: "title-variances" },
      { propName: "order", ancestorAttr: "title-order" },
      { propName: "orderDirection", ancestorAttr: "title-order-direction" },
    ]);
  }

  componentWillLoad() {
    this.validateFilter(this.filter);
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateUnitScaling(this.unitScaling);
    this.validateLimit(this.limit);
    // this.validateStyles(this.styles);
    this.validateLevel(this.level);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateLeftSync(this.syncSpaceLeft);
    this.validateDateInterval(this.dateInterval);
    this.validateAxisLabelsMode(this.axisLabelsMode);

    this.validateLineFullWidth(this.lineFullWidth);
    this.validateShowCategories(this.showCategories);
    this.validateMeasureScale(this.measureScale);
    this.validateShowMeasureScale(this.showMeasureScale);
    this.validateShowOverlayAvg(this.showOverlayAvg);
    this.validateShowOverlayMedian(this.showOverlayMedian);
    this.validateChartMode(this.chartMode);
    this.validateMaxBars(this.maxBars);
    this.validateStack(this.stack);
    this.validateScaling(this.scale);
  }

  private _autoScaleGuard = false;

  private _lastObservedWidth = 0;

  /**
   * Content width from the rendered SVG width attributes (segments stack
   * vertically, so the widest one counts) - immune to overflow:hidden
   * clipping along the ancestor chain. Falls back to scrollWidth before the
   * inner charts have rendered.
   */
  private measureContentWidth(): number {
    const inners = this.element.shadowRoot?.querySelectorAll("ibcs-chart-time");
    let widest = 0;
    let found = false;
    inners?.forEach((inner) => {
      const width = parseFloat(inner.shadowRoot?.querySelector("svg#drawCanvas")?.getAttribute("width") ?? "");
      if (!Number.isNaN(width)) {
        widest = Math.max(widest, width);
        found = true;
      }
    });
    // scrollWidth additionally sees non-SVG chrome, so take the larger.
    // Floor the fractional SVG width so borderline sub-pixel overhangs are
    // judged with the same integer tolerance as the scroll metrics.
    return found ? Math.max(Math.floor(widest), this.element.scrollWidth) : this.element.scrollWidth;
  }

  /** Content height as the sum of the vertically stacked segment SVGs. */
  private measureContentHeight(): number {
    const inners = this.element.shadowRoot?.querySelectorAll("ibcs-chart-time");
    let total = 0;
    let found = false;
    inners?.forEach((inner) => {
      const height = parseFloat(inner.shadowRoot?.querySelector("svg#drawCanvas")?.getAttribute("height") ?? "");
      if (!Number.isNaN(height)) {
        total += height;
        found = true;
      }
    });
    // scrollHeight additionally sees non-SVG chrome (e.g. the footer).
    // Floor the fractional SVG heights so borderline sub-pixel overhangs are
    // judged with the same integer tolerance as the scroll metrics.
    return found ? Math.max(Math.floor(total), this.element.scrollHeight) : this.element.scrollHeight;
  }

  /**
   * Reports a WARN_overflow item when the rendered chart exceeds its
   * container. Overflow attributable to a fixed scaling attribute is an
   * error (height: unit-scaling / percentage-scaling, width: scale);
   * overflow in fully-auto mode is a warning - auto-fit prevents it by
   * construction, so it only fires when the content cannot fit at any scale.
   */
  private checkOverflow(): void {
    const errId = "WARN_overflow";
    const parent = getParentDimensions(this.element);
    const contentWidth = this.measureContentWidth();
    const contentHeight = this.measureContentHeight();
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
    if (heightOver && fixedUnit) fixedAttrs.push("unit-scaling");
    if (heightOver && fixedPercent) fixedAttrs.push("percentage-scaling");
    if (widthOver && fixedScale) fixedAttrs.push("scale");

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

  componentDidRender() {
    syncEmptyState(this.element, "ibcs-chart-time");

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

    // Keep observer tracking in sync so the observer callback does not
    // trigger spurious forceUpdate calls with stale threshold values.
    this._lastObservedWidth = parentWidth;

    const baseFontSize = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const currentWidth = host.scrollWidth;
    const currentFactor = this.appliedScaleFactor;

    // Content fits at current factor - done. Don't reset to factor 1;
    // the content only fits BECAUSE of the current factor.
    if (currentWidth <= parentWidth + 1) {
      this.errors.remove("AUTO_scale");
      this.checkOverflow();
      return;
    }

    // Content overflows. Compute a new factor based on the ratio of
    // parent to current content width, scaled by the current factor.
    const computedFactor = Math.max(0.3, (currentFactor * (parentWidth - 1)) / currentWidth);

    // Only apply if the change is significant (> 1% of current factor).
    if (Math.abs(computedFactor - currentFactor) < 0.01) {
      // Converged (possibly at the 0.3 floor) but still overflowing - report it.
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
    // Watch for size changes (window resize, card relayout).
    this.layoutObserver = observeParentResize(this.element, () => {
      if (this._autoScaleGuard) return;
      const { width } = getParentDimensions(this.element);
      // Only react to WIDTH changes - this chart scales by width.
      // Height changes (e.g. from page-fit-to-content auto grid rows)
      // are irrelevant and would cause an infinite render loop.
      if (width > 0 && Math.abs(width - this._lastObservedWidth) > 2) {
        this._lastObservedWidth = width;
        forceUpdate(this);
      }
    });

    // Double-rAF: guarantees the browser completed at least one full
    // paint cycle so all nested card/body/grid layouts are finalized.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._autoScaleGuard) return;
        const { width } = getParentDimensions(this.element);
        this._lastObservedWidth = width;
        forceUpdate(this);
      });
    });

    this.settleParentHeight();
  }

  private _settleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The initial renders can measure mid-hydration, before ancestor CSS
   * (fixed page height, overflow) is applied, so the height used for
   * auto-fit may be a transient value - and the resize observer above
   * deliberately ignores height changes. Re-measure on a short backoff
   * schedule and re-render when the measurement no longer matches the
   * height the last render actually used (_lastAppliedHeight, recorded
   * in prepareDimension). The schedule is finite, so this cannot feed a
   * render loop.
   */
  private settleParentHeight() {
    const delays = [150, 400, 1000, 2500];

    const check = () => {
      this._settleTimer = null;
      if (!this.element.isConnected) return;
      const { height } = getParentDimensions(this.element);
      // 8px threshold: hydration corrections are large (hundreds of px);
      // small jitter must not cause re-renders, because every re-render
      // gives the width-overflow font scaler a chance to ratchet down.
      if (height > 0 && Math.abs(height - this._lastAppliedHeight) > 8 && !this._autoScaleGuard) {
        forceUpdate(this);
      }
      const next = delays.shift();
      if (next !== undefined) {
        this._settleTimer = setTimeout(check, next);
      }
    };

    this._settleTimer = setTimeout(check, delays.shift());
  }

  disconnectedCallback() {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    if (this._settleTimer != null) {
      clearTimeout(this._settleTimer);
      this._settleTimer = null;
    }
  }

  private _lastAppliedHeight = 0;

  prepareDimension(): ParentDimensions {
    const parent = getParentDimensions(this.element);
    const scenariosList = this.prepareScenarios();
    const variancesList = this.prepareVariances();
    this.canvasWidthSegmented = parent.width / (scenariosList.length + variancesList.length || 1);
    this._lastAppliedHeight = parent.height;
    // The base chart and each variance render as vertically stacked segments
    // (see render()), so each one may only claim its share of the height.
    // The measure-scale footer (first segment only) renders below its SVG:
    // reserve roughly one em for it so the fitted charts leave it room.
    const segmentCount = 1 + variancesList.length;
    const footerAllowance = this.showMeasureScale === "true" ? this.getEffectiveFontPx() : 0;
    return { width: this.canvasWidthSegmented, height: Math.max(0, parent.height - footerAllowance) / segmentCount };
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

  private prepareAvg(): boolean {
    return this.showOverlayAvg === "true";
  }

  private prepareMedian(): boolean {
    return this.showOverlayMedian === "true";
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

  private prepareHideAxisLabels(idx: number): boolean {
    return idx >= 1 || this.showCategories !== "true";
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["no-data"];
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
   * Receives the auto-fitted values from the inner ibcs-chart-time (px per
   * unit / px per 1.0 fraction) and surfaces them in the AUTO_* warnings,
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
    const inheritedOrder = this.resolveInherited("order", this.order);
    const inheritedDirection = this.resolveInherited("orderDirection", this.orderDirection);

    const effectiveOrder = inheritedOrder ?? this.order;
    const effectiveDirection = inheritedDirection ?? this.orderDirection;

    const isLevelAuto = isBlankInput(this.level) || this.level?.trim().toLowerCase() === "auto";
    let entryValue = isLevelAuto && this.datasetMeta?.suggestedLevel ? this.datasetMeta.suggestedLevel : this.level;

    const isOrderAuto = effectiveOrder?.trim().toLowerCase() === "auto";
    if (isBlankInput(effectiveOrder) || isOrderAuto) {
      if (this.datasetMeta?.suggestedLevel) {
        if (!isOrderAuto) {
          this.errors.addOrReplace({
            id: "AUTO_order",
            type: "warning",
            message: `order: not set, auto-detected: ${entryValue}`,
          });
        } else {
          this.errors.remove("AUTO_order");
        }
      }
    } else {
      this.errors.remove("AUTO_order");
      if (effectiveOrder?.toLocaleLowerCase() === "levelindex") {
        entryValue += "Index";
      }
    }

    const tableOrder: Order = {
      hierarchy: [OrderColumn[entryValue?.toUpperCase() as keyof typeof OrderColumn]],
      direction: OrderDirection[effectiveDirection?.toUpperCase() as keyof typeof OrderDirection],
    };

    return tableOrder;
  }

  private prepareStyle(): TimeChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-time"]["scaleFactors"]["scenarioOffset"],
          scenarioLabelToColumn: $["bn-chart-time"]["scaleFactors"]["scenarioLabelToColumn"],
          labelToColumn: 0.3,
          labelToColum: $["bn-chart-time"]["scaleFactors"]["labelToColum"],
          labelToAxis: $["bn-chart-time"]["scaleFactors"]["labelToAxis"],
          needleWidth: $["bn-chart-time"]["scaleFactors"]["needleWidth"],
          needleHeadWidth: $["bn-chart-time"]["scaleFactors"]["needleHeadWidth"],
          columnWidth: $["bn-chart-time"]["scaleFactors"]["columnWidth"],
          varianceAxisLineWidth: $["bn-chart-time"]["scaleFactors"]["varianceAxisLineWidth"],
          axisLineWidth: $["bn-chart-time"]["scaleFactors"]["axisLineWidth"],
          auxiliaryLineWidth: $["bn-chart-time"]["scaleFactors"]["auxiliaryLineWidth"],
          scenarioLineWidth: $["bn-chart-time"]["scaleFactors"]["scenarioLineWidth"],
          markerWidth: $["bn-chart-time"]["scaleFactors"]["markerWidth"],
          markerOffset: $["bn-chart-time"]["scaleFactors"]["markerOffset"],
          categoryWidth: $["bn-chart-time"]["scaleFactors"]["categoryWidth"],
          axisTickLength: $["bn-chart-time"]["scaleFactors"]["axisTickLength"],
        },
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]["fontFamily"]}`,
          family: $["global"]["fontFamily"],
          size: scaledFontSize,
          color: $["global"]["fontColor"],
          background: $["global"]["fontBackgroundColor"],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-time"]["axisStyles"],
        barStyles: $["bn-chart-time"]["barStyles"],
        varianceStyles: $["bn-chart-time"]["varianceStyles"],
        stackColors: $["bn-chart-time"]["stackColors"],
        padding: $["bn-chart-time"]["padding"],
        pattern: null,
      };
    });
  }

  private prepareLeftSideOffset(preparedI18n: Map<string, string>, preparedStyle: TimeChartStyle): number {
    if (this.syncSpaceLeft > -1) {
      return this.syncSpaceLeft;
    }

    const leftSideOffset: number = Formatter.getMaxWidthOfArrayItems(
      [...this.prepareVariances(), ...this.prepareScenarios(), this.chartTitle],
      preparedI18n,
      preparedStyle,
    );

    //if(leftSideOffset < this.syncSpaceLeft) {
    //  return this.syncSpaceLeft;
    //}

    return leftSideOffset;
  }

  private prepareChartTitle(idx: number): string {
    if (idx >= 1) {
      return "";
    }

    return this.chartTitle;
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareDateInterval(): DateDistance {
    const isAuto = this.dateInterval?.trim().toLowerCase() === "auto";
    if (isBlankInput(this.dateInterval) || isAuto) {
      if (this.datasetMeta?.suggestedDateInterval) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: "AUTO_dateInterval",
            type: "warning",
            message: `dateInterval: not set, auto-detected: ${this.datasetMeta.suggestedDateInterval}`,
          });
        } else {
          this.errors.remove("AUTO_dateInterval");
        }
        return DateDistance[this.datasetMeta.suggestedDateInterval.toUpperCase() as keyof typeof DateDistance];
      }
      return isAuto ? DateDistance.AUTO : undefined;
    }
    this.errors.remove("AUTO_dateInterval");
    return DateDistance[this.dateInterval?.toUpperCase() as keyof typeof DateDistance];
  }

  private prepareIntervalSpanLimit(): number {
    return this.intervalSpanLimit;
  }

  private prepareAxisLabelsMode(): AxisLabelsMode {
    return AxisLabelsMode[this.axisLabelsMode?.toUpperCase() as keyof typeof AxisLabelsMode];
  }

  private prepareFilter(): string {
    if (this.filter.length === 0) {
      return "";
    }

    return this.filter;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getDataStructure(): any {
    const dataSetStructure: Record<string, unknown> = {
      ITimeChartDataRow: {
        setName: { type: "string", isOptional: false, description: "" },
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

  private prepareLineFullWidth(): boolean {
    return this.lineFullWidth === "true";
  }

  private prepareChartMode(): ChartMode {
    const mode = this.chartMode?.toLowerCase();
    if (mode === "line") {
      return ChartMode.LINE;
    } else if (mode === "auto") {
      return ChartMode.AUTO;
    }
    return ChartMode.BAR;
  }

  private prepareMaxBars(): number {
    return Math.floor(Number(this.maxBars) || 28);
  }

  chartTemplate(localScenarioString: string, idx: number) {
    const preparedI18n: Map<string, string> = this.prepareI18n();
    const preparedStyle: TimeChartStyle = this.prepareStyle();
    const fullParentWidth = getParentDimensions(this.element).width;
    const ppu = this.preparePixelPerUnit();
    const ppp = this.preparePixelPerPercentage();
    const stackConfig = this.prepareStackConfig();
    const scenarios = this.prepareScenarios();
    const effectiveScenarios = stackConfig?.by === StackBy.DIMENSIONS ? scenarios.slice(0, 1) : scenarios;

    return (
      <ibcs-chart-time
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.prepareChartTitle(idx)}
        scenarios={effectiveScenarios}
        variances={[localScenarioString]}
        hideAxisLabels={this.prepareHideAxisLabels(idx)}
        pixelPerUnit={ppu}
        pixelPerPercentage={ppp}
        reportAutoScaling={this.handleAutoScalingReport}
        limit={this.prepareLimit()}
        leftSideOffsetForHorizontalSync={this.prepareLeftSideOffset(preparedI18n, preparedStyle)}
        styles={preparedStyle}
        i18n={preparedI18n}
        order={this.prepareOrder()}
        level={this.prepareLevel()}
        dateInterval={this.prepareDateInterval()}
        intervalSpanLimit={this.prepareIntervalSpanLimit()}
        axisLabelsMode={this.prepareAxisLabelsMode()}
        filter={this.prepareFilter()}
        measure-scale={this.prepareMeasureScale()}
        measure-unit={this.prepareMeasureUnit()}
        showOverlayAvg={this.prepareAvg()}
        showOverlayMedian={this.prepareMedian()}
        showMeasureScale={this.prepareShowMeasureScale(idx)}
        chartMode={this.prepareChartMode()}
        maxBars={this.prepareMaxBars()}
        stackConfig={stackConfig}
        lineFullWidth={this.prepareLineFullWidth()}
        containerWidth={fullParentWidth}
        parentDimensions={this.prepareDimension()}
        ruleSetConfig={this.ruleSetConfig()}
      ></ibcs-chart-time>
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
    const layout = collectChartFacadeLayout(this.element, "ibcs-chart-time", ["base", ...variances], origins, detail);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstInner = this.element.shadowRoot?.querySelector("ibcs-chart-time") as any;

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
        chartMode: this.chartMode || undefined,
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
