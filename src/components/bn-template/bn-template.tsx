import {Component, h, Host, Prop} from "@stencil/core";

@Component({
  tag: 'bn-template'
})
export class Template {

  @Prop() templateId: string;

  render() {
    return <Host/>
  }
}
