import { Component, h, Element, Prop, Method, Fragment } from "@stencil/core";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-layout-page",
  styleUrl: "bn-layout-page.scss",
  shadow: true,
})
export class LayoutPage {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    this.errors = withHasError(this);
  }

  /**
   * JSON string of component-style overrides passed through to the inner
   * `<bn-page>` element. Typically set via a `ComponentStyle` manifest
   * rather than directly on the component.
   */
  @Prop() styles?: string;

  /**
   * Name of a registered component style (see `bn-component-style`) passed
   * through to the inner `<bn-page>` element as its `selected-style`
   * attribute.
   */
  @Prop() selectedStyle?: string;

  /**
   * Message text displayed in the message row above the title.
   * If empty, the message row is omitted.
   */
  @Prop() messageText: string = "";

  /**
   * URL or asset name of the image displayed in the message row.
   * If the value is not an HTTP URL it is looked up in the asset store.
   * If empty, the image is omitted.
   *
   * @example
   * <bn-layout-page message-image="debug/concordia.png"></bn-layout-page>
   */
  @Prop() messageImage: string = "";

  /**
   * Name of the business unit displayed in the title header row.
   * If empty, the business unit row is omitted.
   *
   * @example
   * <bn-layout-page title-business-unit="Group Controlling"></bn-layout-page>
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
   * <bn-layout-page title-measures='[{"name":"Revenue","unit":"mEUR"}]'></bn-layout-page>
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
   * Page size format. Determines the pixel dimensions of the rendered page.
   * <br /><br />
   * values:<br />
   * ```xga // hd // full-hd // 4k // 4k2k // a4 // a3 // a2 // a1 // a0 // letter // legal```
   */
  @Prop() pageFormat?: string;

  /**
   * Page orientation. Default depends on the chosen format.
   * <br /><br />
   * values:<br />
   * ```landscape // portrait```
   */
  @Prop() pageOrientation?: string;

  /**
   * Page number displayed in the footer. If empty, no page number is shown
   * (unless `footerDisplayPageNumber` is also set).
   */
  @Prop() pageNumber?: string;

  /**
   * Text displayed in the page footer. If empty, the footer text is omitted.
   */
  @Prop() footerText?: string;

  /**
   * Whether to display the page number in the footer.
   */
  @Prop() footerDisplayPageNumber?: boolean = true;

  /**
   * Layout mode that controls how child components are arranged in the
   * page body using CSS Grid.
   * <br /><br />
   * values:<br />
   * ```full // split-vertical // split-horizontal // 2x2 // 3x3 // 4x4 // 1-over-2 // 1-over-3 // 2-over-1 // 3-over-1 // custom-template```
   * <br /><br />
   * `full`: single slot. `split-vertical`: two side-by-side slots.
   * `split-horizontal`: two stacked slots. `NxN`: equal grid.
   * `1-over-2`: one full-width slot on top, two below. `custom-template`:
   * uses the `pageCustomTemplate` CSS grid-template-areas string.
   *
   * @example
   * <bn-layout-page page-layout="2x2"></bn-layout-page>
   */
  @Prop() pageLayout:
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
   * CSS `grid-template-areas` string used when `pageLayout` is set to
   * `custom-template`. Each quoted row defines a grid row; letters map to
   * slot indices in order of first appearance.
   *
   * @example
   * <bn-layout-page page-layout="custom-template"
   *   page-custom-template='"a a" "b c"'></bn-layout-page>
   */
  @Prop() pageCustomTemplate: string = '"a b" "c d"';

  /**
   * Gap between grid cells in pixels.
   */
  @Prop() pageGridGap: string = "0";

  /**
   * When `true`, the page body height shrinks to fit its content
   * (`fit-content`). When `false` (default), the body stretches to
   * fill the full page height (`100%`). Width is always `100%`
   * regardless of this setting.
   * <br /><br />
   * Use `false` (default) when the page contains components with
   * auto-scaling (e.g. `unit-scaling="auto"` or `scale="auto"`),
   * because auto-scaling needs a fixed parent height to calculate
   * dimensions.
   */
  @Prop() pageFitToContent: boolean = false;

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

    if (this.pageFitToContent === true) {
      height = "fit-content";
    }

    // Width is always 100% — page width is fixed by page format (XGA, A4, etc.).
    // Using fit-content for width makes the grid indefinite, causing CSS Grid to
    // treat percentage column tracks as "auto" (content-sized), which breaks
    // equal column splits and auto-scaling in child components.
    return {
      display: "grid",
      height: height,
      width: "100%",
      gap: this.pageGridGap + "px",
    };
  }

  private getRowCount(name: string): number {
    const template = this.getTemplateAreas(name);
    const pattern = /"[\w\d\s.]+"/g;
    const matches = template.match(pattern);
    return matches ? matches.length : 1;
  }

  private getGridTemplateRows(name: string): string {
    const rowCount = this.getRowCount(name);

    if (this.pageFitToContent) {
      return Array(rowCount).fill("auto").join(" ");
    }
    // minmax(0, 1fr) allows rows to shrink below their content height.
    // Plain 1fr = minmax(auto, 1fr) which grows rows to fit content,
    // breaking overflow:hidden on slot wrappers and causing charts
    // inside cards to push the grid cell beyond its intended share.
    return Array(rowCount).fill("minmax(0, 1fr)").join(" ");
  }

  private getLayoutStyle() {
    return {
      ...this.getCommonStyles(),
      "grid-template-areas": this.getTemplateAreas(this.pageLayout),
      "grid-template-columns": this.getGridTemplateColumns(this.pageLayout),
      "grid-template-rows": this.getGridTemplateRows(this.pageLayout),
    };
  }

  private createDivAreaStyles(elements: string[]) {
    return elements.map((x) => ({
      // display:flex (row direction) makes slotted children stretch
      // vertically via align-items:stretch (default). This constrains
      // cards/charts to the grid cell height instead of growing to
      // content size. Column direction would only stretch horizontally.
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
              <slot name={"slot-" + index}></slot>
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

  private getTemplateAreas(name: string): string {
    if (this.templateMap.has(name) === false && name !== "custom-template") {
      return '"a"';
    }

    if (name === "custom-template") {
      return this.pageCustomTemplate;
    }

    return this.templateMap.get(name);
  }

  private calculateFractions(input: string): string {
    const items = input.trim().split(/\s+/);
    const count = items.length;

    if (count === 0) return "minmax(0, 1fr)";

    return Array(count).fill("minmax(0, 1fr)").join(" ");
  }
  private getGridTemplateColumns(name: string): string {
    if (this.templateMap.has(name) === false && name !== "custom-template") {
      return "1fr";
    }
    let template;
    const pattern = /"[\w\d\s.]+"/g;

    if (name === "custom-template") {
      template = this.pageCustomTemplate;
    } else {
      template = this.templateMap.get(name);
    }

    const matches = template.match(pattern);
    return this.calculateFractions(matches[0]);
  }

  @Method()
  async getNumberOfSlot(name: string) {
    const template = this.getTemplateAreas(name);
    return this.extractSlotNames(template).length;
  }

  componentDidUpdate() {
    // workaround for the render rotation issue
    const renderOrientation = this.element.closest("bn-context").getAttribute("render-orientation");
    if (renderOrientation && renderOrientation !== this.pageOrientation) {
      const page = this.element.shadowRoot.querySelector("bn-page");
      const layout = this.element.closest("bn-layout-page");
      if (layout && page) {
        page.style.transform = "rotate(-90deg) translate(-100%)";
        page.style.transformOrigin = "top left";
        layout.style.width = `${page.clientHeight}px`;
        layout.style.height = `${page.clientWidth}px`;
      }
    }
  }

  render() {
    const style = this.getLayoutStyle();
    const arrOfSlots: string[] = this.extractSlotNames(style["grid-template-areas"]);

    return (
      <bn-page // @ts-ignore
        styles={this.styles}
        selected-style={this.selectedStyle}
        format={this.pageFormat}
        orientation={this.pageOrientation}
      >
        <bn-message text={this.messageText} image={this.messageImage}></bn-message>
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
        <bn-body>
          {/* data-bn-fit-content: tells auto-scaling components that heights
              inside this grid are content-driven and unusable as a scaling
              reference; the value is the grid's row count so they can fall
              back to an equal-share cell height
              (see findConstrainedHeight in utils/parentDimensions) */}
          <div
            style={style}
            data-bn-fit-content={this.pageFitToContent ? String(this.getRowCount(this.pageLayout)) : null}
          >
            {this.getSlots(arrOfSlots)}
          </div>
        </bn-body>
        <bn-footer
          text={this.footerText}
          page-number={this.pageNumber}
          display-page-number={this.footerDisplayPageNumber}
        ></bn-footer>
      </bn-page>
    );
  }
}
