import {Component, h, Host, Element, Prop} from "@stencil/core";
import {styled} from "../../utils/styled/styled";

@Component({
  tag: 'bn-text',
  styleUrl: 'bn-text.scss',
})
export class Text {
  // @ts-ignore
  @Element() private element: HTMLElement;

  @Prop() value?: string;
  @Prop() dataSources: {};

  scopedEval = (scope, script) => Function(`"use strict"; return ${script}`).bind(scope)();

  render() {
    return <Host>
      {this.scopedEval(this.dataSources, "`" + this.value + "`")}
    </Host>
  }
}

styled(Text);
