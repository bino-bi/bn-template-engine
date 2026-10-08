import { Component, Element, h, Host, Prop } from "@stencil/core";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { AggregationLevel } from "../../../utils/constants";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import withComponentStatus from "../../../utils/withComponentStatus";
import { Order } from "../../../utils/model/Order";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { ErrorDispatcher } from "../../../utils/withHasError";
import { reportQueryError } from "../../../utils/queryError";
import { XYWarningRecord } from "../../../utils/xy/model/XYChartDataRow";
import { BulletChart } from "../utils/BulletChart";
import {
  BulletChartStyle,
  BulletChartStylesAdapter,
  ScaleFactorsBulletChartAdapter,
} from "../utils/model/BulletChartStyle";
import { BulletLabelConfig, BulletMeasureConfig } from "../utils/model/BulletConfig";

/** The codes this chart can raise from data resolution. */
const BULLET_DATA_WARNING_CODES = [
  "bullet-target-missing",
  "bullet-target-invalid",
  "bullet-actual-negative",
  "bullet-mixed-operation",
  "bullet-target-none",
];

/**
 * Inner presentational element of `bn-chart-bullet`: owns the
 * {@link BulletChart} orchestrator and emits its SVG string. All props
 * arrive validated and parsed from the facade.
 * @internal
 */
@Component({
  tag: "bn-chart-bullet-renderer",
  styleUrl: "bn-chart-bullet-renderer.scss",
  shadow: true,
})
export class BnChartBulletRenderer {
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
  @Prop() actual!: BulletMeasureConfig;
  /** @internal */
  @Prop() target: BulletMeasureConfig | null = null;
  /** @internal */
  @Prop() ranges: number[] = [];
  /** @internal */
  @Prop() normalizeMode: "target" | "none" = "target";
  /** @internal */
  @Prop() showVariances: boolean = true;

  /** @internal */
  @Prop() level: AggregationLevel = AggregationLevel.CATEGORY;
  /** @internal */
  @Prop() order!: Order;
  /** @internal */
  @Prop() limit: number = 0;
  /** @internal */
  @Prop() labels!: BulletLabelConfig;
  /** @internal */
  @Prop() filter: string = "";

  /** @internal */
  @Prop() styles: BulletChartStyle | undefined;
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

  private chart: BulletChart | undefined;
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

    this.chart = new BulletChart(
      new IBCSRuleSet(this.ruleSetConfig),
      this.getDb(),
      fromExpr,
      {
        chartTitle: this.chartTitle,
        actual: this.actual,
        target: this.target,
        ranges: this.ranges,
        normalize: this.normalizeMode,
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
    for (const code of BULLET_DATA_WARNING_CODES) {
      const id = `WARN_${code}`;
      if (present.has(code)) {
        const message = this.translator !== undefined ? this.translator(`.${code}`, present.get(code)) : code;
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
