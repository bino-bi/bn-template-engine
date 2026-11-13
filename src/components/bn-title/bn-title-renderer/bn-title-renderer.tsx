import { Component, h, Prop } from "@stencil/core";

import { Title } from "./utils/Title";
import { TitleConifgAdapter, TitleConfig } from "./utils/model/TitleConfig";
import { MeasureEntry, MeasureEntryAdapter } from "./utils/model/MeasureEntriy";
import { TimePeriod, TimePeriodAdapter } from "./utils/model/TimePeriod";
import { Order, OrderAdapter, OrderDirection } from "../../../utils/model/Order";
import { I18nMode } from "../../../utils/constants";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { sanitizeHtml } from "../../../utils/sanitizeHtml";
import withComponentStatus from "../../../utils/withComponentStatus";

/** @internal */
@Component({
  tag: "bn-title-renderer",
  styleUrl: "bn-title-renderer.scss",
  shadow: true,
})
export class BnTitleRenderer {
  constructor() {
    withComponentStatus(this);
  }

  /** @internal */
  @Prop({ mutable: true, reflect: true }) // Wichtig mutable muss true sein, reflect passt den dom an und updatet die poprs im html
  businessUnit: string = "";

  /** @internal */
  @Prop()
  scenarios: string[] = [];

  /** @internal */
  @Prop()
  measures: MeasureEntry[] = [];

  /** @internal */
  @Prop()
  timeperiod?: TimePeriod;

  /** @internal */
  @Prop()
  intervalSpanLimit: number = 28;

  /** @internal */
  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  /** @internal */
  @Prop({ mutable: true })
  public i18n: Map<string, string> = new Map<string, string>(); //  I18nMode;

  /** @internal */
  @Prop({ attribute: "i18n-mode" })
  i18nMode: I18nMode = I18nMode.ALL;

  /**
   * Locale used to format the date-link labels (e.g. "en", "de").
   * @internal
   */
  @Prop()
  locale: string = "de";

  /** @internal */
  @Prop()
  ruleSetConfig?: RuleSetConfig;

  /** @internal */
  @Prop()
  titleId?: string;

  private title: Title = new Title(new IBCSRuleSet());

  render() {
    return (
      <div class={this.titleId ? "with-id" : undefined}>
        {this.titleId ? <div class="title-id">{this.titleId}</div> : null}
        <div innerHTML={sanitizeHtml(this.title.unit)}></div>
        <div>
          {this.title.measures.map((measure, index) => (
            <span>
              {this.isFirstElement(index) ? this.title.i18n.get("SEPARATOR_WS") : ""}
              <span class="measure">{measure.name}</span> {measure.unit ? this.title.i18n.get("in") : ""} {measure.unit}
            </span>
          ))}
        </div>
        <div>{this.title.dimension}</div>
      </div>
    );
  }

  componentWillLoad() {
    const config: TitleConfig = this.prepareConfig();

    this.title = new Title(new IBCSRuleSet(this.ruleSetConfig));
    this.title.setI18n(this.i18n);
    this.title.setConfig(config);
  }

  componentWillUpdate() {
    const config: TitleConfig = this.prepareConfig();

    this.title.setI18n(this.i18n);
    this.title.setRuleSet(new IBCSRuleSet(this.ruleSetConfig));
    this.title.setConfig(config);
  }

  componentWillRender() {
    this.title.update();
  }

  private isFirstElement(index: number) {
    return index !== 0;
  }

  private prepareConfig(): TitleConfig {
    return new TitleConifgAdapter(
      new MeasureEntryAdapter(),
      new TimePeriodAdapter(),
      new OrderAdapter(new StringAdapter()),
      new StringAdapter(),
    ).adapt({
      businessunit: this.businessUnit,
      measures: this.measures,
      scenarios: this.scenarios,
      timeperiod: this.timeperiod,
      intervalSpanLimit: this.intervalSpanLimit,
      i18nMode: this.i18nMode,
      order: this.order,
      locale: this.locale,
    });
  }
}
