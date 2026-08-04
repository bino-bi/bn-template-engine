import { Component, Element, h, Host, Prop } from "@stencil/core";
import { TimeChart } from "./utils/TimeChart";
import { CustomPattern } from "./utils/helper";

import {
  StackConfigParsed,
  TimeChartComponentConfig,
  TimeChartComponentConfigAdapter,
} from "./utils/model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "./utils/model/TimeChartDataRow";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { buildFromExpr } from "../../context/scopedDb";
import { TimeChartStyle, TimeChartStylesAdapter } from "./utils/model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./utils/model/styles/ScaleFactorsTimeChart";
import { DateDistance } from "../../utils/DateStringFactory";
import { AggregationLevel, AxisLabelsMode, ChartMode } from "../../utils/constants";
import { ParentDimensions } from "../../utils/parentDimensions";
import { AutoScalingReport } from "../../utils/scaling";
import { MIN_PIXEL_SCALE, solveAutoFitStep } from "../../utils/autoFit";
import { StringAdapter } from "../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { OrderDirection, OrderAdapter, Order } from "../../utils/model/Order";
import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
import { SVGVariancesStyleGroupAdapter } from "../../utils/model/styles/SVGVariancesStyleGroup";

@Component({
  tag: "ibcs-chart-time",
  styleUrl: "ibcs-chart-time.scss",
  shadow: true,
})
export class IbcsChartTime {
  @Element() element!: HTMLElement;

  /** Name of the dataset (table or view in the shared alasql database). */
  @Prop() tableName: string = "";

  /** Bumped by `bn-chart-time` when the dataset changes; triggers re-render. */
  @Prop() dataVersion: number = 0;

  @Prop() chartTitle?: string; // title cannot be used, is reserved

  @Prop() scenarios: string[] = [];

  @Prop() variances: string[] = []; //["dfc_ac_neg"]

  @Prop() hideAxisLabels: boolean = false; //false

  @Prop() pixelPerUnit: number = 2; //2

  @Prop() pixelPerPercentage: number = 50; //2

  /**
   * Internal wrapper channel: called with the auto-fitted values (px for one
   * data unit / px per 1.0 fraction) whenever one of them was auto-resolved, so
   * the outer `bn-chart-time` can surface them in its AUTO_* warnings.
   * Not for end users.
   */
  @Prop() reportAutoScaling?: (report: AutoScalingReport) => void;

  @Prop() limit: number = 0;

  @Prop() leftSideOffsetForHorizontalSync: number = -1;
  @Prop({ mutable: true })
  @Prop()
  styles: TimeChartStyle | undefined;

  @Prop({ mutable: true })
  i18n: Map<string, string> = new Map(); //  I18nMode;

  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  @Prop()
  level: AggregationLevel = AggregationLevel.CATEGORY;

  @Prop()
  dateInterval: DateDistance = DateDistance.AUTO;

  @Prop()
  intervalSpanLimit: number = 28;

  @Prop()
  axisLabelsMode: AxisLabelsMode = AxisLabelsMode.SMART;

  @Prop()
  filter: string = "";

  @Prop()
  measureScale: string = "_";

  @Prop()
  measureUnit: string = "";

  @Prop()
  showMeasureScale: boolean = true;

  @Prop() showOverlayMedian: boolean = false;
  @Prop() showOverlayAvg: boolean = false;

  @Prop()
  chartMode: ChartMode = ChartMode.BAR;

  @Prop()
  maxBars: number = 28;

  @Prop()
  stackConfig: StackConfigParsed | null = null;

  @Prop()
  lineFullWidth: boolean = true;

  @Prop()
  containerWidth: number = 0;

  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  @Prop()
  parentDimensions: ParentDimensions = { width: 0, height: 0 };

  @Prop()
  ruleSetConfig?: RuleSetConfig;

  drawElement: SVGElement | undefined;
  patternElement: HTMLSpanElement | undefined;

  private chart: TimeChart | undefined;
  private pattern: CustomPattern | undefined;
  private stores: ScopedStores | undefined;

  constructor() {}

  private getDb() {
    if (!this.stores) this.stores = getStores(this.element);
    return this.stores.db.db;
  }

  render() {
    if (this.chart === undefined) {
      return <Host />;
    }

    if (this.chart.hasNoData()) {
      const errorMsg: string = this.i18n.get("no-data") || "==No Data==";
      return (
        <Host>
          <p class="warning">{errorMsg}</p>
        </Host>
      );
    }

    return (
      <Host>
        <div innerHTML={this.pattern?.toString()} class="hidePatternContainer" />

        <div class={this.showMeasureScale ? "footer" : "footer-hide"}>{this.chart?.getFooter()}</div>
        {/* <svg ref={(el) => this.drawElement = el} id="drawCanvas" width={this.chart?.getAllocatedCanvasWidth()}
          height={this.chart?.getAllocatedCanvasHeight()}></svg> */}
        <div innerHTML={this.chart?.toString()}></div>
      </Host>
    );
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
    // remember auto mode beforehand and skip the overdrive for it — the
    // fitted chart fits by construction, and the overdrive's rough overhead
    // estimate would falsely re-engage on it.
    const unitWasAuto = config.pixelPerUnit <= 0;
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(unitWasAuto ? 0 : this.parentDimensions?.height || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
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
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(unitWasAuto ? 0 : this.parentDimensions?.height || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
  }

  /**
   * Auto-fit for pixelPerUnit and/or pixelPerPercentage (0 = auto mode).
   * Time charts grow vertically, so we fit to height.
   *
   * The chart height is affine in the pixel scales (height = fixed labels +
   * column extent × scale), but label allocations shift between passes, so a
   * single analytic solve is not enough: measure at 1, solve, then verify
   * against fresh measurements and re-solve until the chart fits. The loop
   * never ends on an overshoot — the last fitting values are restored, or
   * when even the minimum scale cannot fit (labels alone exceed the
   * container) the values are floored and the wrapper reports the overflow.
   * Explicit (> 0) values are never overridden.
   */
  private autoFitScaling(config: TimeChartComponentConfig, styles: TimeChartStyle): void {
    const autoUnit = config.pixelPerUnit <= 0;
    const autoPercent = config.pixelPerPercentage <= 0;

    if (!autoUnit && !autoPercent) {
      return; // Both explicit — nothing to auto-fit
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
    // toString() runs draw(), which finalizes positions — an undrawn chart
    // reports a stale allocated height.
    const measure = () => {
      this.chart.toString();
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
        break; // nothing scales with the auto values — fallback below
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
          break; // fits and tight — done
        }
        // else the label allocation left slack — loop once more to grow into it
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
        // container) — shrink proportionally; the wrapper reports this.
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
    const fromExpr = this.tableName ? buildFromExpr(this.tableName, this.filter) : "";
    return new TimeChartComponentConfigAdapter(
      new TimeChartDataRowAdapter(),
      new OrderAdapter(new StringAdapter()),
      new StringAdapter(),
      new DataFormatDigitsAdapter(),
      db,
      fromExpr,
    ).adapt({
      scenarios: this.scenarios,
      variances: this.variances,
      title: this.chartTitle,
      hideAxisLabels: this.hideAxisLabels,
      pixelPerUnit: this.pixelPerUnit,
      pixelPerPercentage: this.pixelPerPercentage,
      level: this.level,
      dateInterval: this.dateInterval,
      axisLabelsMode: this.axisLabelsMode,
      limit: this.limit,
      sortOrder: this.order,
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
      locale: this.stores?.context?.state?.locale || "de",
    });
  }

  private prepareStyle(): TimeChartStyle {
    return new TimeChartStylesAdapter(
      new ScaleFactorsTimeChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
  }
}
