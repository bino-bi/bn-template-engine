import { Component, h, Element, Prop, Method, Fragment } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import withInheritedProps, { InheritedResolver } from "../../utils/withInheritedProps";

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
  private readonly resolveInherited: InheritedResolver;

  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.resolveInherited = withInheritedProps(this, [
      { propName: "titleScenarios", ancestorAttr: "title-scenarios" },
      { propName: "titleVariances", ancestorAttr: "title-variances" },
      { propName: "titleOrder", ancestorAttr: "title-order" },
      { propName: "titleOrderDirection", ancestorAttr: "title-order-direction" },
      { propName: "ruleset", ancestorAttr: "ruleset" },
    ]);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
    // Reflect resolved inherited values to host attributes so child vis
    // components can read them during their own DOM traversal.
    this.reflectInheritedAttrs();
  }

  /**
   * JSON string of component-style overrides passed through to the inner
   * `<bn-card>` element. Typically set via a `ComponentStyle` manifest
   * rather than directly on the component.
   */
  @Prop() styles?: string;

  /**
   * Name of a registered component style (see `bn-component-style`) passed
   * through to the inner `<bn-card>` element as its `selected-style`
   * attribute.
   */
  @Prop() selectedStyle?: string;

  /**
   * Name of a registered IBCS rule set (see `bn-ruleset`) passed through to
   * the inner `<bn-title>` element as its `ruleset` attribute. Supports
   * `"inherited-page"` to take over the value from an ancestor
   * `bn-layout-page`. Nested visualization components can reference it via
   * `ruleset="inherited-closest"`.
   */
  @Prop() ruleset?: string;

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
   * Rendered as sanitized HTML, so inline markup is supported.
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
   * Applies to the title only.
   *
   * @deprecated Use `i18nNamespace` instead.
   */
  @Prop() titleNamespace: string;

  /**
   * I18n namespace for this card's title and, via default inheritance, every
   * descendant component (their own `i18n-namespace` wins). Reflected so
   * descendants can resolve it from the `i18n-namespace` attribute. Takes
   * precedence over the deprecated `titleNamespace`.
   *
   * The attribute name is pinned: Stencil's default dash-casing would turn
   * `i18nNamespace` into `i-1-8n-namespace`, which `findAncestorWithAttr` does
   * not match, silently breaking inheritance for anyone setting the property.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace: string;

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
   * When `true`, the card body height shrinks to fit its content
   * (`fit-content`). When `false` (default), the card stretches to
   * fill its parent (`100%`). Width is always `100%` regardless
   * of this setting.
   * <br /><br />
   * Use `false` (default) when the card contains components with
   * auto-scaling (e.g. `unit-scaling="auto"` or `scale="auto"`),
   * because auto-scaling needs a fixed parent height to calculate
   * dimensions.
   */
  @Prop() cardFitToContent: boolean = false;

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

    if (this.cardFitToContent === true) {
      height = "fit-content";
    }

    // Width is always 100% - the card is bounded by its parent grid cell.
    // Using fit-content for width creates a circular dependency where the
    // card width depends on child content but children need the card width
    // for auto-scaling.
    return {
      display: "grid",
      height: height,
      width: "100%",
      gap: this.cardGridGap + "px",
    };
  }

  private calculateFractions(input: string): string {
    const items = input.trim().split(/\s+/);
    const count = items.length;

    if (count === 0) return "minmax(0, 1fr)";

    return Array(count).fill("minmax(0, 1fr)").join(" ");
  }

  private getGridTemplateColumns(name: string): string {
    const template = this.getTemplatePattern(name);
    const pattern = /"[\w\d\s.]+"/g;
    const matches = template.match(pattern);
    if (!matches || matches.length === 0) return "minmax(0, 1fr)";
    return this.calculateFractions(matches[0]);
  }

  private getRowCount(name: string): number {
    const template = this.getTemplatePattern(name);
    const pattern = /"[\w\d\s.]+"/g;
    const matches = template.match(pattern);
    return matches ? matches.length : 1;
  }

  private getGridTemplateRows(name: string): string {
    const rowCount = this.getRowCount(name);

    if (this.cardFitToContent) {
      return Array(rowCount).fill("auto").join(" ");
    }
    // minmax(0, 1fr) allows rows to shrink below content height.
    // Plain 1fr = minmax(auto, 1fr) which grows rows to fit content,
    // breaking overflow constraints on the slot wrappers.
    return Array(rowCount).fill("minmax(0, 1fr)").join(" ");
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
      display: "flex",
      overflow: "hidden",
      "grid-area": x,
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

  /**
   * When the card itself inherits a title prop from a page, write the
   * resolved value back to the host element's attribute so that child
   * vis components (bn-table, bn-chart-*) performing their own DOM walk
   * read the actual value instead of the literal "inherited-page" keyword.
   */
  private reflectInheritedAttrs() {
    const mappings: { prop: string; attr: string }[] = [
      { prop: "titleScenarios", attr: "title-scenarios" },
      { prop: "titleVariances", attr: "title-variances" },
      { prop: "titleOrder", attr: "title-order" },
      { prop: "titleOrderDirection", attr: "title-order-direction" },
      { prop: "ruleset", attr: "ruleset" },
    ];
    for (const { prop, attr } of mappings) {
      const resolved = this.resolveInherited(prop, this[prop]);
      if (resolved.inherited) {
        this.element.setAttribute(attr, resolved.value);
      }
    }
  }

  /** The value of a prop for the inner title. An unresolved keyword reaches it as blank. */
  private titleProp(prop: string): string {
    return this.resolveInherited(prop, this[prop], "").value;
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
      <bn-card // @ts-ignore
        styles={this.styles}
        selected-style={this.selectedStyle}
        class={this.setCardClass()}
      >
        <div class="cardtitle">
          <bn-title // @ts-ignore
            i18n-namespace={this.i18nNamespace ?? this.titleNamespace}
            ruleset={this.titleProp("ruleset")}
            business-unit={this.titleBusinessUnit}
            scenarios={this.titleProp("titleScenarios")}
            variances={this.titleProp("titleVariances")}
            order={this.titleProp("titleOrder")}
            order-direction={this.titleProp("titleOrderDirection")}
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
          {/* data-bn-fit-content: tells auto-scaling components that heights
              inside this grid are content-driven and unusable as a scaling
              reference; the value is the grid's row count so they can fall
              back to an equal-share cell height
              (see findConstrainedHeight in utils/parentDimensions) */}
          <div
            style={style}
            data-bn-fit-content={this.cardFitToContent ? String(this.getRowCount(this.cardLayout)) : null}
          >
            {this.getSlots(arrOfSlots)}
          </div>
        </bn-body>
        <bn-footer text={this.footerText} page-number="0" display-page-number={"false"}></bn-footer>
      </bn-card>
    );
  }
}
