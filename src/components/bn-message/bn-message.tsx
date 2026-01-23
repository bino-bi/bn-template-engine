import { Component, Element, h, Host, Prop } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import state from "../../stores/assets";

@Component({
  tag: 'bn-message',
  styleUrl: 'bn-message.scss',
  assetsDirs: ['assets'],
  shadow: true
})
export class Footer {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;

  constructor() {
    withComponentStatus(this);
    this.componentStyle = withComponentStyle(this);
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle($ => ({
      '--bn-font-family': $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      '--bn-font-size': `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      '--bn-font-color': $["global"]?.["fontColor"] || '#000000',
      '--bn-font-background': $["global"]?.["fontBackgroundColor"] || '#ffffff',
    }));
  }

  /**
  *  Message text.
  *  <br />If empty string (`''` or `null`) the footer row is omitted
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
    if (value == null || value == "") {
      return "";
    }
    // for backward compatibility deprecated "asset:" prefix
    if (value.startsWith("asset:")) {
      return state[value.substring(6)] // TODO: will not work with IE11 (state proxie is not available) )
    }

    return state[value] || value;
  }


  render() {
    return <Host id={(this.text || this.image) ? "container-page-message" : "container"} style={this.getFontStyles()}>
      <div id="message-text">
        {
          this.text != null && this.text != "" ? <span class="note">{this.text}</span> : ""
        }
      </div>
      <div id="page-image">
        {
          this.image != null && this.image != "" ? <img class="image" src={this.prepareAssetUrl(this.image)} /> : ""
        }
      </div>
      {/* </div> */}
    </Host>
  }

}
