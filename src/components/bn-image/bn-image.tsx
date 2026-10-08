import { Component, Element, h, Host, Prop } from "@stencil/core";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import { getStores, ScopedStores } from "../../context/context-protocol";
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

  private stores: ScopedStores;

  constructor() {
    withStyled(this);
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
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

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
      <Host style={this.getFontStyles()}>
        {this.source != null && this.source !== "" ? <img src={this.prepareAssetUrl(this.source)} /> : ""}
      </Host>
    );
  }
}
