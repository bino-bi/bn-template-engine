import { Component, h, Host, Element, Prop, Fragment } from "@stencil/core";
import { sheetGeometry } from "../bn-page/pageFormats";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import {
  CUSTOM_TEMPLATE,
  isTemplateLayout,
  templateAreas,
  templateColumns,
  templateProblem,
  templateRows,
  templateSlotNames,
} from "../../utils/layoutTemplate";

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
    withComponentStatus(this);
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
   * Name of a registered IBCS rule set (see `bn-ruleset`) passed through to
   * the inner `<bn-title>` element as its `ruleset` attribute. Nested
   * visualization components can reference it via
   * `ruleset="inherited-page"` / `ruleset="inherited-closest"`.
   */
  @Prop() ruleset?: string;

  /**
   * Message text displayed in the message row above the title.
   * If empty, the message row is omitted.
   *
   * Rendered as sanitized HTML, so inline markup is supported.
   *
   * @example
   * <bn-layout-page message-text="Revenue <b>above plan</b><br />Q3 2026"></bn-layout-page>
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
   * Short id of the page, a template number like `13A`. Shown at the top
   * right of the title, on the level of its first line, in the font of the
   * title and not bold. If empty, nothing is shown.
   *
   * @example
   * <bn-layout-page title-id="13A"></bn-layout-page>
   */
  @Prop() titleId?: string;

  /**
   * Name of the business unit displayed in the title header row.
   * If empty, the business unit row is omitted.
   *
   * Rendered as sanitized HTML, so inline markup is supported.
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
   * (ScenarioA − ScenarioB). The pos/neg/neu/op/opinv postfix defines
   * which direction is considered "good". op follows the row operation
   * in opt tables, opinv is its inverse.
   * <br /><br />
   * If empty, variance indicators are hidden.
   * <br /><br />
   * pattern:<br />
   * ```d<scenarioB>_<scenarioA>_[pos/neg/neu/op/opinv]```
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
   * Applies to the title only.
   *
   * @deprecated Use `i18nNamespace` instead.
   */
  @Prop() titleNamespace: string;

  /**
   * I18n namespace for this page's title and, via default inheritance, every
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
   * Page size format. Determines the pixel dimensions of the rendered page.
   * <br /><br />
   * values:<br />
   * ```xga // hd // full-hd // 4k // 4k2k // a6 // a5 // a4 // a3 // a2 // a1 // a0 // letter // legal // tabloid // ledger```
   */
  @Prop() pageFormat?: string;

  /**
   * Page orientation. Default depends on the chosen format.
   * When it differs from the `render-orientation` of `bn-context`, the page is turned onto the sheet.
   * <br /><br />
   * values:<br />
   * ```landscape // portrait```
   */
  @Prop() pageOrientation?: string;

  /**
   * Page label displayed in the footer: a number or any text, e.g. `A-1`.
   * Without it `bn-context` numbers the page by its position.
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

  private getCommonStyles() {
    let height = "100%";

    if (this.pageFitToContent === true) {
      height = "fit-content";
    }

    // Width is always 100% - page width is fixed by page format (XGA, A4, etc.).
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
    return templateRows(this.getTemplateAreas(name)).length || 1;
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
    return templateSlotNames(styleElement);
  }

  private getTemplateAreas(name: string): string {
    return templateAreas(name, this.pageCustomTemplate);
  }

  private getGridTemplateColumns(name: string): string {
    // a layout without a template, such as "full", is one column that may grow with its content
    return isTemplateLayout(name) ? templateColumns(this.getTemplateAreas(name)) : "1fr";
  }

  private mirror(attribute: string, value: string | null | undefined): void {
    if (value == null) {
      if (this.element.hasAttribute(attribute)) this.element.removeAttribute(attribute);
    } else if (this.element.getAttribute(attribute) !== value) {
      this.element.setAttribute(attribute, value);
    }
  }

  componentWillRender() {
    // bn-context reads the paper size of the document from these attributes and watches them.
    // Written by hand: the reflection of Stencil skips an attribute that was in the markup at the first render.
    // Before the render, not after it: the first componentDidRender waits for every component inside the page.
    this.mirror("page-format", this.pageFormat);
    this.mirror("page-orientation", this.pageOrientation);

    const problem = this.pageLayout === CUSTOM_TEMPLATE ? templateProblem(this.pageCustomTemplate) : undefined;
    if (problem) {
      this.errors.addOrReplace({
        id: "WARN_pageCustomTemplate",
        type: "warning",
        message: `pageCustomTemplate: ${problem}`,
      });
    } else {
      this.errors.remove("WARN_pageCustomTemplate");
    }
  }

  /**
   * A document is printed in one orientation, the `render-orientation` of
   * `bn-context`. A page with the other orientation keeps its own layout and
   * is turned onto the sheet: the host takes the swapped size, the inner page
   * is rotated into it.
   */
  private rotation(): { host: Record<string, string>; page: Record<string, string> } | undefined {
    const renderOrientation = this.element.closest("bn-context")?.getAttribute("render-orientation");
    const sheet = sheetGeometry(this.pageFormat, this.pageOrientation, renderOrientation);
    if (!sheet.turned) {
      return undefined;
    }

    return {
      host: { width: sheet.width, height: sheet.height },
      page: { transform: "rotate(-90deg) translate(-100%)", transformOrigin: "top left" },
    };
  }

  render() {
    const style = this.getLayoutStyle();
    const arrOfSlots: string[] = this.extractSlotNames(style["grid-template-areas"]);
    const rotation = this.rotation();

    return (
      <Host style={rotation?.host}>
        <bn-page // @ts-ignore
          styles={this.styles}
          selected-style={this.selectedStyle}
          format={this.pageFormat}
          orientation={this.pageOrientation}
          style={rotation?.page}
        >
          <bn-message text={this.messageText} image={this.messageImage}></bn-message>
          <bn-title // @ts-ignore
            i18n-namespace={this.i18nNamespace ?? this.titleNamespace}
            ruleset={this.ruleset}
            title-id={this.titleId}
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
            <slot name="annotations"></slot>
          </bn-body>
          <bn-footer
            text={this.footerText}
            page-number={this.pageNumber}
            display-page-number={this.footerDisplayPageNumber}
          ></bn-footer>
        </bn-page>
      </Host>
    );
  }
}
