import { Component, Element, h, Host, Prop } from "@stencil/core";
import { StructureChart } from "./utils/StructureChart";
import { CustomPattern } from "./utils/helper";
import { StructureChartComponentConfig, StructureChartComponentConfigAdapter } from "./utils/model";
import { StackConfigParsed } from "./utils/model/StructureChartComponentConfig";
import { StructureChartDataRowAdapter } from "./utils/model";
import { ScaleFactorsStructureChartAdapter } from "./utils/model";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { buildFromExpr } from "../../context/scopedDb";
//import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
//import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
//import { SVGVariancesStyleGroupAdapter } from "../../utils/model/styles/SVGVariancesStyleGroup";
//import { PaddingAdapter } from "../../utils/model/styles/Padding";
//import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { StructureChartStylesAdapter, StructureChartStyle } from "./utils/model/styles/StructureChartStyle";
import { Order, OrderAdapter, OrderDirection } from "../../utils/model/Order";
import { AggregationLevel } from "../../utils/constants";
import { ParentDimensions } from "../../utils/parentDimensions";
import { AutoScalingReport } from "../../utils/scaling";
import { MIN_PIXEL_SCALE, solveAutoFitStep } from "../../utils/autoFit";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { StringAdapter } from "../../utils/helper/StringAdapter";
import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { PaddingAdapter } from "../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../utils/model/styles/SVGVariancesStyleGroup";
//import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
//import { DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";

@Component({
  tag: "ibcs-chart-structure",
  styleUrl: "bn-chart-structure.scss",
  shadow: true,
})
export class IbcsChartStructure {
  @Element() element!: HTMLElement;

  /** Name of the dataset (table or view in the shared alasql database). */
  @Prop() tableName: string = "";

  /** Bumped by `bn-chart-structure` when the dataset changes; triggers re-render. */
  @Prop() dataVersion: number = 0;

  @Prop() chartTitle: string = "";

  @Prop() scenarios: string[] = [];

  @Prop() variances: string[] = [];

  @Prop() hideCategories: boolean = false;

  @Prop() pixelPerUnit: number = 10;

  @Prop() pixelPerPercentage: number = 50;

  /**
   * Internal wrapper channel: called with the auto-fitted values (px for one
   * data unit / px per 1.0 fraction) whenever one of them was auto-resolved, so
   * the outer `bn-chart-structure` can surface them in its AUTO_* warnings.
   * Not for end users.
   */
  @Prop() reportAutoScaling?: (report: AutoScalingReport) => void;

  @Prop() limit: number = 0;

  @Prop({ mutable: true })
  @Prop()
  styles: StructureChartStyle | undefined;

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
  filter: string = "";

  @Prop()
  measureScale: string = "_";

  @Prop()
  measureUnit: string = "";

  @Prop()
  showMeasureScale: boolean = true;

  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  @Prop()
  stackConfig: StackConfigParsed | null = null;

  @Prop()
  parentDimensions: ParentDimensions = { width: 0, height: 0 };

  @Prop()
  ruleSetConfig?: RuleSetConfig;

  private chart: StructureChart | undefined;
  private pattern: CustomPattern | undefined;
  private stores: ScopedStores | undefined;

  constructor() {}

  private getDb() {
    if (!this.stores) this.stores = getStores(this.element);
    return this.stores.db.db;
  }

  public render() {
    if (this.chart === undefined) {
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
        {/*<div ref={(el) => this.patternElement = el} id="pattern" class="hidePatternContainer" /> */}
        <div innerHTML={this.pattern?.toString()} class="hidePatternContainer" />

        <div class={this.showMeasureScale ? "footer" : "footer-hide"}>{this.chart?.getFooter()}</div>
        {/* <svg ref={(el) => this.drawElement = el} id="drawCanvas" width={this.chart.getAllocatedCanvasWidth()} height={this.chart.getAllocatedCanvasHeight()} />*/}
        <div innerHTML={this.chart?.toString()}></div>
      </Host>
    );
  }

  public async componentWillLoad() {
    const db = this.getDb();
    const config: StructureChartComponentConfig = this.prepareConfig();
    const styles: StructureChartStyle = this.prepareStyle();

    this.chart = new StructureChart(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config, styles);
    this.chart.setI18n(this.i18n);
    // The broken-bar overdrive exists to absorb MANUAL scaling overflow.
    // autoFitScaling mutates config.pixelPerUnit to the solved value, so
    // remember auto mode beforehand and skip the overdrive for it — the
    // fitted chart fits by construction, and the overdrive's rough overhead
    // estimate would falsely re-engage on it.
    const unitWasAuto = config.pixelPerUnit <= 0;
    this.autoFitScaling(config, styles);
    this.chart.setAvailableWidth(unitWasAuto ? 0 : this.parentDimensions?.width || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
  }

  public async componentWillUpdate() {
    if (this.chart == null) {
      return;
    }

    const config: StructureChartComponentConfig = this.prepareConfig();
    const styles: StructureChartStyle = this.prepareStyle();

    this.chart.setI18n(this.i18n);
    this.chart.setStyles(styles);
    this.chart.setRuleSet(new IBCSRuleSet(this.ruleSetConfig));
    this.chart.setConfig(config);
    // See componentWillLoad: no broken-bar overdrive for auto-fitted scaling
    const unitWasAuto = config.pixelPerUnit <= 0;
    this.autoFitScaling(config, styles);
    this.chart.setAvailableWidth(unitWasAuto ? 0 : this.parentDimensions?.width || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
  }

  /**
   * Auto-fit for pixelPerUnit and/or pixelPerPercentage (0 = auto mode).
   * Structure charts grow horizontally, so we fit to width.
   *
   * The chart width is affine in the pixel scales (width = fixed labels +
   * bar extent × scale), but label clamps flip between passes, so a single
   * analytic solve is not enough: measure at 1, solve, then verify against
   * fresh measurements and re-solve until the chart fits. The loop never
   * ends on an overshoot — the last fitting values are restored, or when
   * even the minimum scale cannot fit (labels alone exceed the container)
   * the values are floored and the wrapper reports the overflow.
   * Explicit (> 0) values are never overridden.
   */
  private autoFitScaling(config: StructureChartComponentConfig, styles: StructureChartStyle): void {
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

    const targetWidth = this.parentDimensions?.width;
    const db = this.getDb();
    const rebuild = () => {
      this.chart = new StructureChart(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config, styles);
      this.chart.setI18n(this.i18n);
    };
    // layout() runs draw(), which finalizes positions — an undrawn chart
    // reports a stale allocated width.
    const measure = () => {
      this.chart.layout();
      return this.chart.getAllocatedCanvasWidth();
    };

    if (!targetWidth || targetWidth <= 0) {
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
    let width = measure();

    if (width <= 0) {
      reportResolved();
      return;
    }

    // Fallback for auto quantities nothing scales with (no bar extent):
    // plain ratio against the measurement pass, as before.
    const ratioFallback = Math.max(MIN_PIXEL_SCALE, (targetWidth * 0.9) / width);
    const EPS = 0.5;
    const MAX_CORRECTIONS = 3;
    let solvedUnit = false;
    let solvedPercent = false;
    let fitting: { ppu: number; ppp: number } | null = null;

    for (let iteration = 0; iteration <= MAX_CORRECTIONS; iteration++) {
      const step = solveAutoFitStep({
        target: targetWidth,
        measured: width,
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
      width = measure();
      if (width <= targetWidth + EPS) {
        fitting = { ppu: config.pixelPerUnit, ppp: config.pixelPerPercentage };
        if (width >= targetWidth * 0.98) {
          break; // fits and tight — done
        }
        // else a released label clamp left slack — loop once more to grow into it
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
    if (width > targetWidth + EPS) {
      if (fitting) {
        // Restore the last values that fit (fallback quantities have no extent)
        if (solvedUnit) config.pixelPerUnit = fitting.ppu;
        if (solvedPercent) config.pixelPerPercentage = fitting.ppp;
      } else {
        // Even the solved minimum overshoots (labels alone exceed the
        // container) — shrink proportionally; the wrapper reports this.
        const shrink = targetWidth / width;
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
    //
    //   if (this.chart) {
    //    this.chart.draw(SVG(this.drawElement) as Svg);
    //   }
    // })()
  }

  public componentDidLoad() {
    // if (this.chart == null) {
    //   return;
    // }
    // this.chart.draw(SVG(this.drawElement) as Svg);
    // forceUpdate(getElement(this));
  }

  public componentDidUpdate() {
    // if (this.chart) {
    //   this.chart.draw(SVG(this.drawElement) as Svg);
    // }
  }

  private prepareConfig(): StructureChartComponentConfig {
    const db = this.getDb();
    const fromExpr = this.tableName ? buildFromExpr(this.tableName, this.filter) : "";
    return new StructureChartComponentConfigAdapter(
      new StructureChartDataRowAdapter(),
      new OrderAdapter(new StringAdapter()),
      new StringAdapter(),
      new DataFormatDigitsAdapter(),
      db,
      fromExpr,
    ).adapt({
      scenarios: this.scenarios,
      variances: this.variances,
      title: this.chartTitle,
      hideCategories: this.hideCategories,
      pixelPerUnit: this.pixelPerUnit,
      pixelPerPercentage: this.pixelPerPercentage,
      level: this.level,
      limit: this.limit,
      sortOrder: this.order,
      filter: this.filter,
      measureScale: this.measureScale,
      measureUnit: this.measureUnit,
      showMeasureScale: this.showMeasureScale,
      dataFormatDigits: this.dataFormatDigits,
      stackConfig: this.stackConfig,
    });
  }

  private prepareStyle(): StructureChartStyle {
    return new StructureChartStylesAdapter(
      new ScaleFactorsStructureChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
  }
}
