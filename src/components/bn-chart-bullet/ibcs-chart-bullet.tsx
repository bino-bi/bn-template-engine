import { Component, Element, h, Host, Prop } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { buildFromExpr } from "../../context/scopedDb";
import { RuleSetConfig } from "../../stores/ruleSets";
import { AggregationLevel } from "../../utils/constants";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { Order } from "../../utils/model/Order";
import { FontStyleAdapter } from "../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../utils/model/styles/SVGStyleGroup";
import { SVGVariancesStyleGroupAdapter } from "../../utils/model/styles/SVGVariancesStyleGroup";
import { ErrorDispatcher } from "../../utils/withHasError";
import { XYWarningRecord } from "../../utils/xy/model/XYChartDataRow";
import { BulletChart } from "./utils/BulletChart";
import {
  BulletChartStyle,
  BulletChartStylesAdapter,
  ScaleFactorsBulletChartAdapter,
} from "./utils/model/BulletChartStyle";
import { BulletLabelConfig, BulletMeasureConfig } from "./utils/model/BulletConfig";

/** The codes this chart can raise from data resolution. */
const BULLET_DATA_WARNING_CODES = [
  "bullet-target-missing",
  "bullet-target-invalid",
  "bullet-mixed-operation",
  "bullet-target-none",
];

/**
 * Inner presentational element of `bn-chart-bullet`: owns the
 * {@link BulletChart} orchestrator and emits its SVG string. All props
 * arrive validated and parsed from the facade.
 */
@Component({
  tag: "ibcs-chart-bullet",
  styleUrl: "ibcs-chart-bullet.scss",
  shadow: true,
})
export class IbcsChartBullet {
  @Element() element!: HTMLElement;

  /** Name of the dataset (table or view in the scoped alasql database). */
  @Prop() tableName: string = "";

  /** Bumped by the facade when the dataset changes; triggers re-render. */
  @Prop() dataVersion: number = 0;

  @Prop() chartTitle: string = "";

  @Prop() actual!: BulletMeasureConfig;
  @Prop() target: BulletMeasureConfig | null = null;
  @Prop() ranges: number[] = [];
  @Prop() normalize: "target" | "none" = "target";
  @Prop() showVariances: boolean = true;

  @Prop() level: AggregationLevel = AggregationLevel.CATEGORY;
  @Prop() order!: Order;
  @Prop() limit: number = 0;
  @Prop() labels!: BulletLabelConfig;
  @Prop() filter: string = "";

  @Prop() styles: BulletChartStyle | undefined;
  @Prop() i18n: Map<string, string> = new Map();
  @Prop() containerWidth: number = 0;
  @Prop() ruleSetConfig?: RuleSetConfig;

  /** The facade's error dispatcher - data warnings are synced through it (stable ids). */
  @Prop() errors?: ErrorDispatcher;

  /** Facade-bound translator for warning messages (resolves `.key` in the facade's namespace). */
  @Prop() translate?: (key: string, data?: object) => string;

  private chart: BulletChart | undefined;
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

    this.chart = new BulletChart(
      new IBCSRuleSet(this.ruleSetConfig),
      this.getDb(),
      fromExpr,
      {
        chartTitle: this.chartTitle,
        actual: this.actual,
        target: this.target,
        ranges: this.ranges,
        normalize: this.normalize,
        showVariances: this.showVariances,
        level: this.level,
        order: this.order,
        limit: this.limit,
        labels: this.labels,
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
    for (const code of BULLET_DATA_WARNING_CODES) {
      const id = `WARN_${code}`;
      if (present.has(code)) {
        const message = this.translate !== undefined ? this.translate(`.${code}`, present.get(code)) : code;
        this.errors.addOrReplace({ id, type: "warning", message });
      } else {
        this.errors.remove(id);
      }
    }
  }

  private prepareStyle(): BulletChartStyle {
    const styles = new BulletChartStylesAdapter(
      new ScaleFactorsBulletChartAdapter(),
      new FontStyleAdapter(),
      new SVGStyleGroupAdapter(new SVGStyleAdapter()),
      new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
      new PaddingAdapter(),
    ).adapt(this.styles as unknown as Record<string, unknown>);
    styles.locale = getStores(this.element).context?.state?.locale || "de";

    return styles;
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
