import { Component, Element, h, Host, Prop } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { buildFromExpr } from "../../context/scopedDb";
import { RuleSetConfig } from "../../stores/ruleSets";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { ErrorDispatcher } from "../../utils/withHasError";
import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
import {
  AxisConfig,
  FacetConfig,
  LabelConfig,
  LegendConfig,
  ShareConfig,
  SizeConfig,
} from "../../utils/xy/model/AxisConfig";
import { GroupLevel, PointLevel, XYWarningRecord } from "../../utils/xy/model/XYChartDataRow";
import { XYChartStyle, XYChartStylesAdapter } from "../../utils/xy/model/XYChartStyle";
import { ScaleFactorsXYChartAdapter } from "../../utils/xy/model/ScaleFactorsXYChart";
import { BubbleChart } from "./utils/BubbleChart";

/** The §8 codes this chart can raise from data resolution / drawing. */
const BUBBLE_DATA_WARNING_CODES = [
  "xy-duplicate-point",
  "xy-point-clipped",
  "xy-variance-nodata",
  "xy-label-unknown",
  "xy-series-overflow",
  "xy-point-budget",
  "bubble-size-negative",
  "bubble-share-range",
  "bubble-scale-overflow",
];

/**
 * Inner presentational element of `bn-chart-bubble`: owns the
 * {@link BubbleChart} orchestrator and emits its SVG string. All props
 * arrive validated and parsed from the facade.
 */
@Component({
  tag: "ibcs-chart-bubble",
  styleUrl: "ibcs-chart-bubble.scss",
  shadow: true,
})
export class IbcsChartBubble {
  @Element() element!: HTMLElement;

  /** Name of the dataset (table or view in the scoped alasql database). */
  @Prop() tableName: string = "";

  /** Bumped by the facade when the dataset changes; triggers re-render. */
  @Prop() dataVersion: number = 0;

  @Prop() chartTitle: string = "";

  @Prop() x!: AxisConfig;
  @Prop() y!: AxisConfig;
  @Prop() size!: SizeConfig;
  @Prop() share: ShareConfig | null = null;
  /** Comparison scenario family, or `null` (10D overlay). */
  @Prop() compareFamily: string | null = null;
  @Prop() labels!: LabelConfig;
  @Prop() legend!: LegendConfig;
  @Prop() facet: FacetConfig | null = null;

  @Prop() pointLevel: PointLevel = "category";
  @Prop() seriesLevel: GroupLevel | null = null;

  /** Plot aspect ratio, width/height. */
  @Prop() aspect: number = 16 / 9;

  @Prop() limit: number = 0;
  @Prop() filter: string = "";

  /** Scaling-group mode: area px² per data unit (0 = local sizing). */
  @Prop() sizeAreaPerUnit: number = 0;

  @Prop() styles: XYChartStyle | undefined;
  @Prop() i18n: Map<string, string> = new Map();
  @Prop() containerWidth: number = 0;
  @Prop() ruleSetConfig?: RuleSetConfig;

  /** The facade's error dispatcher - data warnings are synced through it (stable ids). */
  @Prop() errors?: ErrorDispatcher;

  /** Facade-bound translator for warning messages (resolves `.key` in the facade's namespace). */
  @Prop() translate?: (key: string, data?: object) => string;

  private chart: BubbleChart | undefined;
  private svgMarkup: string = "";
  private stores: ScopedStores | undefined;

  private getDb() {
    if (!this.stores) this.stores = getStores(this.element);
    return this.stores.db.db;
  }

  public componentWillLoad() {
    this.rebuild();
  }

  public componentWillUpdate() {
    this.rebuild();
  }

  private rebuild(): void {
    const styles = this.prepareStyle();
    const fromExpr = this.tableName ? buildFromExpr(this.tableName, this.filter) : "";

    this.chart = new BubbleChart(
      new IBCSRuleSet(this.ruleSetConfig),
      this.getDb(),
      fromExpr,
      {
        chartTitle: this.chartTitle,
        x: this.x,
        y: this.y,
        size: this.size,
        share: this.share,
        compareFamily: this.compareFamily,
        labels: this.labels,
        legend: this.legend,
        facet: this.facet,
        pointLevel: this.pointLevel,
        seriesLevel: this.seriesLevel,
        aspect: this.aspect,
        limit: this.limit,
        sizeAreaPerUnit: this.sizeAreaPerUnit,
      },
      styles,
      this.containerWidth || 0,
    );
    this.chart.setI18n(this.i18n);
    this.svgMarkup = this.chart.hasNoData() ? "" : this.chart.toString();
    this.syncWarnings(this.chart.getWarnings());
  }

  /**
   * Syncs the orchestrator's data warnings to the facade's dispatcher.
   * Walks the full fixed code list so cleared warnings are removed again
   * (addOrReplace/remove discipline, stable ids).
   */
  private syncWarnings(warnings: XYWarningRecord[]): void {
    if (this.errors === undefined) {
      return;
    }

    const present = new Map(warnings.map((warning) => [warning.code, warning.data]));
    for (const code of BUBBLE_DATA_WARNING_CODES) {
      const id = `WARN_${code}`;
      if (present.has(code)) {
        const message = this.translate !== undefined ? this.translate(`.${code}`, present.get(code)) : code;
        this.errors.addOrReplace({ id, type: "warning", message });
      } else {
        this.errors.remove(id);
      }
    }
  }

  private prepareStyle(): XYChartStyle {
    return new XYChartStylesAdapter(
      new ScaleFactorsXYChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
  }

  render() {
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
        <div innerHTML={this.svgMarkup}></div>
      </Host>
    );
  }
}
