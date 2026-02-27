import { Component, Element, h, Host, Prop } from "@stencil/core";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import state from "../../stores/assets";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-image",
  styleUrl: "bn-image.scss",
  shadow: true,
})
export class Image {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withStyled(this);
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
  /**
   *  Url of the image.
   *  <br />
   *  if not http it looks up the url in the components asset folder
   *  <br />
   *  If empty string (`''` or `null`) the image is omitted
   * <br /><br />
   *  example:<br /> ```debug/concordia.png```
   */
  @Prop() readonly source: string;

  prepareAssetUrl(value: string) {
    if (value == null || value == "") {
      return "";
    }
    // for backward compatibility deprecated "asset:" prefix
    if (value.startsWith("asset:")) {
      return state[value.substring(6)]; // TODO: will not work with IE11 (state proxie is not available) )
    }

    return state[value] || value;
  }

  render() {
    return (
      <Host style={this.getFontStyles()}>
        {this.source != null && this.source != "" ? <img src={this.prepareAssetUrl(this.source)} /> : ""}
      </Host>
    );
  }
}
