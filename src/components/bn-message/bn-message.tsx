import { Component, getAssetPath,  h, Host, Prop } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-message',
  styleUrl: 'bn-message.scss',
  assetsDirs: ['assets']
})
export class Footer {
  constructor() {
    withComponentStatus(this);
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
    return <Host id={(this.text  || this.image) ? "container-page-message": "container"}>
      <div id="message-text">
        {
          this.text != null || this.text != ""? <span class="note">{this.text}</span> : ""
        }
      </div>
      <div id="page-image">
        {
          this.image != null || this.image != "" ? <img class="image" src={getAssetPath(`${this.prepareAssetUrl(this.image)}`)} /> : ""
        }
      </div>    
      {/* </div> */}
    </Host>
  }

}
