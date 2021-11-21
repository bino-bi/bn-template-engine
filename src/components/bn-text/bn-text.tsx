import {Component, h, Host, Prop, State} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import withDataset from "../../utils/withDataset";

@Component({
  tag: 'bn-text',
  styleUrl: 'bn-text.scss',
})


export class Text {

  @Prop() value?: string;

  @State() data: any = {}

  constructor() {
    withDataset(this, (name, data) => {
      this.data = {...this.data, [name]: data};
    });
  }

  scopedEval = (scope, script) => Function(`"use strict"; try { return ${script} } catch { return ""}`).bind(scope)();

  render() {
    return <Host>
      {this.scopedEval({data: this.data, test: 1}, "`" + this.value + "`")}
    </Host>
  }
}

styled(Text);

