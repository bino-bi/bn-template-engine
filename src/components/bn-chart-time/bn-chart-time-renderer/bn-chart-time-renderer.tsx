import { Component, Element, h, Host, Prop } from "@stencil/core";
import { TimeChart } from "../utils/TimeChart";
import { CustomPattern } from "../utils/helper";

import {
  StackConfigParsed,
  TimeChartComponentConfig,
  TimeChartComponentConfigAdapter,
} from "../utils/model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "../utils/model/TimeChartDataRow";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
import { TimeChartStyle, TimeChartStylesAdapter } from "../utils/model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "../utils/model/styles/ScaleFactorsTimeChart";
import { DateDistance } from "../../../utils/DateStringFactory";
import { AxisLabelsMode, ChartMode } from "../../../utils/constants";
import { ParentDimensions } from "../../../utils/parentDimensions";
import { AutoScalingReport } from "../../../utils/scaling";
import { MIN_PIXEL_SCALE, solveAutoFitStep } from "../../../utils/autoFit";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import withComponentStatus from "../../../utils/withComponentStatus";
import { ErrorDispatcher } from "../../../utils/withHasError";
import { errorText, reportQueryError } from "../../../utils/queryError";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";

/** @internal */
@Component({
  tag: "bn-chart-time-renderer",
  styleUrl: "bn-chart-time-renderer.scss",
  shadow: true,
})
export class BnChartTimeRenderer {
  @Element() element!: HTMLElement;

  /**
   * Name of the dataset (table or view in the shared alasql database).
   * @internal
   */
  @Prop() tableName: string = "";

  /**
   * Bumped by `bn-chart-time` when the dataset changes; triggers re-render.
   * @internal
   */
  @Prop() dataVersion: number = 0;

  /** @internal */
  @Prop() chartTitle?: string; // title cannot be used, is reserved

  /** @internal */
  @Prop() scenarios: string[] = [];

  /** @internal */
  @Prop() variances: string[] = []; //["dfc_ac_neg"]

  /** @internal */
  @Prop() hideAxisLabels: boolean = false; //false

  /** @internal */
  @Prop() pixelPerUnit: number = 2; //2

  /** @internal */
  @Prop() pixelPerPercentage: number = 50; //2

  /**
   * Internal wrapper channel: called with the auto-fitted values (px for one
   * data unit / px per 1.0 fraction) whenever one of them was auto-resolved, so
   * the outer `bn-chart-time` can surface them in its AUTO_* warnings.
   * Not for end users.
   * @internal
   */
  @Prop() reportAutoScaling?: (report: AutoScalingReport) => void;

  /**
   * The wrapper's error dispatcher: a failed query is reported through it as `ERR_sql`. Not for end users.
   * @internal
   */
  @Prop() errors?: ErrorDispatcher;

  /** @internal */
  @Prop() leftSideOffsetForHorizontalSync: number = -1;
  /** @internal */
  @Prop({ mutable: true })
  @Prop()
  styles: TimeChartStyle | undefined;

  /** @internal */
  @Prop({ mutable: true })
  i18n: Map<string, string> = new Map(); //  I18nMode;

  /** @internal */
  @Prop()
  dateInterval: DateDistance = DateDistance.AUTO;

  /** @internal */
  @Prop()
  intervalSpanLimit: number = 28;

  /** @internal */
  @Prop()
  axisLabelsMode: AxisLabelsMode = AxisLabelsMode.SMART;

  /** @internal */
  @Prop()
  filter: string = "";

  /** @internal */
  @Prop()
  measureScale: string = "_";

  /** @internal */
  @Prop()
  measureUnit: string = "";

  /** @internal */
  @Prop()
  showMeasureScale: boolean = true;

  /** @internal */
  @Prop() showOverlayMedian: boolean = false;
  /** @internal */
  @Prop() showOverlayAvg: boolean = false;

  /** @internal */
  @Prop()
  chartMode: ChartMode = ChartMode.BAR;

  /** @internal */
  @Prop()
  maxBars: number = 28;

  /** @internal */
  @Prop()
  stackConfig: StackConfigParsed | null = null;

  /** @internal */
  @Prop()
  lineFullWidth: boolean = true;

  /** @internal */
  @Prop()
  containerWidth: number = 0;

  /** @internal */
  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  /** @internal */
  @Prop()
  axisLabelsStep: number = 1;

  /** @internal */
  @Prop()
  scenarioSwitch: boolean = false;

  /** @internal */
  @Prop()
  axisTitlePosition: string = "left";

  /** @internal */
  @Prop()
  parentDimensions: ParentDimensions = { width: 0, height: 0 };

  /** @internal */
  @Prop()
  ruleSetConfig?: RuleSetConfig;

  drawElement: SVGElement | undefined;
  patternElement: HTMLSpanElement | undefined;

  private chart: TimeChart | undefined;
  private pattern: CustomPattern | undefined;
  private stores: ScopedStores | undefined;
  private measureScaleError: string | undefined;
  private queryError: string | undefined;
  private overlapErrId: `WARN_${string}` | undefined;

  disconnectedCallback() {
    if (this.overlapErrId) {
      this.errors?.remove(this.overlapErrId);
      this.overlapErrId = undefined;
    }
  }

  constructor() {
    withComponentStatus(this);
  }

  private getDb() {
    if (!this.stores) this.stores = getStores(this.element);
    return this.stores.db.db;
  }

  render() {
    if (this.chart === undefined || this.queryError !== undefined) {
      return <Host />;
    }

    if (this.chart.hasNoData()) {
      const errorMsg: string = this.i18n.get("no-data") ?? "No Data";
      return (
        <Host class="no-data">
          <div class="empty-state">{errorMsg}</div>
        </Host>
      );
    }

    return (
      <Host>
        {/* overflow: an SVG without a size is 300px wide and would count as chart content */}
        <div
          innerHTML={this.pattern?.toString()}
          class="hidePatternContainer"
          style={{ width: "0", height: "0", overflow: "hidden" }}
        />

        <div class={this.showMeasureScale ? "footer" : "footer-hide"}>{this.chart?.getFooter()}</div>
        {/* <svg ref={(el) => this.drawElement = el} id="drawCanvas" width={this.chart?.getAllocatedCanvasWidth()}
          height={this.chart?.getAllocatedCanvasHeight()}></svg> */}
        <div innerHTML={this.chart?.toString()}></div>
      </Host>
    );
  }

  /** Reports a failed query as the wrapper's `ERR_sql` item. Without it the chart would only show "No Data". */
  private syncQueryError(): void {
    this.queryError = this.measureScaleError ?? this.chart?.getQueryError();
    reportQueryError(this.errors, this.queryError);

    const ignored = this.chart?.getIgnoredSwitchScenarios() ?? [];
    if (ignored.length > 0) {
      this.errors?.addOrReplace({
        id: "WARN_stack_switch_ignored",
        type: "warning",
        message: `stack by dimensions with scenarioSwitch: ${ignored.join(", ")} is not drawn. A scenario continues the first one only where the first one has no value, and only in bar mode.`,
      });
    } else {
      this.errors?.remove("WARN_stack_switch_ignored");
    }

    const errId = `WARN_variances_overlap_${this.variances.join("_")}` as const;
    const overlaps = this.chart?.getVarianceOverlaps() ?? 0;
    // the row can get other variances: the warning of the old list has to go
    if (this.overlapErrId && this.overlapErrId !== errId) {
      this.errors?.remove(this.overlapErrId);
    }
    this.overlapErrId = overlaps > 0 ? errId : undefined;
    if (overlaps > 0) {
      this.errors?.addOrReplace({
        id: errId,
        type: "warning",
        message: `scenarioSwitch: the variances ${this.variances.join(", ")} share a row, but ${overlaps} period(s) have more than one value. The first variance wins there.`,
      });
    } else {
      this.errors?.remove(errId);
    }
  }

  public async componentWillLoad() {
    const config: TimeChartComponentConfig = this.prepareConfig();
    const styles: TimeChartStyle = this.prepareStyle();
    const availableWidth = this.containerWidth || 0;

    this.chart = new TimeChart(
      new IBCSRuleSet(this.ruleSetConfig),
      this.getDb(),
      this.tableName,
      config,
      styles,
      availableWidth,
    );
    this.chart.setI18n(this.i18n);
    // The broken-bar overdrive exists to absorb MANUAL scaling overflow.
    // autoFitScaling mutates config.pixelPerUnit to the solved value, so
    // remember auto mode beforehand and skip the overdrive for it - the
    // fitted chart fits by construction, and the overdrive's rough overhead
    // estimate would falsely re-engage on it.
    const unitWasAuto = config.pixelPerUnit <= 0;
    const percentWasAuto = config.pixelPerPercentage <= 0;
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(unitWasAuto ? 0 : this.parentDimensions?.height || 0);
    if (!percentWasAuto) {
      this.chart.fitRelativeVariances(this.parentDimensions?.height || 0);
    }
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("hatched", this.pattern.getFCPolygonPattern());
    this.syncQueryError();
  }

  public async componentWillUpdate() {
    if (this.chart == null) {
      return;
    }

    const config: TimeChartComponentConfig = this.prepareConfig();
    const styles: TimeChartStyle = this.prepareStyle();

    this.chart.setI18n(this.i18n);
    this.chart.setStyles(styles);
    this.chart.setAvailableWidth(this.containerWidth || 0);
    this.chart.setRuleSet(new IBCSRuleSet(this.ruleSetConfig));
    this.chart.setConfig(config);
    // See componentWillLoad: no broken-bar overdrive for auto-fitted scaling
    const unitWasAuto = config.pixelPerUnit <= 0;
    const percentWasAuto = config.pixelPerPercentage <= 0;
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(unitWasAuto ? 0 : this.parentDimensions?.height || 0);
    if (!percentWasAuto) {
      this.chart.fitRelativeVariances(this.parentDimensions?.height || 0);
    }
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("hatched", this.pattern.getFCPolygonPattern());
    this.syncQueryError();
  }

  /**
   * Auto-fit for pixelPerUnit and/or pixelPerPercentage (0 = auto mode).
   * Time charts grow vertically, so we fit to height.
   *
   * The chart height is affine in the pixel scales (height = fixed labels +
   * column extent × scale), but label allocations shift between passes, so a
   * single analytic solve is not enough: measure at 1, solve, then verify
   * against fresh measurements and re-solve until the chart fits. The loop
   * never ends on an overshoot - the last fitting values are restored, or
   * when even the minimum scale cannot fit (labels alone exceed the
   * container) the values are floored and the wrapper reports the overflow.
   * Explicit (> 0) values are never overridden.
   */
  private autoFitScaling(config: TimeChartComponentConfig, styles: TimeChartStyle): void {
    const autoUnit = config.pixelPerUnit <= 0;
    const autoPercent = config.pixelPerPercentage <= 0;

    if (!autoUnit && !autoPercent) {
      return; // Both explicit - nothing to auto-fit
    }

    const reportResolved = () => {
      this.reportAutoScaling?.({
        unit: autoUnit ? config.pixelPerUnit : undefined,
        percentage: autoPercent ? config.pixelPerPercentage : undefined,
      });
    };

    const targetHeight = this.parentDimensions?.height;
    const availableWidth = this.containerWidth || 0;
    const rebuild = () => {
      this.chart = new TimeChart(
        new IBCSRuleSet(this.ruleSetConfig),
        this.getDb(),
        this.tableName,
        config,
        styles,
        availableWidth,
      );
      this.chart.setI18n(this.i18n);
    };
    // layout() runs draw(), which finalizes positions - an undrawn chart
    // reports a stale allocated height.
    const measure = () => {
      this.chart.layout();
      return this.chart.getAllocatedCanvasHeight();
    };

    if (!targetHeight || targetHeight <= 0) {
      if (autoUnit) config.pixelPerUnit = 1;
      if (autoPercent) config.pixelPerPercentage = 50;
      rebuild();
      reportResolved();
      return;
    }

    // Measurement pass: render the auto quantities at 1
    if (autoUnit) config.pixelPerUnit = 1;
    if (autoPercent) config.pixelPerPercentage = 1;
    rebuild();
    let height = measure();

    if (height <= 0) {
      reportResolved();
      return;
    }

    // Fallback for auto quantities nothing scales with (no column extent):
    // plain ratio against the measurement pass, as before.
    const ratioFallback = Math.max(MIN_PIXEL_SCALE, (targetHeight * 0.9) / height);
    const EPS = 0.5;
    const MAX_CORRECTIONS = 3;
    let solvedUnit = false;
    let solvedPercent = false;
    let fitting: { ppu: number; ppp: number } | null = null;

    for (let iteration = 0; iteration <= MAX_CORRECTIONS; iteration++) {
      const step = solveAutoFitStep({
        target: targetHeight,
        measured: height,
        unitExtent: autoUnit ? this.chart.getUnitBarExtent() : 0,
        pctExtent: autoPercent ? this.chart.getPercentBarExtent() : 0,
        currentPpu: config.pixelPerUnit,
        currentPpp: config.pixelPerPercentage,
      });
      if (step.ppu === undefined && step.ppp === undefined) {
        break; // nothing scales with the auto values - fallback below
      }
      if (autoUnit && step.ppu !== undefined) {
        config.pixelPerUnit = step.ppu;
        solvedUnit = true;
      }
      if (autoPercent && step.ppp !== undefined) {
        config.pixelPerPercentage = step.ppp;
        solvedPercent = true;
      }
      rebuild();
      height = measure();
      if (height <= targetHeight + EPS) {
        fitting = { ppu: config.pixelPerUnit, ppp: config.pixelPerPercentage };
        if (height >= targetHeight * 0.98) {
          break; // fits and tight - done
        }
        // else the label allocation left slack - loop once more to grow into it
      }
    }

    // Auto quantities the solver never touched get the ratio fallback
    let needsRebuild = false;
    if (autoUnit && !solvedUnit) {
      config.pixelPerUnit = ratioFallback;
      needsRebuild = true;
    }
    if (autoPercent && !solvedPercent) {
      config.pixelPerPercentage = ratioFallback;
      needsRebuild = true;
    }

    // Never end on an overshoot
    if (height > targetHeight + EPS) {
      if (fitting) {
        // Restore the last values that fit (fallback quantities have no extent)
        if (solvedUnit) config.pixelPerUnit = fitting.ppu;
        if (solvedPercent) config.pixelPerPercentage = fitting.ppp;
      } else {
        // Even the solved minimum overshoots (labels alone exceed the
        // container) - shrink proportionally; the wrapper reports this.
        const shrink = targetHeight / height;
        if (autoUnit) config.pixelPerUnit = Math.max(MIN_PIXEL_SCALE, config.pixelPerUnit * shrink);
        if (autoPercent) config.pixelPerPercentage = Math.max(MIN_PIXEL_SCALE, config.pixelPerPercentage * shrink);
      }
      needsRebuild = true;
    }

    if (needsRebuild) {
      rebuild();
    }

    reportResolved();
  }

  public async componentWillRender() {
    // return await (async () => {
    //   // console.log("componentWillRender", this.chart);
    //   if (this.chart) {
    //     // this.chart.draw(SVG(this.drawElement) as Svg);
    //   }
    // })()
  }

  componentDidLoad() {
    // if (this.chart == null) {
    //   return;
    // }
    // this.chart.draw(SVG(this.drawElement) as Svg);
    // forceUpdate(getElement(this));
  }

  componentDidUpdate() {
    //if (this.chart) {
    //  this.chart.draw(SVG(this.drawElement) as Svg);
    //}
  }

  private prepareConfig(): TimeChartComponentConfig {
    const db = this.getDb();
    const fromExpr = sourceExpr(db, this.tableName, this.filter);
    this.measureScaleError = undefined;
    return new TimeChartComponentConfigAdapter(
      new TimeChartDataRowAdapter(),
      new StringAdapter(),
      new DataFormatDigitsAdapter(),
      db,
      fromExpr,
      (e) => {
        this.measureScaleError = errorText(e);
      },
    ).adapt({
      scenarios: this.scenarios,
      variances: this.variances,
      title: this.chartTitle,
      hideAxisLabels: this.hideAxisLabels,
      pixelPerUnit: this.pixelPerUnit,
      pixelPerPercentage: this.pixelPerPercentage,
      dateInterval: this.dateInterval,
      axisLabelsMode: this.axisLabelsMode,
      leftSideOffsetForHorizontalSync: this.leftSideOffsetForHorizontalSync,
      intervalSpanLimit: this.intervalSpanLimit,
      filter: this.filter,
      measureScale: this.measureScale,
      measureUnit: this.measureUnit,
      showMeasureScale: this.showMeasureScale,
      dataFormatDigits: this.dataFormatDigits,
      showOverlayMedian: this.showOverlayMedian,
      showOverlayAvg: this.showOverlayAvg,
      chartMode: this.chartMode,
      maxBars: this.maxBars,
      stackConfig: this.stackConfig,
      lineFullWidth: this.lineFullWidth,
      axisLabelsStep: this.axisLabelsStep,
      scenarioSwitch: this.scenarioSwitch,
      axisTitlePosition: this.axisTitlePosition,
      locale: this.stores?.context?.state?.locale || "de",
    });
  }

  private prepareStyle(): TimeChartStyle {
    const styles = new TimeChartStylesAdapter(
      new ScaleFactorsTimeChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
    styles.locale = getStores(this.element).context?.state?.locale || "de";

    return styles;
  }
}
