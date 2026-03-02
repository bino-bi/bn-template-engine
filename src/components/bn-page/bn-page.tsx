import { Component, Host, Prop, Watch, Element } from "@stencil/core";
import { isBlankInput } from "../../utils/validate";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

const VALID_FORMATS = ["xga", "hd", "full-hd", "4k", "4k2k", "a4", "a3", "a2", "a1", "a0", "letter", "legal"];
const VALID_ORIENTATIONS = ["landscape", "portrait"];

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
   * Defines the size of the page
   * <br /><br />
   * values:
   * <br /> ``` xga // hd // full-hd // 4k // 4k2k // a4 // a3 // a2 // a1 // a0 // letter // legal ```
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

  render() {
    return (
      <Host format={this.format} orientation={this.orientation} style={this.prepareStyle()}>
        <slot />
      </Host>
    );
  }

  private prepareStyle() {
    const pageStyle = {
      "font-family": this.componentStyle(($) => $.global["fontFamily"]),
      "font-size": `${this.componentStyle(($) => $.global["fontSizePx"])}px`,
      "--bn-font-family": this.componentStyle(($) => $.global["fontFamily"]) || "'Noto Sans', sans-serif",
      "--bn-font-size": `${this.componentStyle(($) => $.global["fontSizePx"]) || 13.3333}px`,
      "--bn-font-color": this.componentStyle(($) => $.global["fontColor"]) || "#000000",
      "--bn-font-background": this.componentStyle(($) => $.global["fontBackgroundColor"]) || "#ffffff",
    };

    return pageStyle;
  }
}
