import { Component, Element, h, Host, Prop } from "@stencil/core";
import { TimeChart } from "./utils/TimeChart";
import { CustomPattern } from "./utils/helper";

import { StackConfigParsed, TimeChartComponentConfig, TimeChartComponentConfigAdapter } from "./utils/model/TimeChartComponentConfig";
import { TimeChartDataRow, TimeChartDataRowAdapter } from "./utils/model/TimeChartDataRow";
import { TimeChartStyle, TimeChartStylesAdapter } from "./utils/model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./utils/model/styles/ScaleFactorsTimeChart";
import { DateDistance } from "../../utils/DateStringFactory";
import { AggregationLevel, AxisLabelsMode, ChartMode } from "../../utils/constants";
import { ParentDimensions } from "../../utils/parentDimensions";
import { StringAdapter } from "../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
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
  shadow: true
})

export class IbcsChartTime {

  @Element() element: HTMLElement | undefined;

  // @Prop() dimension: { height: number, width: number } = {height: 400, width: 450};

  @Prop() data: TimeChartDataRow[] = [];

  @Prop() chartTitle?: string;   // title cannot be used, is reserved

  @Prop() scenarios: string[] = [];

  @Prop() variances: string[] = [];  //["dfc_ac_neg"]

  @Prop() hideAxisLabels: boolean = false; //false

  @Prop() pixelPerUnit: number = 2;  //2

  @Prop() pixelPerPercentage: number = 50;  //2
  @Prop() limit: number = 0;

  @Prop() leftSideOffsetForHorizontalSync: number = -1;
  @Prop({ mutable: true })
  @Prop() styles: TimeChartStyle | undefined;

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
  @Prop() showOverlayAvg: boolean =  false;

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



  drawElement: SVGElement | undefined;
  patternElement: HTMLSpanElement | undefined;

  private chart: TimeChart | undefined;
  private pattern: CustomPattern | undefined;

  constructor() {

  }

  render() {

    if (this.chart == undefined) {
      return (<Host />);
    }

    if (this.chart.hasNoData()) {
      const errorMsg: string = this.i18n.get("NO_DATA") || "==No Data==";
      return (<Host><p class="warning">{errorMsg}</p></Host>);
    }


    return (
      <Host>
        <div innerHTML={this.pattern?.toString()} class="hidePatternContainer" />      
        
        <div class={this.showMeasureScale? "footer": "footer-hide" }>{this.chart?.getFooter()}</div>
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

    this.chart = new TimeChart(new IBCSRuleSet(), config, styles, availableWidth);
    this.chart.setI18n(this.i18n);
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(this.parentDimensions?.height || 0);
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
    this.chart.setConfig(config);
    this.autoFitScaling(config, styles);
    this.chart.setAvailableHeight(this.parentDimensions?.height || 0);
    this.pattern = new CustomPattern(this.chart.styles);
    this.chart.setPattern("fc", this.pattern.getFCPolygonPattern());
  }

  /**
   * Two-pass auto-fit: only when pixelPerUnit is 0 (auto mode).
   * Explicit values are never overridden — the outer component warns
   * about overflow via componentDidRender.
   */
  private autoFitScaling(config: TimeChartComponentConfig, styles: TimeChartStyle): void {
    if (config.pixelPerUnit > 0) {
      return; // Explicit value — respect it, do not override
    }

    const targetHeight = this.parentDimensions?.height;
    const availableWidth = this.containerWidth || 0;
    if (!targetHeight || targetHeight <= 0) {
      config.pixelPerUnit = 1; // No parent info — use fallback
      this.chart = new TimeChart(new IBCSRuleSet(), config, styles, availableWidth);
      this.chart.setI18n(this.i18n);
      return;
    }

    // First pass with pixelPerUnit=1 to measure the real SVG height
    config.pixelPerUnit = 1;
    this.chart = new TimeChart(new IBCSRuleSet(), config, styles, availableWidth);
    this.chart.setI18n(this.i18n);
    this.chart.toString();
    const svgHeight = this.chart.getAllocatedCanvasHeight();

    if (svgHeight <= 0) {
      return;
    }

    // Scale so the chart fits in ~90% of the available height
    config.pixelPerUnit = (targetHeight * 0.9) / svgHeight;

    // Second pass with the corrected scaling
    this.chart = new TimeChart(new IBCSRuleSet(), config, styles, availableWidth);
    this.chart.setI18n(this.i18n);
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
    return new TimeChartComponentConfigAdapter(new TimeChartDataRowAdapter(), new OrderAdapter(new StringAdapter()), new StringAdapter(), new DataFormatDigitsAdapter(), this.data).adapt({
      "data": this.data,
      "scenarios": this.scenarios,
      "variances": this.variances,
      "title": this.chartTitle,
      "hideAxisLabels": this.hideAxisLabels,
      "pixelPerUnit": this.pixelPerUnit,
      "pixelPerPercentage": this.pixelPerPercentage,
      "level": this.level,
      "dateInterval": this.dateInterval,
      "axisLabelsMode": this.axisLabelsMode,
      "limit": this.limit,
      "sortOrder": this.order,
      "leftSideOffsetForHorizontalSync": this.leftSideOffsetForHorizontalSync,
      "intervalSpanLimit": this.intervalSpanLimit,
      "filter": this.filter,
      "measureScale": this.measureScale,
      "measureUnit": this.measureUnit,     
      "showMeasureScale": this.showMeasureScale,
      "dataFormatDigits":this.dataFormatDigits,
      "showOverlayMedian": this.showOverlayMedian,
      "showOverlayAvg": this.showOverlayAvg,
      "chartMode": this.chartMode,
      "maxBars": this.maxBars,
      "stackConfig": this.stackConfig,
      "lineFullWidth": this.lineFullWidth,
    });
  }

  private prepareStyle(): TimeChartStyle {
    return new TimeChartStylesAdapter(new ScaleFactorsTimeChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter),
      new PaddingAdapter()).adapt(this.styles);
  }
}
