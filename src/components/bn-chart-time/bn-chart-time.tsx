import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
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
  validateVariancesList
} from "../../utils/validate";


import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import withTranslation from "../../utils/withTranslation";
import { globalLabelKeys } from "../../stores/internationalization";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { getParentDimensions, ParentDimensions } from "../../utils/parentDimensions";
import { parseScaling } from "../../utils/scaling";
import { DatasetMeta } from "../../utils/model/DatasetMeta";
import { TimeChartDataRow, TimeChartStyle } from "./utils/model";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import { Formatter } from "../../utils/formatter";
import { AxisLabelsMode, ChartMode, StackBy, StackMode, StackOrder } from "../../utils/constants";
import { StackConfigParsed } from "./utils/model/TimeChartComponentConfig";
import { DateDistance } from "../../utils/DateStringFactory";

enum AggregationLevel {
  ROWGROUP = "rowGroup",
  ROWGROUPINDEX = "rowGroupIndex",
  CATEGORY = "category",
  CATEGORYINDEX = "categoryIndex",
  SUBCATEGORY = "subCategory",
  SUBCATEGORYINDEX = "subCategoryIndex",
}

@Component({
  tag: 'bn-chart-time',
  styleUrl: "bn-chart-time.scss",
  shadow: true
})
export class Chart {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  @State() data: TimeChartDataRow[] = []
  @State() private datasetMeta: DatasetMeta | null = null;
  @State() private appliedScaleFactor: number = 1;

  private readonly t: (key: string, data?: object) => string;
  private readonly componentStyle: <T, >(q: (Style) => T) => T;
  private readonly errors: ErrorDispatcher;

  /**
   * Custom chart title
   */
  @Prop()
  chartTitle: string = "";


  @Prop()
  filter: string = "";


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
  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    const errId: string = 'ERR_scenarios';

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'scenarios: invalid value(s) \'' + JSON.stringify(invalidScenarios) + '\' are not supported.' });
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

  @Watch('variances')
  validateVariances(newValue: string) {

    const errIdVar: string = 'ERR_variances';
    let invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({
        id: errIdVar,
        type: 'warning',
        message: 'variances: invalid value(s) \'' + JSON.stringify(invalidVariances) + '\' are not supported.'
      });
    } else {
      this.errors.remove(errIdVar);
    }
  }

  @Prop() syncSpaceLeft: number = -1;

  @Watch('syncSpaceLeft')
  validateLeftSync(newValue: string | number) {
    const errId: string = 'ERR_syncSpaceLeft';

    if (!isValidNumber(newValue as number)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'syncSpaceLeft: invalid value(s) \'' + newValue + '\' are not supported.'
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

  @Watch('limit')
  validateLimit(newValue: number) {
    const errId: string = 'ERR_limit';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'limit: invalid value \'' + newValue?.toString() + '\' is not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Name of the 'scaling-group' which the chart uses
   * scalig groups are maintained globaly
   * <br /> <br />
   * alternativly a number which represent the
   * pixel per measure unit.
   */
  @Prop() unitScaling!: string | number;

  @Watch('unitScaling')
  validateUnitScaling(newValue: string | number) {
    const errId: string = 'ERR_unitScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'unitScaling: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Name of the 'scaling-group' which the chart uses
   * scalig groups are maintained globaly
   * <br /> <br />
   * alternativly a number which represent the
   * pixel per percentage.
   */
  @Prop() percentageScaling!: string | number;

  @Watch('percentageScaling')
  validatePercentageScaling(newValue: string | number) {
    const errId: string = 'ERR_percentageScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'percentageScaling: invalid value(s) \'' + newValue + '\' are not supported.'
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

  @Watch('level')
  validateLevel(newValue: string) {
    const errId: string = 'ERR_level';

    if (!isValidLevel(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'level: invalid value(s) \'' + newValue + '\' are not supported.'
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

  @Watch('order')
  validateOrderList(newValue: string) {
    const errId: string = 'ERR_order';
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'order: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.'
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

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    const errId: string = 'ERR_orderDirection';

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.'
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



  @Watch('dateInterval')
  validateDateInterval(newValue: string) {
    const errId: string = 'ERR_dateInterval';

    if (!isValidDateFormat(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'dateInterval: invalid value \'' + newValue?.toString() + '\' is not supported.'
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

  @Watch('chartMode')
  validateChartMode(newValue: string) {
    const errId: string = 'ERR_chartMode';
    const validModes = ['bar', 'line', 'auto'];

    if (!validModes.includes(newValue?.toLowerCase())) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'chartMode: invalid value \'' + newValue?.toString() + '\' is not supported. Valid values are: bar, line, auto.'
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

  @Watch('maxBars')
  validateMaxBars(newValue: number) {
    const errId: string = 'ERR_maxBars';

    if (!isValidInteger(newValue) || newValue < 1) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'maxBars: invalid value \'' + newValue?.toString() + '\' is not supported. Must be a positive integer.'
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
   *   - `"scenario"` — stack the scenarios from the `scenarios` prop as layers.
   *   - `"category"` / `"subcategory"` / `"rowgroup"` — decompose a single
   *     scenario by this data dimension. Must be finer than `level`.
   * - `mode` (optional, default `"absolute"`):
   *   - `"absolute"` — additive stacking, axis shows absolute units.
   *   - `"relative"` — 100% stacking, axis shows 0%–100%.
   *   - `"absolute-relative"` — bar height is absolute (real value), but
   *     segment labels inside show percentages.
   * - `order` (optional, default `"dataset"`): Segment order within each stack.
   *   `"asc"` / `"desc"` sort segments by value; `"dataset"` preserves the
   *   original data/scenario order.
   *
   * @default '' (empty — no stacking)
   *
   * @example
   * // Stack scenarios
   * stack='{"by":"scenario"}'
   *
   * @example
   * // Stack by category, relative mode
   * stack='{"by":"category","mode":"relative"}'
   */
  @Prop() stack: string = '';

  @Watch('stack')
  validateStack(newValue: string) {
    const errId: string = 'ERR_stack';
    const errors = validateStackConfig(newValue);

    if (errors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: errors.join('; ')
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
   * | `"0.5"`, `"1.2"`, … | Fixed factor — apply `baseFontSize × factor`                                      |
   */
  @Prop() scale?: string;

  @Watch('scale')
  validateScaling(newValue: string) {
    if (newValue == null || newValue === '' || newValue === 'none' || newValue === 'auto') {
      this.errors.remove('ERR_scale');
      return;
    }
    const num = Number(newValue);
    if (isNaN(num) || num <= 0) {
      this.errors.addOrReplace({ id: 'ERR_scale', type: 'warning', message: `Invalid scale value: "${newValue}". Use "none", "auto", or a positive number.` });
    } else {
      this.errors.remove('ERR_scale');
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

  @Watch('axisLabelsMode')
  validateAxisLabelsMode(newValue: string) {
    const errId: string = 'ERR_axisLabelsMode';

    if (!isValidAxisLabelsMode(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'axisLabelsMode: invalid value \'' + newValue?.toString() + '\' is not supported.'
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
  @Prop() lineFullWidth: string = 'true';

  @Watch('lineFullWidth')
  validateLineFullWidth(newValue: string) {
    const errId: string = 'ERR_lineFullWidth';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'lineFullWidth: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  @Prop() showCategories: string = 'true';

  @Watch('showCategories')
  validateShowCategories(newValue: string) {
    const errId: string = 'ERR_showCategories';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showCategories: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


  /**
 *  Sets the SiPrefix of the Mesaurements and converts the
 *  original value.
 *  <br /><br />
 *  values:  <br />
 *  ```_ // k // M // G // T // P // E // Z // Y // m // μ // n // p // P // f // a // z // y // GREATEST // LEAST```
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
 *  ```    "μ":  0.000001,```<br />
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

  @Watch('measureScale')
  validateMeasureScale(newValue: string) {
    const errId: string = 'ERR_measureScale';

    if (!isValidMeasureScale(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'measureScale: invalid value \'' + newValue?.toString() + '\' is not supported.' });
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
  @Prop() showMeasureScale: string = 'false';

  @Watch('showMeasureScale')
  validateShowMeasureScale(newValue: string) {
    const errId: string = 'ERR_grouped';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showMeasureScale: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


  @Prop() showOverlayAvg: string = 'true';
  @Watch('showOverlayAvg')
  validateShowOverlayAvg(newValue: string) {
    const errId: string = 'ERR_grouped';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showOverlayAvg: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  @Prop() showOverlayMedian: string = 'false';
  @Watch('showOverlayMedian')
  validateShowOverlayMedian(newValue: string) {
    const errId: string = 'ERR_grouped';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showOverlayMedian: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
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
    withDataset(this, (_name, data) => {
      this.data = data || [];
    }, (_name, meta) => {
      this.datasetMeta = meta;
    });
    this.chartTemplate = this.chartTemplate.bind(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
    this.t = withTranslation(this).t;

  }


  componentWillLoad() {
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

  private _autoScaleIterations = 0;
  private static readonly MAX_SCALE_ITERATIONS = 3;

  componentDidRender() {
    const { mode } = parseScaling(this.scale);

    if (mode !== 'auto' && mode !== 'empty') {
      this._autoScaleIterations = 0;
      // Keep existing width-based overflow warning for non-auto modes
      const parent = getParentDimensions(this.element);
      const errId = 'WARN_overflow';
      if (parent.width > 0 && this.element.scrollWidth > parent.width + 1) {
        this.errors.addOrReplace({
          id: errId,
          type: 'warning',
          message: 'Chart exceeds available space and will be cut off. Check unit-scaling value.'
        });
      } else {
        this.errors.remove(errId);
      }
      return;
    }

    const host = this.element;
    const { width: parentWidth } = getParentDimensions(host);
    if (parentWidth <= 0) return;

    const div = host.shadowRoot?.querySelector('.container');
    const currentWidth = div?.scrollWidth ?? host.scrollWidth;
    const baseFontSize = this.componentStyle($ => $["global"]?.["fontSizePx"] || 13.3333);

    // Content fits — no scaling needed (or current scale is sufficient)
    if (currentWidth <= parentWidth + 1) {
      this._autoScaleIterations = 0;
      this.errors.remove('AUTO_scale');
      // If previously scaled but content now fits at base, reset to 1
      if (this.appliedScaleFactor !== 1) {
        // Try resetting — if that overflows, the next didRender will re-scale
        this._autoScaleIterations = 1;
        this.appliedScaleFactor = 1;
        host.style.setProperty('--bn-font-size', `${baseFontSize}px`);
      }
      return;
    }

    // Prevent infinite loop
    if (this._autoScaleIterations >= Chart.MAX_SCALE_ITERATIONS) {
      this._autoScaleIterations = 0;
      return;
    }

    // Content overflows — compute multiplicative correction
    const correction = (parentWidth - 1) / currentWidth;
    const newFactor = this.appliedScaleFactor * correction;

    host.style.setProperty('--bn-font-size', `${baseFontSize * newFactor}px`);

    if (mode === 'empty') {
      this.errors.addOrReplace({ id: 'AUTO_scale', type: 'warning', message: `Auto-scaled chart by factor ${newFactor.toFixed(3)}` });
    } else {
      this.errors.remove('AUTO_scale');
    }

    if (Math.abs(newFactor - this.appliedScaleFactor) > 0.001) {
      this._autoScaleIterations++;
      this.appliedScaleFactor = newFactor;
    } else {
      this._autoScaleIterations = 0;
    }
  }

  prepareDimension(): ParentDimensions {
    const parent = getParentDimensions(this.element);
    const scenariosList = this.prepareScenarios();
    const variancesList = this.prepareVariances();
    this.canvasWidthSegmented = parent.width / (scenariosList.length + variancesList.length || 1);
    return { width: this.canvasWidthSegmented, height: parent.height };
  }

  private prepareScenarios(): string[] {
    const isAuto = this.scenarios?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.scenarios) || isAuto) {
      if (this.datasetMeta?.availableScenarios?.length > 0) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_scenarios', type: 'warning',
            message: `scenarios: not set, auto-detected: ${this.datasetMeta.availableScenarios.join(',')}`
          });
        } else {
          this.errors.remove('AUTO_scenarios');
        }
        return this.datasetMeta.availableScenarios;
      }
      return [];
    }
    this.errors.remove('AUTO_scenarios');
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareAvg(): boolean {

    return this.showOverlayAvg == "true";
  }

  private prepareMedian(): boolean {

    return this.showOverlayMedian == "true";
  }

  private prepareVariances(): string[] {
    if (isBlankInput(this.variances)) {
      return [];
    }
    return this.variances?.split(",").map(entry => entry.trim());
  }


  private prepareHideAxisLabels(idx: number): boolean {
    return idx >= 1 || this.showCategories != "true";
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = [];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal = new Map(i18nMetaLabelsLocal.map(key => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }


  private preparePixelPerUnit(): number {
    if (this.pixelPerUnitGroupMap.has(this.unitScaling as string)) {
      this.errors.remove('AUTO_unitScaling');
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string);
    }

    // Explicit 'auto' → auto-calculate silently
    if ((this.unitScaling as string)?.toString().trim().toLowerCase() === 'auto') {
      this.errors.remove('AUTO_unitScaling');
      return 0;
    }

    const numeric = Number(this.unitScaling);
    if (!isNaN(numeric) && numeric > 0) {
      this.errors.remove('AUTO_unitScaling');
      return numeric;
    }

    // Not set / invalid → auto-calculate with warning
    this.errors.addOrReplace({
      id: 'AUTO_unitScaling',
      type: 'warning',
      message: `unit-scaling: not set, auto-calculated to fit available space.`
    });
    return 0;
  }

  private preparePixelPerPercentage(): number {
    if (this.pixelPerUnitGroupMap.has(this.percentageScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.percentageScaling as string); // TODO: check if this is correct '* 100' or not if global scaling groups are implemented (JHE)
    }

    return Number(this.percentageScaling) * 100;
  }

  private prepareLevel(): AggregationLevel {
    const isAuto = this.level?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.level) || isAuto) {
      if (this.datasetMeta?.suggestedLevel) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_level', type: 'warning',
            message: `level: not set, auto-detected: ${this.datasetMeta.suggestedLevel}`
          });
        } else {
          this.errors.remove('AUTO_level');
        }
        return AggregationLevel[this.datasetMeta.suggestedLevel.toUpperCase() as keyof typeof AggregationLevel];
      }
      return undefined;
    }
    this.errors.remove('AUTO_level');
    return AggregationLevel[this.level?.toUpperCase() as keyof typeof AggregationLevel];
  }

  private prepareOrder(): Order {
    const isLevelAuto = isBlankInput(this.level) || this.level?.trim().toLowerCase() === 'auto';
    let entryValue = isLevelAuto && this.datasetMeta?.suggestedLevel
      ? this.datasetMeta.suggestedLevel
      : this.level;

    const isOrderAuto = this.order?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.order) || isOrderAuto) {
      if (this.datasetMeta?.suggestedLevel) {
        if (!isOrderAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_order', type: 'warning',
            message: `order: not set, auto-detected: ${entryValue}`
          });
        } else {
          this.errors.remove('AUTO_order');
        }
      }
    } else {
      this.errors.remove('AUTO_order');
      if (this.order?.toLocaleLowerCase() === "levelindex") {
        entryValue += "Index";
      }
    }

    const tableOrder: Order = {
      hierarchy: [OrderColumn[entryValue?.toUpperCase() as keyof typeof OrderColumn]],
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }

  private prepareStyle(): TimeChartStyle {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle($ => {
      const baseFontSize = $["global"]['fontSizePx'];
      const scaledFontSize = baseFontSize * effectiveFactor;

      return {
        scaleFactors: {
          scenarioOffset: $["bn-chart-time"]['scaleFactors']['scenarioOffset'],
          scenarioLabelToColumn: $["bn-chart-time"]['scaleFactors']['scenarioLabelToColumn'],
          labelToColumn: 0.3,
          labelToColum: $["bn-chart-time"]['scaleFactors']['labelToColum'],
          labelToAxis: $["bn-chart-time"]['scaleFactors']['labelToAxis'],
          needleWidth: $["bn-chart-time"]['scaleFactors']['needleWidth'],
          needleHeadWidth: $["bn-chart-time"]['scaleFactors']['needleHeadWidth'],
          columnWidth: $["bn-chart-time"]['scaleFactors']['columnWidth'],
          varianceAxisLineWidth: $["bn-chart-time"]['scaleFactors']['varianceAxisLineWidth'],
          axisLineWidth: $["bn-chart-time"]['scaleFactors']['axisLineWidth'],
          auxiliaryLineWidth: $["bn-chart-time"]['scaleFactors']['auxiliaryLineWidth'],
          scenarioLineWidth: $["bn-chart-time"]['scaleFactors']['scenarioLineWidth'],
          markerWidth: $["bn-chart-time"]['scaleFactors']['markerWidth'],
          markerOffset: $["bn-chart-time"]['scaleFactors']['markerOffset'],
          categoryWidth: $["bn-chart-time"]['scaleFactors']['categoryWidth'],
          axisTickLength: $["bn-chart-time"]['scaleFactors']['axisTickLength'],
        },
        fontStyles: {
          font: `${scaledFontSize}px ${$["global"]['fontFamily']}`,
          size: scaledFontSize,
          color: $["global"]['fontColor'],
          background: $["global"]['fontBackgroundColor'],
          leading: 1.8,
        },
        axisStyles: $["bn-chart-time"]['axisStyles'],
        barStyles: $["bn-chart-time"]['barStyles'],
        varianceStyles: $["bn-chart-time"]['varianceStyles'],
        padding: $["bn-chart-time"]['padding'],
        pattern: null
      }
    });
  }

  private prepareLeftSideOffset(preparedI18n: Map<string, string>, preparedStyle: TimeChartStyle): number {


    if (this.syncSpaceLeft > -1) {
      return this.syncSpaceLeft;
    }

    let leftSideOffset: number = Formatter.getMaxWidthOfArrayItems([...this.prepareVariances(), ...this.prepareScenarios(), this.chartTitle], preparedI18n, preparedStyle);

    //if(leftSideOffset < this.syncSpaceLeft) {
    //  return this.syncSpaceLeft;
    //}

    return leftSideOffset;
  }

  private prepareChartTitle(idx: number): string {
    if (idx >= 1) {
      return '';
    }

    return this.chartTitle;
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareDateInterval(): DateDistance {
    const isAuto = this.dateInterval?.trim().toLowerCase() === 'auto';
    if (isBlankInput(this.dateInterval) || isAuto) {
      if (this.datasetMeta?.suggestedDateInterval) {
        if (!isAuto) {
          this.errors.addOrReplace({
            id: 'AUTO_dateInterval', type: 'warning',
            message: `dateInterval: not set, auto-detected: ${this.datasetMeta.suggestedDateInterval}`
          });
        } else {
          this.errors.remove('AUTO_dateInterval');
        }
        return DateDistance[this.datasetMeta.suggestedDateInterval.toUpperCase() as keyof typeof DateDistance];
      }
      return isAuto ? DateDistance.AUTO : undefined;
    }
    this.errors.remove('AUTO_dateInterval');
    return DateDistance[this.dateInterval?.toUpperCase() as keyof typeof DateDistance];
  }

  private prepareIntervalSpanLimit(): number {
    return this.intervalSpanLimit;
  }


  private prepareAxisLabelsMode(): AxisLabelsMode {
    return AxisLabelsMode[this.axisLabelsMode?.toUpperCase() as keyof typeof AxisLabelsMode];
  }


  private prepareFilter(): string {
    if (this.filter.length == 0) {
      return '';
    }

    return this.filter;
  }




  public getDataStructure(): any {
    let dataSetStructure: any = {
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
      }
    };

    return dataSetStructure;
  }

  private prepareMeasureScale(): string {
    if (isBlankInput(this.measureScale)) {
      return "GREATEST";
    }

    if (['_', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'm', 'μ', 'n', 'p', 'P', 'f', 'a', 'z', 'y'].includes(this.measureScale.trim())) {
      return this.measureScale.trim();
    }

    if (this.measureScale.trim().toUpperCase() === 'LEAST') {
      return this.measureScale.trim();
    }

    return "GREATEST";
  }

  prepareShowMeasureScale(idx: number): boolean {
    return idx == 0 && this.showMeasureScale == "true";
  }

  prepareMeasureUnit(): string {
    if (this.measureUnit == "" || this.measureUnit == null) {
      return "";
    }
    return this.measureUnit;
  }

  private prepareStackConfig(): StackConfigParsed | null {
    if (isBlankInput(this.stack)) {
      return null;
    }
    try {
      const parsed = JSON.parse(this.stack);
      return {
        by: parsed.by as StackBy,
        mode: (parsed.mode as StackMode) || StackMode.ABSOLUTE,
        order: (parsed.order as StackOrder) || StackOrder.DATASET,
      };
    } catch {
      return null;
    }
  }

  private prepareLineFullWidth(): boolean {
    return this.lineFullWidth === 'true';
  }

  private prepareChartMode(): ChartMode {
    const mode = this.chartMode?.toLowerCase();
    if (mode === 'line') {
      return ChartMode.LINE;
    } else if (mode === 'auto') {
      return ChartMode.AUTO;
    }
    return ChartMode.BAR;
  }

  private prepareMaxBars(): number {
    return Math.floor(Number(this.maxBars) || 28);
  }

  chartTemplate(localScenarioString: string, idx: number) {
    let preparedI18n: Map<string, string> = this.prepareI18n();
    let preparedStyle: TimeChartStyle = this.prepareStyle();
    const fullParentWidth = getParentDimensions(this.element).width;
    const effectiveFactor = this.getEffectiveScaleFactor();
    const ppu = this.preparePixelPerUnit();
    const ppp = this.preparePixelPerPercentage();

    return <ibcs-chart-time
      data={this.data}
      chartTitle={this.prepareChartTitle(idx)}
      scenarios={this.prepareScenarios()}
      variances={[localScenarioString]}
      hideAxisLabels={this.prepareHideAxisLabels(idx)}
      pixelPerUnit={ppu > 0 ? ppu * effectiveFactor : 0}
      pixelPerPercentage={ppp > 0 ? ppp * effectiveFactor : 0}
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
      stackConfig={this.prepareStackConfig()}
      lineFullWidth={this.prepareLineFullWidth()}
      containerWidth={fullParentWidth}
      parentDimensions={this.prepareDimension()}
    ></ibcs-chart-time>
  }


  private getEffectiveScaleFactor(): number {
    const { mode, factor } = parseScaling(this.scale);
    if (mode === 'factor') return factor!;
    if (mode === 'auto' || mode === 'empty') return this.appliedScaleFactor;
    return 1;
  }

  private getFontStyles(): { [key: string]: string } {
    const effectiveFactor = this.getEffectiveScaleFactor();
    return this.componentStyle($ => {
      const baseFontSize = $["global"]?.["fontSizePx"] || 13.3333;
      return {
        '--bn-font-family': $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
        '--bn-font-size': `${baseFontSize * effectiveFactor}px`,
        '--bn-font-color': $["global"]?.["fontColor"] || '#000000',
        '--bn-font-background': $["global"]?.["fontBackgroundColor"] || '#ffffff',
      };
    });
  }

  render() {
    let scenariosArray = [''];
    let variancesArray = this.prepareVariances();
    if (variancesArray.length > 0) {
      scenariosArray = [...scenariosArray, ...variancesArray];
    }

    const fontStyles = this.getFontStyles();

    return <Host style={fontStyles}>
      <div class="container">
        {scenariosArray.map(this.chartTemplate)}
      </div>
    </Host>
  }


}
