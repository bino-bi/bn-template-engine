import {Component, getAssetPath, h, Host, Prop} from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-footer',
  styleUrl: 'bn-footer.scss',
  assetsDirs: ['assets']
})
export class Footer {
  constructor() {
    withComponentStatus(this);

  }

  /**
   *  Pagenumber value.
   *  Is displayed if displayPageNumber == true
   */
  @Prop({mutable: true})
  pageNumber: number | null = null;

  /**
   *  Footer text.
   *  <br />If empty string (`''` or `null`) the footer row is omitted
   */
  @Prop({mutable: true})
  text: string;

  /**
   *  code .
   *  <br />If empty string (`''` or `null`) the footer row is omitted
   */
  @Prop({mutable: true})
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

  prepareAssetUrl(imgUrl: string){
    if(this.isValidHttpUrl(imgUrl)) {
      return imgUrl
    }
    return `./assets/${imgUrl}.png`
  }

  render() {
    return <Host>

      <div id={this.displayPageNumber? "container-page-footer": "container"}>
       <div id="footer-text">
        {
         this.text != null ? <span class="note">{this.text}</span> : ""
       }
       </div>
       <div id="code">
       {
         this.code != null ? <img  class="image" src={getAssetPath(`${this.prepareAssetUrl(this.code)}`)}/> : ""
       }
       </div>
       <div id="page-number">
       {
         this.displayPageNumber ? <span class="page">{this.pageNumber}</span> : ""
       }
       </div>

      </div>
    </Host>
  }
}
