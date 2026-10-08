import { Component, Element, h, Host, Prop } from "@stencil/core";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import withComponentStatus from "../../../utils/withComponentStatus";
import { ErrorDispatcher } from "../../../utils/withHasError";
import { reportQueryError } from "../../../utils/queryError";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { AxisConfig, FacetConfig, IsoConfig, LabelConfig, LegendConfig } from "../../../utils/xy/model/AxisConfig";
import { GroupLevel, PointLevel, XYWarningRecord } from "../../../utils/xy/model/XYChartDataRow";
import { XYChartStyle, XYChartStylesAdapter } from "../../../utils/xy/model/XYChartStyle";
import { ScaleFactorsXYChartAdapter } from "../../../utils/xy/model/ScaleFactorsXYChart";
import { ScatterChart } from "../utils/ScatterChart";

/** The §8 codes this chart can raise from data resolution / drawing. */
const SCATTER_DATA_WARNING_CODES = [
  "xy-duplicate-point",
  "xy-point-clipped",
  "xy-variance-nodata",
  "xy-iso-domain",
  "xy-label-unknown",
  "xy-series-overflow",
  "xy-point-budget",
];

/**
 * Inner presentational element of `bn-chart-scatter`: owns the
 * {@link ScatterChart} orchestrator and emits its SVG string. All props
 * arrive validated and parsed from the facade.
 * @internal
 */
@Component({
  tag: "bn-chart-scatter-renderer",
  styleUrl: "bn-chart-scatter-renderer.scss",
  shadow: true,
})
export class BnChartScatterRenderer {
  @Element() element!: HTMLElement;

  /**
   * Name of the dataset (table or view in the scoped alasql database).
   * @internal
   */
  @Prop() tableName: string = "";

  /**
   * Bumped by the facade when the dataset changes; triggers re-render.
   * @internal
   */
  @Prop() dataVersion: number = 0;

  /** @internal */
  @Prop() chartTitle: string = "";

  /** @internal */
  @Prop() x!: AxisConfig;
  /** @internal */
  @Prop() y!: AxisConfig;
  /** @internal */
  @Prop() iso: IsoConfig | null = null;
  /** @internal */
  @Prop() labels!: LabelConfig;
  /** @internal */
  @Prop() legend!: LegendConfig;
  /** @internal */
  @Prop() facet: FacetConfig | null = null;

  /** @internal */
  @Prop() pointLevel: PointLevel = "category";
  /** @internal */
  @Prop() seriesLevel: GroupLevel | null = null;

  /**
   * Plot aspect ratio, width/height.
   * @internal
   */
  @Prop() aspect: number = 16 / 9;

  /** @internal */
  @Prop() limit: number = 0;
  /** @internal */
  @Prop() filter: string = "";

  /** @internal */
  @Prop() styles: XYChartStyle | undefined;
  /** @internal */
  @Prop() i18n: Map<string, string> = new Map();
  /** @internal */
  @Prop() containerWidth: number = 0;
  /** @internal */
  @Prop() ruleSetConfig?: RuleSetConfig;

  /**
   * The facade's error dispatcher - data warnings are synced through it (stable ids).
   * @internal
   */
  @Prop() errors?: ErrorDispatcher;

  /**
   * Facade-bound translator for warning messages (resolves `.key` in the facade's namespace).
   * @internal
   */
  @Prop() translator?: (key: string, data?: object) => string;

  private chart: ScatterChart | undefined;
  private svgMarkup: string = "";
  private stores: ScopedStores | undefined;

  constructor() {
    withComponentStatus(this);
  }

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
    const fromExpr = sourceExpr(this.getDb(), this.tableName, this.filter);

    this.chart = new ScatterChart(
      new IBCSRuleSet(this.ruleSetConfig),
      this.getDb(),
      fromExpr,
      {
        chartTitle: this.chartTitle,
        x: this.x,
        y: this.y,
        iso: this.iso,
        labels: this.labels,
        legend: this.legend,
        facet: this.facet,
        pointLevel: this.pointLevel,
        seriesLevel: this.seriesLevel,
        aspect: this.aspect,
        limit: this.limit,
      },
      styles,
      this.containerWidth || 0,
    );
    this.chart.setI18n(this.i18n);
    this.svgMarkup = this.chart.hasNoData() ? "" : this.chart.toString();
    this.syncWarnings(this.chart.getWarnings());
    reportQueryError(this.errors, this.chart.getQueryError());
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
    for (const code of SCATTER_DATA_WARNING_CODES) {
      const id = `WARN_${code.replace(/-/g, "_")}` as const;
      if (present.has(code)) {
        const message = this.translator !== undefined ? this.translator(`.${code}`, present.get(code)) : code;
        this.errors.addOrReplace({ id, type: "warning", message });
      } else {
        this.errors.remove(id);
      }
    }
  }

  private prepareStyle(): XYChartStyle {
    const styles = new XYChartStylesAdapter(
      new ScaleFactorsXYChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
    styles.locale = getStores(this.element).context?.state?.locale || "de";

    return styles;
  }

  render() {
    // a failed query is the facade's ERR_sql item, not "No Data"
    if (this.chart === undefined || this.chart.getQueryError() !== undefined) {
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
