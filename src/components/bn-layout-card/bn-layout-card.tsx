import { Component, h, Element, Prop, Method, Fragment } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-layout-card",
  styleUrl: "bn-layout-card.scss",
  shadow: true,
})
export class LayoutCard {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;

  constructor() {
    this.errors = withHasError(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
  }

  /**
   * JSON string of component-style overrides passed through to the inner
   * `<bn-card>` element. Typically set via a `ComponentStyle` manifest
   * rather than directly on the component.
   */
  @Prop() styles?: string;

  /**
   * URL or asset name of the image displayed next to the card title.
   * The value is resolved via the scoped assets store: if it matches a
   * registered asset name, the stored URL is used; otherwise the raw value
   * is treated as a URL. The deprecated `asset:` prefix is still supported
   * for backward compatibility.
   * <br /><br />
   * If empty, the title image is omitted.
   *
   * @example
   * <bn-layout-card title-image="company_logo"></bn-layout-card>
   */
  @Prop() titleImage: string = "";

  /**
   * Name of the business unit displayed in the title header row.
   * If empty, the business unit row is omitted.
   *
   * @example
   * <bn-layout-card title-business-unit="Sales"></bn-layout-card>
   */
  @Prop() titleBusinessUnit: string = "";

  /**
   * List of scenarios displayed in the title header.
   * <br /><br />
   * Comma-separated string or omitted. If empty, the scenarios row is omitted.
   * <br /><br />
   * values:<br />
   * ```ac // fc // py // pl```
   */
  @Prop() titleScenarios?: string;

  /**
   * List of variances calculated from the given scenarios.
   * The scenarios used in the variances must also be defined in
   * the `titleScenarios` property. The variance is defined as
   * (ScenarioA − ScenarioB). The pos/neg/neu postfix defines
   * which direction is considered "good".
   * <br /><br />
   * If empty, variance indicators are hidden.
   * <br /><br />
   * pattern:<br />
   * ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```
   */
  @Prop() titleVariances?: string;

  /**
   * Primary column on which the order direction is applied.
   * <br /><br />
   * values:<br />
   * ```category // categoryindex // rowgroup // rowgroupindex // ac // fc // py // pl```
   */
  @Prop() titleOrder: string = "category";

  /**
   * Sorting order direction for the column specified by `titleOrder`.
   * <br /><br />
   * values:<br />
   * ```asc // desc```
   */
  @Prop() titleOrderDirection: string = "asc";

  /**
   * Array of measure objects with `name` and `unit` displayed in the title.
   * Passed as a JSON string. If all units are the same, redundant units are
   * reduced and names concatenated. If empty, the measure row is omitted.
   *
   * @example
   * <bn-layout-card title-measures='[{"name":"Revenue","unit":"mEUR"}]'></bn-layout-card>
   */
  @Prop() titleMeasures?: string;

  /**
   * Start date displayed in the title date row.
   * Accepts `yyyy-MM-dd` (e.g. `2024-01-01`) or ISO 8601 datetime
   * (e.g. `2024-01-01T14:30:00Z`).
   */
  @Prop() titleDateStart?: string;

  /**
   * End date displayed in the title date row.
   * Accepts `yyyy-MM-dd` (e.g. `2024-12-31`) or ISO 8601 datetime
   * (e.g. `2024-12-31T23:59:59Z`).
   */
  @Prop() titleDateEnd?: string;

  /**
   * Date display format used in the title row.
   * <br /><br />
   * values:<br />
   * ```year // quarter // month // week // day // time // auto // none```
   * <br /><br />
   * `year`: YYYY, `quarter`: Q[Q] YYYY, `month`: MMM YYYY,
   * `week`: [KW]WW YYYY, `day`: DD.MM.YYYY, `time`: DD.MM.YYYY HH:mm:ss,
   * `auto`: automatic detection, `none`: DD.MM.YYYY.
   */
  @Prop() titleDateFormat: string = "none";

  /**
   * Format in which the start and end dates are linked in the title.
   * If set to `none` a plain date is shown.
   * <br /><br />
   * values:<br />
   * ```avg // interval // cum // start // end // ytd // ytg // mat // none```
   * <br /><br />
   * `avg`: Ø[DATE], `interval`: [DATE]..[DATE2], `start`: .[DATE],
   * `end`: [DATE]., `ytd`: _[DATE], `ytg`: [DATE]_, `cum`: [DATE]_[DATE2],
   * `mat`: ~[DATE], `none`: [DATE].
   */
  @Prop() titleDateLink: string = "none";

  /**
   * Namespace used for title translations via the internationalization store.
   */
  @Prop() titleNamespace: string = "_system";

  /**
   * Text displayed in the card footer. If empty, the footer text is omitted.
   */
  @Prop() footerText?: string = "";

  /**
   * Layout mode that controls how child components are arranged inside
   * the card body using CSS Grid.
   * <br /><br />
   * values:<br />
   * ```full // split-vertical // split-horizontal // 2x2 // 3x3 // 4x4 // 1-over-2 // 1-over-3 // 2-over-1 // 3-over-1 // custom-template```
   * <br /><br />
   * `full`: single slot. `split-vertical`: two side-by-side slots.
   * `split-horizontal`: two stacked slots. `NxN`: equal grid.
   * `1-over-2`: one full-width slot on top, two below. `custom-template`:
   * uses the `cardCustomTemplate` CSS grid-template-areas string.
   *
   * @example
   * <bn-layout-card card-layout="split-horizontal"></bn-layout-card>
   */
  @Prop() cardLayout:
    | "full"
    | "split-vertical"
    | "split-horizontal"
    | "2x2"
    | "3x3"
    | "4x4"
    | "1-over-2"
    | "1-over-3"
    | "2-over-1"
    | "3-over-1"
    | "custom-template" = "full";

  /**
   * CSS `grid-template-areas` string used when `cardLayout` is set to
   * `custom-template`. Each quoted row defines a grid row; letters map to
   * slot indices in order of first appearance.
   *
   * @example
   * <bn-layout-card card-layout="custom-template"
   *   card-custom-template='"a a" "b c"'></bn-layout-card>
   */
  @Prop() cardCustomTemplate: string = '"a b" "c d"';

  /**
   * Gap between grid cells in pixels.
   */
  @Prop() cardGridGap: string = "0";

  /**
   * When `true`, the card shrinks to fit its content (`fit-content`)
   * for both width and height. When `false`, the card stretches to
   * fill its parent (`100%`).
   */
  @Prop() cardFitToContent: boolean = true;

  /**
   * Whether to display a visible border around the card.
   */
  @Prop() cardShowBorder: boolean = true;

  private templateMap = new Map([
    ["split-vertical", '"a  b"'],
    ["split-horizontal", '"a" "b"'],
    ["2x2", '"a b" "c d"'],
    ["3x3", '"a b c" "d e f" "g h i"'],
    ["4x4", '"a b c d" "e f g h" "i j k l" "m n o p"'],
    ["1-over-2", '"a a" "b c"'],
    ["2-over-1", '"a b" "c c"'],
    ["1-over-3", '"a a a " "b c d"'],
    ["3-over-1", '"a b c" "d d d"'],
    ["custom-template", '"a b" "c c c"'],
    ["gold3", '"a c" "b c"'],
    ["gold4", '"a b c c" "d d c c"'],
  ]);

  private getCommonStyles() {
    let height = "100%";
    let width = "100%";

    if (this.cardFitToContent === true) {
      width = "fit-content";
      height = "fit-content";
    }

    return {
      display: "grid",
      height: height,
      width: width,
      gap: this.cardGridGap + "px",
    };
  }

  private calculatePercentages(input: string): string {
    const items = input.trim().split(/\s+/);
    const count = items.length;

    if (count === 0) return "100%";

    const percentage = (100 / count).toFixed(0) + "%";

    return Array(count).fill(percentage).join(" ");
  }

  private getGridTemplateColumns(name: string): string {
    const template = this.getTemplatePattern(name);
    const pattern = /"[\w\d\s.]+"/g;
    const matches = template.match(pattern);
    if (!matches || matches.length === 0) return "100%";
    return this.calculatePercentages(matches[0]);
  }

  private getGridTemplateRows(name: string): string {
    const template = this.getTemplatePattern(name);
    const pattern = /"[\w\d\s.]+"/g;
    const matches = template.match(pattern);
    const rowCount = matches ? matches.length : 1;

    if (this.cardFitToContent) {
      return Array(rowCount).fill("auto").join(" ");
    }
    return Array(rowCount).fill("1fr").join(" ");
  }

  private getLayoutStyle() {
    return {
      ...this.getCommonStyles(),
      "grid-template-areas": this.getTemplatePattern(this.cardLayout),
      "grid-template-columns": this.getGridTemplateColumns(this.cardLayout),
      "grid-template-rows": this.getGridTemplateRows(this.cardLayout),
    };
  }

  private createDivAreaStyles(elements: string[]) {
    return elements.map((x) => ({
      width: "100%",
      overflow: "hidden",
      "grid-area": x,
      height: "100%",
    }));
  }

  private getSlots(slotNames: string[]) {
    const items = this.createDivAreaStyles(slotNames);

    return (
      <Fragment>
        {items.map((value, index) => {
          return (
            <div style={value}>
              <slot name={"card-slot-" + index}></slot>
            </div>
          );
        })}
      </Fragment>
    );
  }

  private extractSlotNames(styleElement: string | null) {
    if (styleElement == null) {
      return [];
    }

    const words = styleElement.match(/\b\w+\b/g);
    if (!words) {
      return [];
    }

    return Array.from(new Set(words));
  }

  private getTemplatePattern(name: string): string {
    if (this.templateMap.has(name) === false && name !== "custom-template") {
      return '"a"';
    }

    if (name === "custom-template") {
      return this.cardCustomTemplate;
    }

    return this.templateMap.get(name);
  }

  @Method()
  async getNumberOfSlot(name: string) {
    const template = this.getTemplatePattern(name);
    return this.extractSlotNames(template).length;
  }

  componentDidUpdate() {
    // workaround for the render rotation issue
  }

  setCardClass(): string {
    if (this.cardShowBorder === true) {
      return "card_box border";
    }
    return "card_box";
  }

  prepareTitleImage(value: string) {
    if (value == null || value === "") {
      return "";
    }
    const assetsState = this.stores.assets.state;
    // for backward compatibility deprecated "asset:" prefix
    if (value.startsWith("asset:")) {
      return assetsState[value.substring(6)];
    }

    return assetsState[value] || value;
  }

  render() {
    const style = this.getLayoutStyle();
    const arrOfSlots: string[] = this.extractSlotNames(style["grid-template-areas"]);
    return (
      // @ts-ignore
      <bn-card styles={this.styles} class={this.setCardClass()}>
        <div class="cardtitle">
          <bn-title // @ts-ignore
            namespace={this.titleNamespace}
            business-unit={this.titleBusinessUnit}
            scenarios={this.titleScenarios}
            variances={this.titleVariances}
            order={this.titleOrder}
            order-direction={this.titleOrderDirection}
            measures={this.titleMeasures}
            date-start={this.titleDateStart}
            date-end={this.titleDateEnd}
            date-format={this.titleDateFormat}
            date-link={this.titleDateLink}
          ></bn-title>
          {this.titleImage != null && this.titleImage !== "" ? (
            <img class="image" src={this.prepareTitleImage(this.titleImage)} />
          ) : (
            ""
          )}
        </div>
        <bn-body>
          <div style={style}>{this.getSlots(arrOfSlots)}</div>
        </bn-body>
        <bn-footer text={this.footerText} page-number={0} display-page-number={"false"}></bn-footer>
      </bn-card>
    );
  }
}
