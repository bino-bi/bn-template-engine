import { Component, Element, h, Host, Prop } from "@stencil/core";
import { StructureChart } from "./utils/StructureChart";
import { CustomPattern } from "./utils/helper";
import {
  StructureChartComponentConfig,
  StructureChartComponentConfigAdapter,
  StructureChartDataRow,
} from "./utils/model";
import { StackConfigParsed } from "./utils/model/StructureChartComponentConfig";
import { StructureChartDataRowAdapter } from "./utils/model";
import { ScaleFactorsStructureChartAdapter } from "./utils/model";
//import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
//import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
//import { SVGVariancesStyleGroupAdapter } from "../../utils/model/styles/SVGVariancesStyleGroup";
//import { PaddingAdapter } from "../../utils/model/styles/Padding";
//import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { StructureChartStylesAdapter, StructureChartStyle } from "./utils/model/styles/StructureChartStyle";
import { Order, OrderAdapter, OrderDirection } from "../../utils/model/Order";
import { AggregationLevel } from "../../utils/constants";
import { ParentDimensions } from "../../utils/parentDimensions";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { StringAdapter } from "../../utils/helper/StringAdapter";
import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
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
  @Element() element: HTMLElement | undefined;

  @Prop() data: StructureChartDataRow[] = [];

  @Prop() chartTitle: string = "";

  @Prop() scenarios: string[] = [];

  @Prop() variances: string[] = [];

  @Prop() hideCategories: boolean = false;

  @Prop() pixelPerUnit: number = 10;

  @Prop() pixelPerPercentage: number = 50;

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

  private chart: StructureChart | undefined;
  private pattern: CustomPattern | undefined;

  constructor() {}

  public render() {
    if (this.chart === undefined) {
      return <Host />;
    }

    if (this.chart.hasNoData()) {
      const errorMsg: string = this.i18n.get("NO_DATA") || "==No Data==";
      return (
        <Host>
          <p class="warning">{errorMsg}</p>
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
    const config: StructureChartComponentConfig = this.prepareConfig();
    const styles: StructureChartStyle = this.prepareStyle();

    this.chart = new StructureChart(new IBCSRuleSet(), config, styles);
    this.chart.setI18n(this.i18n);
    this.autoFitScaling(config, styles);
    this.chart.setAvailableWidth(this.parentDimensions?.width || 0);
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
    this.chart.setConfig(config);
    this.autoFitScaling(config, styles);
    this.chart.setAvailableWidth(this.parentDimensions?.width || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
  }

  /**
   * Two-pass auto-fit for pixelPerUnit and/or pixelPerPercentage.
   * When either is 0 (auto mode), renders a measurement pass at 1,
   * computes the ratio to fit the available width, and rebuilds.
   * Structure charts grow horizontally, so we fit to width.
   * Explicit (> 0) values are never overridden.
   */
  private autoFitScaling(config: StructureChartComponentConfig, styles: StructureChartStyle): void {
    const autoUnit = config.pixelPerUnit <= 0;
    const autoPercent = config.pixelPerPercentage <= 0;

    if (!autoUnit && !autoPercent) {
      return; // Both explicit — nothing to auto-fit
    }

    const targetWidth = this.parentDimensions?.width;
    if (!targetWidth || targetWidth <= 0) {
      if (autoUnit) config.pixelPerUnit = 1;
      if (autoPercent) config.pixelPerPercentage = 50;
      this.chart = new StructureChart(new IBCSRuleSet(), config, styles);
      this.chart.setI18n(this.i18n);
      return;
    }

    // First pass: set auto values to 1 and measure total width + bar extent
    if (autoUnit) config.pixelPerUnit = 1;
    if (autoPercent) config.pixelPerPercentage = 1;
    this.chart = new StructureChart(new IBCSRuleSet(), config, styles);
    this.chart.setI18n(this.i18n);
    this.chart.toString();
    const svgWidth = this.chart.getAllocatedCanvasWidth();

    if (svgWidth <= 0) {
      return;
    }

    // Separate fixed parts (labels, padding, spacing) from variable part (bar extent).
    // totalWidth(ppu) = fixedWidth + maxBarValue * ppu
    // Solving for ppu:  ppu = (targetWidth - fixedWidth) / maxBarValue
    const maxBarValue = this.chart.getMaxBarValue();
    if (autoUnit) {
      if (maxBarValue > 0) {
        const fixedWidth = svgWidth - maxBarValue; // at ppu=1, barExtent = maxBarValue * 1
        config.pixelPerUnit = Math.max(0.001, (targetWidth - fixedWidth) / maxBarValue);
      } else {
        config.pixelPerUnit = (targetWidth * 0.9) / svgWidth;
      }
    }
    if (autoPercent) {
      // Same ratio approach: scale percentage bars to fill ~90% of width
      config.pixelPerPercentage = (targetWidth * 0.9) / svgWidth;
    }

    // Second pass with the corrected scaling
    this.chart = new StructureChart(new IBCSRuleSet(), config, styles);
    this.chart.setI18n(this.i18n);
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
    return new StructureChartComponentConfigAdapter(
      new StructureChartDataRowAdapter(),
      new OrderAdapter(new StringAdapter()),
      new StringAdapter(),
      new DataFormatDigitsAdapter(),
      this.data as unknown as Record<string, unknown>[],
    ).adapt({
      data: this.data,
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
