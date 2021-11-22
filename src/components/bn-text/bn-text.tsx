import {Component, h, Host, Prop, State} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import withDataset from "../../utils/withDataset";
import withTranslation from "../../utils/withTranslation";
import withComponentStyle from "../../utils/withComponentStyle";

@Component({
  tag: 'bn-text',
  styleUrl: 'bn-text.scss',
})


export class Text {

  @Prop() value?: string;

  @State() data: any = {}

  private readonly t: (key: string, data?: object) => string;


  constructor() {

    this.t = withTranslation().t;
    withDataset(this, (name, data) => {
      this.data = {...this.data, [name]: data};
    });
  }

  scopedEval = (scope, script) => {
    try {
      return Function(`"use strict"; try { return ${script} } catch { return ""}`).bind(scope)();
    } catch (e) {
      console.error("bn-text", e)
    }
  }

  render() {
    return <Host>
      {this.scopedEval({data: this.data, t: this.t}, "`" + this.value + "`")}
    </Host>
  }
}

styled(Text);

