import { Component, h, Host, Prop, Watch, Element } from "@stencil/core";
import { isBlankInput } from "../../utils/validate";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { pageGeometry, VALID_FORMATS, VALID_ORIENTATIONS } from "./pageFormats";

@Component({
  tag: "bn-page",
  styleUrl: "bn-page.scss",
  shadow: true,
})
export class Page {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * Defines the size of the page
   * <br /><br />
   * values:
   * <br /> ``` xga // hd // full-hd // 4k // 4k2k // a6 // a5 // a4 // a3 // a2 // a1 // a0 // letter // legal // tabloid // ledger ```
   * <br /><br />
   * default: <br /> ```xga```
   */
  @Prop() format: string;

  /**
   * Defines page orientation
   * <br /><br />
   * values:
   * <br /> ``` landscape // portrait ```
   * <br /><br />
   * default:
   * <br /> based on the given format
   */
  @Prop() orientation: string;

  @Watch("format")
  validateFormat(newValue: string) {
    const errId = "ERR_format";
    if (!isBlankInput(newValue) && !VALID_FORMATS.includes(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `format: invalid value '${newValue}' is not supported. Valid values: ${VALID_FORMATS.join(", ")}`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  @Watch("orientation")
  validateOrientation(newValue: string) {
    const errId = "ERR_orientation";
    if (!isBlankInput(newValue) && !VALID_ORIENTATIONS.includes(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `orientation: invalid value '${newValue}' is not supported. Valid values: ${VALID_ORIENTATIONS.join(", ")}`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  componentWillLoad() {
    // the watchers only see a later change
    this.validateFormat(this.format);
    this.validateOrientation(this.orientation);
  }

  render() {
    return (
      <Host format={this.format} orientation={this.orientation} style={this.prepareStyle()}>
        <slot />
      </Host>
    );
  }

  private prepareStyle() {
    const pageStyle: Record<string, string> = {
      "font-family": this.componentStyle(($) => $.global["fontFamily"]),
      "font-size": `${this.componentStyle(($) => $.global["fontSizePx"])}px`,
      "--bn-font-family": this.componentStyle(($) => $.global["fontFamily"]) || "'Noto Sans', sans-serif",
      "--bn-font-size": `${this.componentStyle(($) => $.global["fontSizePx"]) || 13.3333}px`,
      "--bn-font-color": this.componentStyle(($) => $.global["fontColor"]) || "#000000",
      "--bn-font-background": this.componentStyle(($) => $.global["fontBackgroundColor"]) || "#ffffff",
    };

    // an unknown format keeps the default size of the stylesheet
    if (VALID_FORMATS.includes(this.format)) {
      const { width, height } = pageGeometry(this.format, this.orientation);
      pageStyle.width = width;
      pageStyle.height = height;
    }

    return pageStyle;
  }
}
