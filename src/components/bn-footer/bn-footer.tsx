import {Component, h, Host, Prop} from "@stencil/core";

@Component({
  tag: 'bn-footer',
  styleUrl: 'bn-footer.scss'
})
export class Footer {
  @Prop({mutable: true})
  pageNumber: number | null = null;

  @Prop({mutable: true})
  text: string

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
