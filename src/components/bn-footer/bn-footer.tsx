import {Component, h, Host, Prop} from "@stencil/core";

@Component({
  tag: 'bn-footer'
})
export class Footer {
  @Prop({mutable: true})
  pageNumber: number

  render() {
    return <Host>
      Page: {this.pageNumber}
    </Host>
  }
}
