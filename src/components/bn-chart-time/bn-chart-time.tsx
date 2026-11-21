import { Component, Element, forceUpdate, h, Host, Method, Prop, State, Watch, writeTask } from "@stencil/core";
import { hasInlineJs } from "../../context/scopedDb";
import {
  isBlankInput,
  isValidAxisLabelsMode,
  isValidDateFormat,
  isValidInteger,
  isValidMeasureScale,
  isNoScenarios,
  isValidNumber,
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
import { ruleSetLabels } from "../../utils/ibcsRuleSet";
import withRuleSet from "../../utils/withRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import withHasError, { ErrorDispatcher, reportOverflow } from "../../utils/withHasError";
import withInheritedProps, { InheritedResolver, isInheritedValue } from "../../utils/withInheritedProps";
import { measureHeightBonus, settleHeightBonus } from "./utils/helper/heightBonus";
import { getParentDimensions, ParentDimensions } from "../../utils/parentDimensions";
import { AutoScalingReport, formatScalingValue, parseScaling, resolveScalingValue } from "../../utils/scaling";
import { observeParentResize, LayoutObserverHandle } from "../../utils/layoutObserver";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { VarianceScenario, variancesScenarios } from "../../utils/model/VarianceScenario";
import { TimeChartStyle } from "./utils/model";
import { Formatter } from "../../utils/formatter";
import { AxisLabelsMode, ChartMode, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed, TotalsConfig } from "./utils/model/TimeChartComponentConfig";
import { getStores } from "../../context/context-protocol";
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
  readChartBaseline,
  resolveStandaloneId,
  Baseline,
} from "../../utils/layoutState";
import { syncEmptyState } from "../../utils/emptyState";

/**
 * SVG time-series chart following IBCS standards.
 *
 * Subscribes to a dataset (via `withDataset`) and renders date-axis bar or
 * line charts with up to four scenario layers, optional variance sub-charts,
 * stacking, and proportional auto-scaling. Date normalization and interval
 * detection are delegated to `DateStringFactory`. The heavy SVG rendering
 * is performed by the inner `bn-chart-time-renderer` element; this outer component
 * validates props, resolves auto-detected metadata, and computes styles.
 */
/** The entries of `axis-labels-hide`: a JSON array or a comma separated list. */
function parseLabelsHide(value: string | undefined): string[] {
  const text = (value ?? "").trim();
  if (text === "") {
    return [];
  }
  let entries: unknown[] = text.split(",");
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [text];
    }
  }
  return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== "");
}

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
  private readonly ruleSetConfig: (layers?: "all" | "user") => RuleSetConfig;
  private readonly errors: ErrorDispatcher;
  private readonly resolveInherited: InheritedResolver;
  private layoutObserver: LayoutObserverHandle | null = null;

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
   * ordering, look and names. Supports `"inherited-closest"` / `"inherited-page"` to
   * take over the value from an ancestor `bn-layout-card` / `bn-layout-page`.
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
   *  When set to ```none```, no scenario is drawn: the chart shows only its variances,
   *  and the lowest variance carries the category labels.
   *
   */
  @Prop() scenarios!: string;
  @Watch("scenarios")
  validateScenario(newValue: string) {
    const errId = "WARN_scenarios";
    if (isInheritedValue(newValue) || isNoScenarios(newValue)) {
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
   *   op and opinv are accepted for pages that share variances with
   *   tables. Chart values carry their operation sign, so op acts like pos
   *   and opinv like neg.
   *<br /> <br />
   *   if empty variance charts are hidden
   *<br /> <br />
   *   each variance creates a chart
   *<br /> <br />
   *   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu/op/opinv]```
   *
   *    example: <br />```'dpp1_ac1_neg,dfc1_ac1_neg'```
   */
  @Prop() variances!: string;

  @Watch("variances")
  validateVariances(newValue: string) {
    const errIdVar = "WARN_variances";
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
    const errId = "WARN_syncSpaceLeft";

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
    const errId = "WARN_unitScaling";

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
    const errId = "WARN_percentageScaling";

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
    const errId = "WARN_dateInterval";

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
    const errId = "WARN_chartMode";
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
    const errId = "WARN_maxBars";

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
   *   "by": "scenarios" | "dimensions",
   *   "mode": "absolute" | "relative" | "absolute-relative",
   *   "order": "asc" | "desc" | "dataset",
   *   "notation": "none" | "scenario",
   *   "legend": "left" | "right" | "both" | "none",
   *   "percentMark": true | false
   * }
   * ```
   *
   * - `by` (required): What a stack is made of.
   *   - `"scenarios"` - stack the scenarios from the `scenarios` prop as layers,
   *     four at most.
   *   - `"dimensions"` - one segment per value of the `category` column of the
   *     dataset, ordered by `categoryIndex`, else by first appearance. There is
   *     no limit on the number of series, and a series keeps its colour in
   *     every period. The first scenario is drawn. With `scenario-switch` the
   *     scenario that has values in the period is drawn, so one axis can go
   *     from AC to FC to PL. In line mode each series is one layer of the
   *     area, in its colour from `stackColors`, with its value in its middle.
   *     The total is a line with markers and values on top, and the names of
   *     the series stand on the side `legend` names. A label that would lie
   *     on another one is left out. The labels of the first and the last
   *     period have the box of a plain label, as half of them lies beside
   *     the area. `order`, `notation`, `percentMark` and `scenario-switch`
   *     have no effect on the area.
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
   * - `notation` (optional, default `"none"`): with `"scenario"` a segment takes
   *   the look of its scenario. A forecast segment is hatched over the shade of
   *   its series, a plan segment is outlined, and the first series takes the
   *   fill of the scenario from `barStyles`.
   * - `legend` (optional, default `"left"`): where the series names stand. Left
   *   of the first column, right of the last column with a value, at both, or
   *   nowhere.
   * - `percentMark` (optional, default `false`): for `mode: "relative"`. The
   *   shares are plain numbers without the % sign, with
   *   `data-format-digits-percent` digits, and one `100%` mark stands at the
   *   upper end of the stack, on the side of the series names.
   *
   * @default '' (empty - no stacking)
   *
   * @example
   * // Stack scenarios
   * stack='{"by":"scenarios"}'
   *
   * @example
   * // Stack scenarios, relative mode
   * stack='{"by":"scenarios","mode":"relative"}'
   */
  @Prop() stack: string = "";

  @Watch("stack")
  validateStack(newValue: string) {
    const errId = "WARN_stack";
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

  /** Max number of columns.
   *  Only used to choose the date interval when dateInterval is AUTO:
   *  the finest interval that gives fewer periods than this. The series is never cut.
   */
  @Prop()
  intervalSpanLimit: number = 28;

  /** Axis Labels Mode defines in which mode the labels are rendered.
   *  long, and short mode uses the long an short styles for the date
   *  smart only displays relevant information if a change/ transition occured
   *  (eg.  only on 1.Jan  the year is displayed)
   *  two-row prints short labels and puts the parent period (the year of a
   *  month, quarter or week) in a second row, under the first period and where
   *  it changes. With scenario-switch the scenario names stand in the same row.
   *  <br /><br />
   *  values:<br />
   *  ```smart // long // short // two-row```
   */
  @Prop() axisLabelsMode!: string;

  @Watch("axisLabelsMode")
  validateAxisLabelsMode(newValue: string) {
    const errId = "WARN_axisLabelsMode";

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
  @Prop() lineFullWidth: boolean = true;

  @Prop() showCategories: boolean = true;

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
   *  Toggles display of measure units in table header
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() showMeasureScale: boolean = false;

  @Prop() showOverlayAvg: boolean = true;
  @Prop() showOverlayMedian: boolean = false;
  /**
   * measureUnit displayed in table.
   */
  @Prop() measureUnit: string = "";

  /**
   * Number of decimal digits of the value labels
   */
  @Prop() dataFormatDigitsDecimal: number = 1;

  @Watch("dataFormatDigitsDecimal")
  validateDataFormatDigitsDecimal(newValue: number) {
    this.validateDigits("dataFormatDigitsDecimal", newValue);
  }

  /**
   * Number of decimal digits of the percent labels (relative variances)
   */
  @Prop() dataFormatDigitsPercent: number = 2;

  /**
   * `false` prints the labels of relative variances without the percent sign (`+11.6`).
   * The title of the row (`ΔPY%`) still names the unit.
   */
  @Prop() dataFormatPercentSign: boolean = true;

  @Watch("dataFormatDigitsPercent")
  validateDataFormatDigitsPercent(newValue: number) {
    this.validateDigits("dataFormatDigitsPercent", newValue);
  }

  private validateDigits(name: string, value: number) {
    const errId = `WARN_${name}` as const;
    if (!isValidInteger(value) || Number(value) < 0 || Number(value) > 100) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: name + ": invalid value '" + value + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Prints only every n-th category label, starting with the first period.
   * 2 labels every second period. In line mode it works for a chart that
   * uses the full width.
   */
  @Prop() axisLabelsStep: number = 1;

  /**
   * Periods that get no category label, as a JSON array or a comma separated
   * list. An entry is a date or the start of one: `2022` leaves out every
   * period of that year, `2022-03` those of the month, `2022-03-01` the period
   * that starts on that day.
   *
   * @example axis-labels-hide='["2022","2023"]'
   */
  @Prop() axisLabelsHide?: string;

  @Watch("axisLabelsHide")
  validateAxisLabelsHide(newValue: string | undefined) {
    const errId = "WARN_axisLabelsHide";
    const invalid = parseLabelsHide(newValue).filter((entry) => !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry));
    if (invalid.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `axisLabelsHide: '${invalid.join("', '")}' is no date. Use 2022, 2022-03 or 2022-03-01.`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Stacked area: a thin line at every n-th period, from the axis to the top
   * of the stack. 1 draws one at every period. With it the dashed line at the
   * change of the year is not drawn. Default 0: no lines.
   */
  @Prop() periodLines: number = 0;

  /**
   * Stacked area: where the point of a period stands. `center` (default) is
   * the middle of the period, above its label. `end` is the right border of
   * the period, for values at the end of a period such as a stock.
   */
  @Prop() pointPosition: "center" | "end" = "center";

  /**
   * Scaling indicator: a light band behind the columns, from the axis up to this
   * value, with the value at its right end. Two charts with different scales
   * show the same value, so the reader sees the difference. Bar mode only.
   */
  @Prop() scalingIndicator?: number;

  /**
   * Total columns at their own scale, as JSON:
   * `{"by":"all","aggregation":"sum","unitScaling":280,"label":"2025","width":1.6}`.
   *
   * - `unitScaling` - data units per em of column height, like `unit-scaling`.
   *   Left out, the totals use the scale of the chart.
   * - `by` - what a total covers. `all` (default): one column right of the last
   *   period for all periods. `year`, `quarter`, `month`, `week`: one column
   *   behind the periods of each of them, on the axis.
   * - `aggregation` - `sum` (default), `average` or `last`. With `sum` a column
   *   stacks one part per scenario of the series: the first scenario, and with
   *   `scenario-switch` the ones that follow it. Else it is one column, hatched
   *   when a forecast is in its value and outlined for a plan.
   * - `dataset` - name of a dataset with one row per total (`date` and the
   *   scenario columns). The chart takes the values from it and computes none.
   *   With `average` or `last` the values of a row are one column.
   * - `scenarios` - scenarios that are drawn at a total only, not in the periods,
   *   for example `["pp1"]`. The chart adds them up from its dataset. Such a
   *   scenario must not be in `scenarios` of the chart. It is a column next to
   *   the reference of the total, and with `by: all` its variance to the total
   *   of the series is a thin bar at the right. With `dataset` every scenario of
   *   a row that the chart does not draw is such a scenario, and the list
   *   limits them.
   * - `label` - text under the column of `by: all`. The other columns take the name of their period.
   * - `width` - width in widths of a period column, default 1.
   *
   * The first other scenario is the reference behind a column. Each variance
   * row gets the variance of each total at the scale of the row. With
   * `scaling-indicator` a column has its own band, and with `by: all` a line
   * links it to the band of the periods. Plain columns only: not with `stack`
   * and not in line mode. The chart needs a fixed `unit-scaling`, and every
   * part of a total must be positive.
   */
  @Prop() totals: string = "";

  @Watch("totals")
  validateTotals(newValue: string) {
    const errId = "WARN_totals";
    if (isBlankInput(newValue) || this.parseTotals(newValue) != null) {
      this.errors.remove(errId);
    } else {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message:
          'totals: needs JSON with by one of all, year, quarter, month, week, and aggregation one of sum, average, last. A unitScaling must be greater than 0. For example {"unitScaling":280}.',
      });
    }
    this.bindTotalsDataset();
  }

  private parseTotals(value: string): (Omit<TotalsConfig, "pixelPerUnit"> & { unitScaling: number }) | null {
    try {
      const parsed = JSON.parse(value);
      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      // the same values as `unit-scaling`: a number, with an SI suffix, or the name of a scaling group
      // left out: the totals take the scale of the chart
      const ownScale = parsed?.unitScaling != null && parsed.unitScaling !== "";
      const scaling = ownScale
        ? resolveScalingValue(parsed.unitScaling, this.pixelPerUnitGroupMap)
        : { kind: "value" as const, value: 0 };
      if (scaling.kind !== "value" || (ownScale && !(scaling.value > 0))) return null;
      const by = parsed.by ?? "all";
      const aggregation = parsed.aggregation ?? "sum";
      if (!["all", "year", "quarter", "month", "week"].includes(by)) return null;
      if (!["sum", "average", "last"].includes(aggregation)) return null;
      const width = Number(parsed.width);
      const label = typeof parsed.label === "string" || typeof parsed.label === "number" ? String(parsed.label) : "";
      return {
        unitScaling: scaling.value,
        by,
        aggregation,
        label,
        width: width > 0 ? width : 1,
        dataset: typeof parsed.dataset === "string" ? parsed.dataset.trim() : "",
        scenarios: Array.isArray(parsed.scenarios)
          ? parsed.scenarios
              .filter((entry: unknown): entry is string => typeof entry === "string")
              .map((entry: string) => entry.trim().toLowerCase())
              .filter((entry: string) => /^(ac|fc|pp|pl)[1-4]$/.test(entry))
          : [],
      };
    } catch {
      return null;
    }
  }

  private totalsDatasetUnsubscribe: (() => void) | null = null;
  private totalsDatasetName = "";

  /** Draws the chart again when the dataset of the totals gets its rows. */
  private bindTotalsDataset() {
    // from the plain JSON: the name does not depend on a scaling group that may get its value later
    let name: string;
    try {
      const dataset = isBlankInput(this.totals) ? "" : JSON.parse(this.totals)?.dataset;
      name = typeof dataset === "string" ? dataset.trim() : "";
    } catch {
      name = "";
    }
    // an element that is not in the page has no subscription: it binds when it connects
    if (!this.element.isConnected) return;
    if (name === this.totalsDatasetName) return;
    this.totalsDatasetUnsubscribe?.();
    this.totalsDatasetUnsubscribe = null;
    this.totalsDatasetName = name;
    if (name) {
      this.totalsDatasetUnsubscribe = getStores(this.element).db.subscribe(name, () => {
        this.dataVersion++;
      });
    }
  }

  /** The totals in the units of the inner chart: pixels for one data unit. */
  private prepareTotals(): TotalsConfig | null {
    const parsed = isBlankInput(this.totals) ? null : this.parseTotals(this.totals);
    const errId = "WARN_totals_unitScaling";
    if (parsed == null) {
      this.errors.remove(errId);
      return null;
    }
    // two fixed scales side by side: with an automatic scale of the periods there is nothing to compare
    if (resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap).kind !== "value") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "totals: needs a fixed unitScaling of the chart, the total columns are not drawn.",
      });
      return null;
    }
    // without the columns each variance row would decide on its own which periods have a total
    if (this.hidesScenarios()) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "totals: needs the columns of the chart, a chart with scenarios none draws no total columns.",
      });
      return null;
    }
    this.errors.remove(errId);
    const { unitScaling, ...rest } = parsed;
    return { ...rest, pixelPerUnit: unitScaling > 0 ? this.getEffectiveFontPx() / unitScaling : 0 };
  }

  @Watch("axisLabelsStep")
  validateAxisLabelsStep(newValue: number) {
    const errId = "WARN_axisLabelsStep";
    if (!isValidInteger(newValue) || Number(newValue) < 1) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "axisLabelsStep: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  @Watch("periodLines")
  validatePeriodLines(newValue: number) {
    const errId = "WARN_periodLines";
    if (!isValidInteger(newValue) || Number(newValue) < 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "periodLines: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  @Watch("pointPosition")
  validatePointPosition(newValue: string) {
    const errId = "WARN_pointPosition";
    if (newValue !== "center" && newValue !== "end") {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "pointPosition: value '" + newValue + "' is not supported. Valid values are: center, end.",
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * For a series that changes its scenario along the time axis, for example
   * AC up to this year and PL after it. In a period where the first scenario
   * has no value, the next scenario with a value is drawn in its place with
   * its value label. A vertical line marks the change, and the scenario names
   * stand under the axis. Variances with the same reference and type share
   * one row. A chart with one scenario gets the name of that scenario under
   * the axis. Bar mode, without a stack or with a stack by dimensions.
   */
  @Prop() scenarioSwitch: boolean = false;

  /**
   * Draws each row of absolute variances as a walk: a column starts where the
   * column before ended, and thin lines join them. A period without a value
   * keeps the level. Relative variances stay pins. With `totals` of `by: all`
   * at the scale of the chart (no `unitScaling` in `totals`, aggregation
   * `sum`) the first row of absolute variances becomes a bridge: the reference
   * total stands before the first period, the total of the series behind the
   * last one, and the walk runs between their ends. With `sync-space-left`
   * there is no bridge, the reference total has no room in a synced space. Behind a total column on the axis (`by` other than `all`) a walk
   * starts again. Bar mode, plain columns: no effect in line mode and with
   * `stack`.
   */
  @Prop() varianceWaterfall: boolean = false;

  /**
   * With `scenario-switch`: draws the reference (the first scenario that is
   * not part of the series) as a column behind the series in every period, in
   * place of the marker. Further scenarios stay markers. Without
   * `scenario-switch` it has no effect.
   */
  @Prop() referenceColumn: boolean = false;

  /**
   * Where the axis title stands (the chart title, or the name of a variance).
   * <br /><br />
   * values:<br />
   * ```left // right // top // none```
   * <br />
   * `top`: the chart title in bold above the chart, with the unit behind it
   * when `show-measure-scale` is set. The rows of variances keep their name
   * at the axis.
   */
  @Prop() axisTitlePosition: string = "left";

  @Watch("axisTitlePosition")
  validateAxisTitlePosition(newValue: string) {
    const errId = "WARN_axisTitlePosition";
    if (!isBlankInput(newValue) && !["left", "right", "top", "none"].includes(newValue.trim().toLowerCase())) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: "axisTitlePosition: invalid value '" + newValue + "' is not supported.",
      });
    } else {
      this.errors.remove(errId);
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
      ],
      this.errors,
    );
  }

  componentWillLoad() {
    this.validateFilter(this.filter);
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateUnitScaling(this.unitScaling);
    // this.validateStyles(this.styles);
    this.validateLeftSync(this.syncSpaceLeft);
    this.validateDateInterval(this.dateInterval);
    this.validateAxisLabelsMode(this.axisLabelsMode);
    this.validateMeasureScale(this.measureScale);
    this.validateChartMode(this.chartMode);
    this.validateMaxBars(this.maxBars);
    this.validateStack(this.stack);
    this.validateScaling(this.scale);
    this.validateDataFormatDigitsDecimal(this.dataFormatDigitsDecimal);
    this.validateDataFormatDigitsPercent(this.dataFormatDigitsPercent);
    this.validateAxisLabelsStep(this.axisLabelsStep);
    this.validateAxisLabelsHide(this.axisLabelsHide);
    this.validatePeriodLines(this.periodLines);
    this.validatePointPosition(this.pointPosition);
    this.validateTotals(this.totals);
    this.validateAxisTitlePosition(this.axisTitlePosition);
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
    const inners = this.element.shadowRoot?.querySelectorAll("bn-chart-time-renderer");
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
    const inners = this.element.shadowRoot?.querySelectorAll("bn-chart-time-renderer");
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
   * Reports an overflow item when the rendered chart exceeds its
   * container. Overflow attributable to a fixed scaling attribute is an
   * error (height: unit-scaling / percentage-scaling, width: scale);
   * overflow in fully-auto mode is a warning - auto-fit prevents it by
   * construction, so it only fires when the content cannot fit at any scale.
   */
  private checkOverflow(): void {
    const parent = getParentDimensions(this.element);
    const contentWidth = this.measureContentWidth();
    const contentHeight = this.measureContentHeight();
    const widthOver = parent.width > 0 && contentWidth > parent.width + 1;
    const heightOver = parent.height > 0 && contentHeight > parent.height + 1;

    if (!widthOver && !heightOver) {
      reportOverflow(this.errors, null);
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

    reportOverflow(
      this.errors,
      `Chart exceeds available ${dims.join(" and ")}. ` +
        (fixedAttrs.length > 0
          ? `Adjust ${fixedAttrs.join(" / ")} or set to "auto".`
          : "Content does not fit even at minimum auto scaling; enlarge the container."),
      fixedAttrs.length > 0,
    );
  }

  componentDidRender() {
    syncEmptyState(this.element, "bn-chart-time-renderer");

    const bonusChanged = this.updateBaseHeightBonus();
    if (bonusChanged && !this._autoScaleGuard) {
      forceUpdate(this);
    }

    const { mode } = parseScaling(this.scale);

    if (mode !== "auto" && mode !== "empty") {
      this._autoScaleGuard = false;
      this.checkOverflow();
      return;
    }

    if (this._autoScaleGuard) {
      this._autoScaleGuard = false;
      this.checkOverflow();
      if (bonusChanged) {
        // the guard render did not use the new bonus yet
        forceUpdate(this);
      }
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

  connectedCallback() {
    // an element that is moved in the page comes back without its subscription
    this.bindTotalsDataset();
  }

  disconnectedCallback() {
    this.totalsDatasetUnsubscribe?.();
    this.totalsDatasetUnsubscribe = null;
    this.totalsDatasetName = "";
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    if (this._settleTimer != null) {
      clearTimeout(this._settleTimer);
      this._settleTimer = null;
    }
  }

  private _lastAppliedHeight = 0;

  /**
   * Height that the variance segments leave of their shares. With a fixed
   * `unitScaling` the base segment gets it on top of its own share, so a
   * column is cut only when the whole chart has no room for it.
   */
  private _baseHeightBonus = 0;

  /** Measures the drawn variance segments. True when the bonus of the base segment changed. */
  private updateBaseHeightBonus(): boolean {
    const segments = this.prepareSegments();
    const fixedUnit = resolveScalingValue(this.unitScaling, this.pixelPerUnitGroupMap).kind === "value";
    let measured = 0;
    if (fixedUnit && segments.length > 1 && segments[0].length === 0) {
      const renderers = Array.from(this.element.shadowRoot?.querySelectorAll("bn-chart-time-renderer") ?? []);
      measured = measureHeightBonus(
        this.segmentShare(this._lastAppliedHeight, segments.length),
        // the row of the bridge is not drawn: it leaves its whole share
        renderers
          .slice(1)
          .map((renderer) =>
            renderer.classList.contains("bridge-tier") ? 0.01 : (renderer as HTMLElement).offsetHeight,
          ),
      );
    }
    const bonus = settleHeightBonus(this._baseHeightBonus, measured);
    if (bonus === this._baseHeightBonus) {
      return false;
    }
    this._baseHeightBonus = bonus;
    return true;
  }

  /**
   * The base chart and each variance render as vertically stacked segments
   * (see render()), so each one may only claim its share of the height.
   * The measure-scale footer (first segment only) renders below its SVG:
   * reserve roughly one em for it so the fitted charts leave it room.
   */
  private segmentShare(parentHeight: number, segmentCount: number): number {
    // the title line above the chart is 1.5 em high and holds the unit
    const footerAllowance =
      this.titleIsTop() && (this.chartTitle || this.showMeasureScale)
        ? this.getEffectiveFontPx() * 1.5
        : this.showMeasureScale
          ? this.getEffectiveFontPx()
          : 0;
    return Math.max(0, parentHeight - footerAllowance) / Math.max(1, segmentCount);
  }

  prepareDimension(isBase: boolean = false): ParentDimensions {
    const parent = getParentDimensions(this.element);
    const scenariosList = this.prepareScenarios();
    const segments = this.prepareSegments();
    this.canvasWidthSegmented = parent.width / (scenariosList.length + this.prepareVariances().length || 1);
    this._lastAppliedHeight = parent.height;
    const share = this.segmentShare(parent.height, segments.length);
    return { width: this.canvasWidthSegmented, height: share + (isBase ? this._baseHeightBonus : 0) };
  }

  private prepareScenarios(): string[] {
    const scenarios = this.resolveInherited("scenarios", this.scenarios);
    if (scenarios.inherited) {
      this.errors.remove("AUTO_scenarios");
      return scenarios.value.split(",").map((entry) => entry.trim());
    }
    if (isNoScenarios(scenarios.value)) {
      this.errors.remove("AUTO_scenarios");
      return [];
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

  /** `scenarios="none"`: the chart draws its variances only. */
  private hidesScenarios(): boolean {
    const scenarios = this.resolveInherited("scenarios", this.scenarios);
    return !scenarios.inherited && isNoScenarios(scenarios.value);
  }

  /**
   * The stacked segments, bottom to top: `[]` is the base chart, else the
   * variances of one row. With `scenarioSwitch`, variances of one type over
   * the same reference share a row.
   */
  private prepareSegments(): string[][] {
    const rows: string[][] = this.hidesScenarios() ? [] : [[]];
    const rowByKey = new Map<string, string[]>();
    for (const variance of this.prepareVariances()) {
      const parsed = new VarianceScenario(variance);
      const key = `${parsed.type}:${parsed.delta}`;
      const row = this.scenarioSwitch && parsed.isValid ? rowByKey.get(key) : undefined;
      if (row) {
        row.push(variance);
        continue;
      }
      const created = [variance];
      rows.push(created);
      if (parsed.isValid) {
        rowByKey.set(key, created);
      }
    }
    return rows;
  }

  private prepareAxisTitlePosition(idx: number): string {
    const position = this.axisTitlePosition?.trim().toLowerCase();
    if (position === "top") {
      // the chart title stands in a line above the chart: the rows of variances keep their name at the axis
      return idx === 0 && !this.hidesScenarios() ? "none" : "left";
    }
    return position === "right" || position === "none" ? position : "left";
  }

  private labelsHideKey = "";
  private labelsHide: string[] = [];

  /** The same array for the same value, so the inner chart does not draw again for it. */
  private prepareAxisLabelsHide(): string[] {
    if ((this.axisLabelsHide ?? "") !== this.labelsHideKey) {
      this.labelsHideKey = this.axisLabelsHide ?? "";
      this.labelsHide = parseLabelsHide(this.axisLabelsHide);
    }
    return this.labelsHide;
  }

  private titleIsTop(): boolean {
    return this.axisTitlePosition?.trim().toLowerCase() === "top";
  }

  /** The unit text the first segment reports ("in kEUR"), for the title line above the chart. */
  @State() private topUnit: string = "";

  private handleUnitReport = (text: string): void => {
    if (text !== this.topUnit) {
      this.topUnit = text;
    }
  };

  /** `axisTitlePosition: top`: the bold title and the unit in a line above all rows of the chart. */
  private renderTitleTop() {
    if (!this.titleIsTop()) {
      return null;
    }
    const unit = this.showMeasureScale ? this.topUnit : "";
    if (!this.chartTitle && !unit) {
      return null;
    }
    const paddingLeft = this.componentStyle(($) => $["bn-chart-time"]?.["padding"]?.["left"] ?? 0);
    return (
      <div class="title-top" style={{ fontSize: `${this.getEffectiveFontPx()}px`, paddingLeft: `${paddingLeft}px` }}>
        {this.chartTitle ? <span class="measure">{this.chartTitle}</span> : null}
        {this.chartTitle && unit ? " " : null}
        {unit}
      </div>
    );
  }

  private prepareAvg(): boolean {
    return this.showOverlayAvg;
  }

  private prepareMedian(): boolean {
    return this.showOverlayMedian;
  }

  private prepareVariances(): string[] {
    const variances = this.resolveInherited("variances", this.variances).value;
    if (isBlankInput(variances)) {
      return [];
    }
    return variances?.split(",").map((entry) => entry.trim());
  }

  /** A variance over a scenario that is not drawn has no values, so its segment would be empty without a hint. */
  private checkVarianceScenarios(variances: string[]): void {
    const errId = "WARN_variances_scenario";
    const scenarios = this.prepareScenarios();
    const missing: string[] = [];

    for (const variance of variances) {
      const parsed = new VarianceScenario(variance);
      // a variance with a syntax error has WARN_variances
      if (!parsed.isValid) {
        continue;
      }
      for (const scenario of [parsed.base, parsed.delta]) {
        if (!scenarios.includes(scenario)) {
          missing.push(`'${variance}' needs '${scenario}'`);
        }
      }
    }

    if (!this.hidesScenarios() && scenarios.length > 0 && missing.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `variances: ${missing.join(", ")}, which is not in scenarios (${scenarios.join(", ")}). The variance has no values.`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  private prepareHideAxisLabels(idx: number): boolean {
    return idx >= 1 || !this.showCategories;
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["no-data", "date-format-short-year"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    const i18nMapLocal = new Map(i18nMetaLabelsLocal.map((key) => [key, this.t(".".concat(key))]));
    const i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map((key) => [key, this.t("global.".concat(key))]));

    // a name from a <bn-ruleset> wins over the i18n label of the scenario
    return new Map([
      ...i18nMapGlobal.entries(),
      ...i18nMapLocal.entries(),
      ...ruleSetLabels(this.ruleSetConfig("user")),
    ]);
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
   * Receives the auto-fitted values from the inner bn-chart-time-renderer (px per
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

  private prepareStyle(): TimeChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle(($) => {
      const baseFontSize = $["global"]["fontSizePx"];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-time"]["scaleFactors"]["scenarioOffset"],
          scenarioLabelToColumn: $["bn-chart-time"]["scaleFactors"]["scenarioLabelToColumn"],
          labelToColumn: $["bn-chart-time"]["scaleFactors"]["labelToColumn"],
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
        // placeholder, bn-chart-time-renderer sets the locale of its context
        locale: "de",
      };
    });
  }

  private prepareLeftSideOffset(preparedI18n: Map<string, string>, preparedStyle: TimeChartStyle): number {
    if (this.syncSpaceLeft > -1) {
      return this.syncSpaceLeft;
    }

    // without a title on the left only the scenario names stand there
    const position = this.axisTitlePosition?.trim().toLowerCase();
    const titles =
      position === "top"
        ? this.prepareVariances()
        : position === "right" || position === "none"
          ? []
          : [...this.prepareVariances(), this.chartTitle];
    const leftSideOffset: number = Formatter.getMaxWidthOfArrayItems(
      [...titles, ...this.prepareScenarios()],
      preparedI18n,
      preparedStyle,
    );

    //if(leftSideOffset < this.syncSpaceLeft) {
    //  return this.syncSpaceLeft;
    //}

    return leftSideOffset;
  }

  private prepareChartTitle(idx: number): string {
    // a variance keeps its own name as title
    if (idx >= 1 || this.hidesScenarios() || this.titleIsTop()) {
      return "";
    }

    return this.chartTitle;
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
    const limit = Number(this.intervalSpanLimit);
    return limit > 0 ? limit : 28;
  }

  private prepareAxisLabelsMode(): AxisLabelsMode {
    return AxisLabelsMode[this.axisLabelsMode?.toUpperCase().replace("-", "_") as keyof typeof AxisLabelsMode];
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
    // with the title above the chart the unit stands in that line
    return idx === 0 && this.showMeasureScale && !this.titleIsTop();
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
      this.errors.remove("WARN_stack_scenarios_max");
      return null;
    }
    try {
      const parsed = JSON.parse(this.stack);
      const by = parsed.by as StackBy;

      const errId = "WARN_stack_dimensions_scenarios";
      const maxId = "WARN_stack_scenarios_max";
      const scenarios = this.prepareScenarios();
      // with scenarioSwitch the further scenarios continue the first one along the time axis
      if (by === StackBy.DIMENSIONS && scenarios.length > 1 && !this.scenarioSwitch) {
        this.errors.addOrReplace({
          id: errId,
          type: "warning",
          message: `stack by dimensions: only the first scenario "${scenarios[0]}" is used, the rest (${scenarios.slice(1).join(", ")}) are discarded.`,
        });
      } else {
        this.errors.remove(errId);
      }
      if (by === StackBy.SCENARIOS && scenarios.length > 4) {
        this.errors.addOrReplace({
          id: maxId,
          type: "warning",
          message: `stack by scenarios: at most four scenarios are stacked, the rest (${scenarios.slice(4).join(", ")}) are discarded. Use stack by dimensions for more series.`,
        });
      } else {
        this.errors.remove(maxId);
      }

      return {
        by,
        mode: (parsed.mode as StackMode) || StackMode.ABSOLUTE,
        order: (parsed.order as StackOrder) || StackOrder.DATASET,
        notation: parsed.notation === "scenario" ? "scenario" : "none",
        legend: ["right", "both", "none"].includes(parsed.legend) ? parsed.legend : "left",
        percentMark: parsed.percentMark === true,
      };
    } catch {
      this.errors.remove("WARN_stack_dimensions_scenarios");
      this.errors.remove("WARN_stack_scenarios_max");
      return null;
    }
  }

  /**
   * The first row of absolute variances: the candidates for the bridge between
   * the totals, and the sentiment of the variances the base chart draws at its totals.
   */
  private prepareBridgeVariances(): string[] {
    const isAbsolute = (name: string): boolean => {
      const parsed = new VarianceScenario(name);
      return parsed.isValid && parsed.type !== "dr";
    };
    return this.prepareSegments().find((row) => row.length > 0 && isAbsolute(row[0])) ?? [];
  }

  private prepareLineFullWidth(): boolean {
    return this.lineFullWidth;
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

  chartTemplate(segmentVariances: string[], idx: number) {
    const preparedI18n: Map<string, string> = this.prepareI18n();
    const preparedStyle: TimeChartStyle = this.prepareStyle();
    const fullParentWidth = getParentDimensions(this.element).width;
    const ppu = this.preparePixelPerUnit();
    const ppp = this.preparePixelPerPercentage();
    const stackConfig = this.prepareStackConfig();
    const isBase = segmentVariances.length === 0;
    const scenarios = this.hidesScenarios() ? variancesScenarios(segmentVariances) : this.prepareScenarios();
    // only the base chart draws a stack, a variance needs both of its scenarios
    const effectiveScenarios =
      isBase && stackConfig?.by === StackBy.DIMENSIONS && !this.scenarioSwitch ? scenarios.slice(0, 1) : scenarios;

    return (
      <bn-chart-time-renderer
        tableName={this.datasetName}
        dataVersion={this.dataVersion}
        chartTitle={this.prepareChartTitle(idx)}
        scenarios={effectiveScenarios}
        variances={segmentVariances.length > 0 ? segmentVariances : [""]}
        hideAxisLabels={this.prepareHideAxisLabels(idx)}
        pixelPerUnit={ppu}
        pixelPerPercentage={ppp}
        reportAutoScaling={this.handleAutoScalingReport}
        errors={this.errors}
        leftSideOffsetForHorizontalSync={this.prepareLeftSideOffset(preparedI18n, preparedStyle)}
        styles={preparedStyle}
        i18n={preparedI18n}
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
        dataFormatDigits={{
          percent: this.dataFormatDigitsPercent,
          decimal: this.dataFormatDigitsDecimal,
          percentSign: this.dataFormatPercentSign !== false,
        }}
        axisLabelsStep={Math.max(1, Math.floor(Number(this.axisLabelsStep) || 1))}
        axisLabelsHide={this.prepareAxisLabelsHide()}
        rowsAbove={isBase && this.prepareSegments().length > 1}
        periodLines={Math.max(0, Math.floor(Number(this.periodLines) || 0))}
        pointPosition={this.pointPosition === "end" ? "end" : "center"}
        scalingIndicator={Number(this.scalingIndicator) || 0}
        totals={this.prepareTotals()}
        scenarioSwitch={this.scenarioSwitch}
        varianceWaterfall={this.varianceWaterfall === true}
        bridgeVariances={this.prepareBridgeVariances()}
        referenceColumn={this.referenceColumn === true}
        syncedLeft={this.syncSpaceLeft > -1}
        axisTitlePosition={this.prepareAxisTitlePosition(idx)}
        reportUnit={idx === 0 && this.titleIsTop() ? this.handleUnitReport : undefined}
        containerWidth={fullParentWidth}
        parentDimensions={this.prepareDimension(isBase)}
        ruleSetConfig={this.ruleSetConfig()}
      ></bn-chart-time-renderer>
    );
  }

  /**
   * The line this chart wants to be aligned on, in CSS px from the host's
   * top-left corner. A horizontal axis line gives `y` and its left end `x`. The category axis of the base segment sits at zero, so negative bars hang below it. Empty before the chart has drawn.
   */
  @Method()
  async getBaseline(): Promise<Baseline> {
    return readChartBaseline(this.element, "bn-chart-time-renderer");
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
      "bn-chart-time-renderer",
      this.prepareSegments().map((segment) => (segment.length > 0 ? segment.join(",") : "base")),
      origins,
      detail,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstInner = this.element.shadowRoot?.querySelector("bn-chart-time-renderer") as any;

    const state: ComponentLayoutState = {
      version: LAYOUT_STATE_VERSION,
      tag: this.element.localName,
      id: resolveStandaloneId(this.element),
      slot: this.element.getAttribute("slot") ?? undefined,
      rect: measure(this.element, origins),
      em: {
        fontSizePx,
        appliedScaleFactor: factor,
        scaleMode: parseScaling(this.scale).mode === "factor" ? "fixed" : "auto",
      },
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
      baseline: layout.baseline,
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
    this.checkVarianceScenarios(this.prepareVariances());
    const segments = this.prepareSegments();
    if (segments.length === 0) {
      this.errors.addOrReplace({
        id: "WARN_scenarios_none",
        type: "warning",
        message: "scenarios: none needs at least one variance, the chart is empty.",
      });
    } else {
      this.errors.remove("WARN_scenarios_none");
    }

    const fontStyles = this.getFontStyles();

    return (
      <Host style={fontStyles}>
        {this.renderTitleTop()}
        <div class="container">{segments.map(this.chartTemplate)}</div>
      </Host>
    );
  }
}
