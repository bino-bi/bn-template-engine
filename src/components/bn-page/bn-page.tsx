import { Component, h, Host, Prop, Watch, Element } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

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
  // @ts-ignore
  validateFormat(newValue: string, oldValue: string) {
    //TODO: add validation
  }

  @Watch("orientation")
  // @ts-ignore
  validateOrientation(newValue: string, oldValue: string) {
    //TODO: add validation
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
