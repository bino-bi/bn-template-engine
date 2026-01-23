import { Component, Element, getAssetPath, h, Host, Prop } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";

@Component({
  tag: 'bn-footer',
  styleUrl: 'bn-footer.scss',
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
   *  Pagenumber value.
   *  Is displayed if displayPageNumber == true
   */
  @Prop({ mutable: true })
  pageNumber: number | null = null;

  /**
   *  Footer text.
   *  <br />If empty string (`''` or `null`) the footer row is omitted
   */
  @Prop({ mutable: true })
  text: string;

  /**
   *  code .
   *  <br />If empty string (`''` or `null`) the footer row is omitted
   */
  @Prop({ mutable: true })
  code: string;

  /**
   *  Toggle if pagenumer label is displayed
   */
  @Prop()
  displayPageNumber: boolean = true;

  isValidHttpUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }

  prepareAssetUrl(imgUrl: string) {
    if (this.isValidHttpUrl(imgUrl)) {
      return imgUrl
    }
    return `./assets/${imgUrl}.png`
  }

  render() {
    return <Host id={(this.displayPageNumber || this.text || this.code) ? "container-page-footer" : "container"} style={this.getFontStyles()}>
      <div id="footer-text">
        {
          this.text != null ? <span class="note">{this.text}</span> : ""
        }
      </div>
      <div id="code">
        {
          this.code != null ? <img class="image" src={getAssetPath(`${this.prepareAssetUrl(this.code)}`)} /> : ""
        }
      </div>
      <div id="page-number">
        {
          this.displayPageNumber ? <span class="page">{this.pageNumber}</span> : ""
        }
      </div>
      {/* </div> */}
    </Host>
  }

}
