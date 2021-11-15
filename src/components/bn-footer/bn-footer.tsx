import {Component, h, Host, Prop} from "@stencil/core";

@Component({
  tag: 'bn-footer',
  styleUrl: 'bn-footer.scss'
})
export class Footer {

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
  text: string

  /**
   *  Toggle if pagenumer label is displayed
   */
  @Prop()
  displayPageNumber: boolean = true;

  render() {
   return <Host>
      {
         this.text != null? <span class="note">{this.text}</span> : ""
      }
      {
         this.displayPageNumber? <span class="page">{this.pageNumber}</span> : ""
      }
    </Host>
  }
}
