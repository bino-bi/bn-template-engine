import { Component, Element, h, Host, Prop } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-footer",
  styleUrl: "bn-footer.scss",
  shadow: true,
})
export class Footer {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle(($) => ({
      "--bn-font-family": $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      "--bn-font-size": `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      "--bn-font-color": $["global"]?.["fontColor"] || "#000000",
      "--bn-font-background": $["global"]?.["fontBackgroundColor"] || "#ffffff",
    }));
  }

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   *  Page label: a number or any text, e.g. `3` or `A-1`.
   *  Is displayed if displayPageNumber == true
   */
  @Prop({ mutable: true })
  pageNumber: string | null = null;

  /**
   *  Footer text.
   *  <br />If empty string (`''` or `null`) the footer row is omitted
   */
  @Prop({ mutable: true })
  text: string;

  /**
   *  Toggle if pagenumer label is displayed
   */
  @Prop()
  displayPageNumber: boolean = true;

  render() {
    return (
      <Host
        id={this.displayPageNumber || this.text ? "container-page-footer" : "container"}
        style={this.getFontStyles()}
      >
        <div id="footer-text">{this.text != null ? <span class="note">{this.text}</span> : ""}</div>
        <div id="page-number">{this.displayPageNumber ? <span class="page">{this.pageNumber}</span> : ""}</div>
        {/* </div> */}
      </Host>
    );
  }
}
