import { Component, h, Method, Prop } from "@stencil/core";

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

@Component({
  tag: "ibcs-title",
  styleUrl: "ibcs-title.scss",
  shadow: true,
})
export class IbcsTitle {
  constructor() {
    withComponentStatus(this);
  }

  @Prop({ mutable: true, reflect: true }) // Wichtig mutable muss true sein, reflect passt den dom an und updatet die poprs im html
  businessUnit: string = "";

  // so
  @Method()
  async setBusinessUnit(businessUnit: string) {
    this.businessUnit = businessUnit;
  }

  // oder so
  @Method()
  async setProps(data: Partial<IbcsTitle>) {
    Object.keys(data).forEach((key) => {
      //@ts-ignore
      this[key] = data[key];
    });
  }

  @Prop()
  scenarios: string[] = [];

  @Prop()
  measures: MeasureEntry[] = [];

  @Prop()
  timeperiod?: TimePeriod;

  @Prop()
  intervalSpanLimit: number = 28;

  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  @Prop({ mutable: true })
  public i18n: Map<string, string> = new Map<string, string>(); //  I18nMode;

  @Prop({ attribute: "i18n-mode" })
  i18nMode: I18nMode = I18nMode.ALL;

  /** Locale used to format the date-link labels (e.g. "en", "de"). */
  @Prop()
  locale: string = "de";

  @Prop()
  ruleSetConfig?: RuleSetConfig;

  private title: Title = new Title(new IBCSRuleSet());

  render() {
    return (
      <div>
        <div innerHTML={sanitizeHtml(this.title.unit)}></div>
        <div>
          {this.title.measures.map((measure, index) => (
            <span>
              {this.isFirstElement(index) ? this.title.i18n.get("SEPERATOR_WS") : ""}
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
