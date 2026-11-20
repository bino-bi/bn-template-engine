import { Component, Element, h, Host, Prop } from "@stencil/core";
import { StructureChart } from "../utils/StructureChart";
import { CustomPattern } from "../utils/helper";
import { StructureChartComponentConfig, StructureChartComponentConfigAdapter } from "../utils/model";
import { ReferenceLine, StackConfigParsed } from "../utils/model/StructureChartComponentConfig";
import { StructureChartDataRowAdapter } from "../utils/model";
import { ScaleFactorsStructureChartAdapter } from "../utils/model";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
//import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
//import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
//import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
//import { PaddingAdapter } from "../../../utils/model/styles/Padding";
//import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { StructureChartStylesAdapter, StructureChartStyle } from "../utils/model/styles/StructureChartStyle";
import { Order, OrderAdapter, OrderDirection } from "../../../utils/model/Order";
import { AggregationLevel } from "../../../utils/constants";
import { ParentDimensions } from "../../../utils/parentDimensions";
import { AutoScalingReport } from "../../../utils/scaling";
import { MIN_PIXEL_SCALE, solveAutoFitStep } from "../../../utils/autoFit";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import withComponentStatus from "../../../utils/withComponentStatus";
import { ErrorDispatcher } from "../../../utils/withHasError";
import { errorText, reportQueryError } from "../../../utils/queryError";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
//import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
//import { DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";

/** @internal */
@Component({
  tag: "bn-chart-structure-renderer",
  styleUrl: "../bn-chart-structure.scss",
  shadow: true,
})
export class BnChartStructureRenderer {
  @Element() element!: HTMLElement;

  /**
   * Name of the dataset (table or view in the shared alasql database).
   * @internal
   */
  @Prop() tableName: string = "";

  /**
   * Bumped by `bn-chart-structure` when the dataset changes; triggers re-render.
   * @internal
   */
  @Prop() dataVersion: number = 0;

  /** @internal */
  @Prop() chartTitle: string = "";

  /** @internal */
  @Prop() scenarios: string[] = [];

  /** @internal */
  @Prop() variances: string[] = [];

  /** @internal */
  @Prop() hideCategories: boolean = false;

  /** @internal */
  @Prop() pixelPerUnit: number = 10;

  /** @internal */
  @Prop() pixelPerPercentage: number = 50;

  /**
   * Internal wrapper channel: called with the auto-fitted values (px for one
   * data unit / px per 1.0 fraction) whenever one of them was auto-resolved, so
   * the outer `bn-chart-structure` can surface them in its AUTO_* warnings.
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
  @Prop() limit: number = 0;

  /** @internal */
  @Prop({ mutable: true })
  @Prop()
  styles: StructureChartStyle | undefined;

  /** @internal */
  @Prop({ mutable: true })
  i18n: Map<string, string> = new Map(); //  I18nMode;

  /** @internal */
  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  /** @internal */
  @Prop()
  level: AggregationLevel = AggregationLevel.CATEGORY;

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
  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  /** @internal */
  @Prop()
  stackConfig: StackConfigParsed | null = null;

  /** @internal */
  @Prop() sums: string = "none";

  /** @internal */
  @Prop() sumTitle: string = "";

  /** @internal */
  @Prop() varianceWaterfall: boolean = false;

  /** @internal */
  @Prop() bridgeVariances: string[] = [];

  /** @internal */
  @Prop() sumScenarios: string[] = [];

  /** @internal */
  @Prop() sumDataset: string = "";

  /** @internal */
  @Prop() valueSuffix: string = "";

  /** @internal */
  @Prop() scenarioLabelTop: boolean = false;

  /** @internal */
  @Prop() hideScenarioName: boolean = false;

  /** @internal */
  @Prop() referenceLine: ReferenceLine | null = null;

  /** @internal */
  @Prop() italicCategories: string[] = [];

  /** @internal */
  @Prop() rowLines: number = 0;

  /** @internal */
  @Prop() rowLinesAfter: number[] = [];

  /** @internal */
  @Prop() orderMark: boolean = false;

  /** @internal */
  @Prop() tiers: boolean = false;

  /** @internal The width this segment needs without break marks. The wrapper shares the free room with it. */
  @Prop() reportWidth?: (width: number, cuttable: boolean) => void;

  /** @internal The equal share of the chart width for one segment. */
  @Prop() equalShare: number = 0;

  /** @internal */
  @Prop()
  parentDimensions: ParentDimensions = { width: 0, height: 0 };

  /** @internal */
  @Prop()
  ruleSetConfig?: RuleSetConfig;

  private chart: StructureChart | undefined;
  private pattern: CustomPattern | undefined;
  private stores: ScopedStores | undefined;
  private measureScaleError: string | undefined;
  private queryError: string | undefined;

  constructor() {
    withComponentStatus(this);
  }

  private getDb() {
    if (!this.stores) this.stores = getStores(this.element);
    return this.stores.db.db;
  }

  public render() {
    if (this.chart === undefined || this.queryError !== undefined) {
      return <Host />;
    }

    if (this.chart.isBridgeTier()) {
      // the base chart draws this variance as the bridge between its total bars
      return <Host class="bridge-tier" style={{ display: "none" }} />;
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
        {/* overflow: an SVG without a size is 300px wide and would count as chart content */}
        <div
          innerHTML={this.pattern?.toString()}
          class="hidePatternContainer"
          style={{ width: "0", height: "0", overflow: "hidden" }}
        />

        <div class={this.showMeasureScale ? "footer" : "footer-hide"}>{this.chart?.getFooter()}</div>
        {/* <svg ref={(el) => this.drawElement = el} id="drawCanvas" width={this.chart.getAllocatedCanvasWidth()} height={this.chart.getAllocatedCanvasHeight()} />*/}
        <div innerHTML={this.chart?.toString()}></div>
      </Host>
    );
  }

  /** Reports a failed query as the wrapper's `ERR_sql` item. Without it the chart would only show "No Data". */
  private syncQueryError(): void {
    this.queryError = this.measureScaleError ?? this.chart?.getQueryError();
    reportQueryError(this.errors, this.queryError);

    // the renderers of the variances share the error store: only the base chart reports
    if (this.variances.every((variance) => variance === "")) {
      const fallback = this.chart?.getBridgeFallback() ?? null;
      if (fallback) {
        this.errors?.addOrReplace({
          id: "WARN_varianceWaterfall_bridge",
          type: "warning",
          message: `varianceWaterfall: no bridge between the totals, ${fallback}. The variances are a walk in their own segment.`,
        });
      } else {
        this.errors?.remove("WARN_varianceWaterfall_bridge");
      }
    }
  }

  public async componentWillLoad() {
    const db = this.getDb();
    const config: StructureChartComponentConfig = this.prepareConfig();
    const styles: StructureChartStyle = this.prepareStyle();

    this.chart = new StructureChart(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config, styles);
    this.chart.setI18n(this.i18n);
    // The broken-bar overdrive exists to absorb MANUAL scaling overflow.
    // autoFitScaling mutates config.pixelPerUnit to the solved value, so
    // remember auto mode beforehand and skip the overdrive for it - the
    // fitted chart fits by construction, and the overdrive's rough overhead
    // estimate would falsely re-engage on it.
    const unitWasAuto = config.pixelPerUnit <= 0;
    this.autoFitScaling(config, styles);
    this.fitWidth(unitWasAuto, config, styles);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("hatched", this.pattern.getFCPolygonPattern());
    this.syncQueryError();
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
    this.fitWidth(unitWasAuto, config, styles);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("hatched", this.pattern.getFCPolygonPattern());
    this.syncQueryError();
  }

  /** What the last measurement of this segment gave, and what it was made from. */
  private measured?: { key: string; natural: number; footer: number; cuttable: boolean };

  /**
   * Sets the room for the bars. Before, it reports the width the segment has
   * when no bar is cut. The chart is drawn once more to measure that, so the
   * result is kept as long as nothing it depends on changes.
   */
  private fitWidth(auto: boolean, config: StructureChartComponentConfig, styles: StructureChartStyle): void {
    let room = auto ? 0 : this.parentDimensions?.width || 0;
    if (!auto && this.reportWidth) {
      this.chart.setAvailableWidth(0);
      const key = JSON.stringify([
        config,
        styles,
        [...(this.i18n?.entries() ?? [])],
        this.ruleSetConfig,
        this.dataVersion,
        this.tableName,
        this.equalShare,
      ]);
      if (this.measured?.key !== key) {
        const hidden = this.chart.isBridgeTier() || this.chart.hasNoData();
        let natural = 0;
        if (!hidden) {
          this.chart.layout();
          natural = this.chart.getAllocatedCanvasWidth();
        }
        this.measured = {
          key,
          natural,
          // the footer stands beside the chart: it is a part of what the segment needs
          footer: hidden ? 0 : this.chart.getFooterRoom(),
          // a segment that is wider than its equal share and gets no break marks there is as wide as it is
          cuttable: !hidden && this.chart.cutsAt(this.equalShare),
        };
      }
      const { natural, footer, cuttable } = this.measured;
      this.reportWidth(natural + footer, cuttable);
      // at its equal share a segment is cut as before. More room is room for the chart and its footer
      if (room > this.equalShare + 0.5) room = Math.max(this.equalShare, room - footer);
      // the check for break marks keeps room for them: a segment that fits as it is needs none
      if (natural <= room + 0.5) return;
    }
    this.chart.setAvailableWidth(room);
  }

  /**
   * Auto-fit for pixelPerUnit and/or pixelPerPercentage (0 = auto mode).
   * Structure charts grow horizontally, so we fit to width.
   *
   * The chart width is affine in the pixel scales (width = fixed labels +
   * bar extent × scale), but label clamps flip between passes, so a single
   * analytic solve is not enough: measure at 1, solve, then verify against
   * fresh measurements and re-solve until the chart fits. The loop never
   * ends on an overshoot - the last fitting values are restored, or when
   * even the minimum scale cannot fit (labels alone exceed the container)
   * the values are floored and the wrapper reports the overflow.
   * Explicit (> 0) values are never overridden.
   */
  private autoFitScaling(config: StructureChartComponentConfig, styles: StructureChartStyle): void {
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

    const targetWidth = this.parentDimensions?.width;
    const db = this.getDb();
    const rebuild = () => {
      this.chart = new StructureChart(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config, styles);
      this.chart.setI18n(this.i18n);
    };
    // layout() runs draw(), which finalizes positions - an undrawn chart
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
      width = measure();
      if (width <= targetWidth + EPS) {
        fitting = { ppu: config.pixelPerUnit, ppp: config.pixelPerPercentage };
        if (width >= targetWidth * 0.98) {
          break; // fits and tight - done
        }
        // else a released label clamp left slack - loop once more to grow into it
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
        // container) - shrink proportionally; the wrapper reports this.
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
    const fromExpr = sourceExpr(db, this.tableName, this.filter);
    this.measureScaleError = undefined;
    return new StructureChartComponentConfigAdapter(
      new StructureChartDataRowAdapter(),
      new OrderAdapter(new StringAdapter(), true),
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
      sums: this.sums,
      sumTitle: this.sumTitle,
      varianceWaterfall: this.varianceWaterfall,
      bridgeVariances: this.bridgeVariances,
      sumScenarios: this.sumScenarios,
      sumDataset: this.sumDataset,
      valueSuffix: this.valueSuffix,
      scenarioLabelTop: this.scenarioLabelTop,
      hideScenarioName: this.hideScenarioName,
      referenceLine: this.referenceLine,
      italicCategories: this.italicCategories,
      rowLines: this.rowLines,
      rowLinesAfter: this.rowLinesAfter,
      orderMark: this.orderMark,
      tiers: this.tiers,
    });
  }

  private prepareStyle(): StructureChartStyle {
    const styles = new StructureChartStylesAdapter(
      new ScaleFactorsStructureChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
    styles.locale = getStores(this.element).context?.state?.locale || "de";

    return styles;
  }
}
