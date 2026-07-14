import { Component, Element, h, Host, Prop } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import { getStores, ScopedStores } from "../../context/context-protocol";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { sanitizeHtml } from "../../utils/sanitizeHtml";

@Component({
  tag: "bn-message",
  styleUrl: "bn-message.scss",
  assetsDirs: ["assets"],
  shadow: true,
})
export class Footer {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
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
   *  Message text. Rendered as HTML, sanitized against XSS
   *  (only safe tags such as `br`, `b`, `i`, `strong`, `em`, `a` and their
   *  attributes are kept; event handlers and `javascript:` URLs are stripped).
   *  <br />Use `<br />` for an explicit line break.
   *  <br />If empty string (`''` or `null`) the message row is omitted
   */
  @Prop({ mutable: true })
  text: string;

  /**
  /**
   *  Url of the cards logo/ pictogram.
   *  <br />
   *  if not http it looks up the url in the components asset folder
   *  <br />
   *  If empty string (`''` or `null`) the image is omitted
   * <br /><br />
   *  example:<br /> ```debug/concordia.png```
   */
  @Prop() readonly image: string;

  prepareAssetUrl(value: string) {
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
    return (
      <Host id={this.text || this.image ? "container-page-message" : "container"} style={this.getFontStyles()}>
        <div id="message-text">
          {this.text != null && this.text !== "" ? <span class="note" innerHTML={sanitizeHtml(this.text)}></span> : ""}
        </div>
        <div id="page-image">
          {this.image != null && this.image !== "" ? <img class="image" src={this.prepareAssetUrl(this.image)} /> : ""}
        </div>
        {/* </div> */}
      </Host>
    );
  }
}
