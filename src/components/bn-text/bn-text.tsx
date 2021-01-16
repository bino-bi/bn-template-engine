import {Component, h, Host, Element, Prop} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import Tunnel from '../bn-context/tunnel';

@Component({
  tag: 'bn-text',
  styleUrl: 'bn-text.scss',
})
export class Text {
  // @ts-ignore
  @Element() private element: HTMLElement;

  @Prop() value?: string;

  @Prop() datasourcesData: any

  @Prop() updateDatasource?: (key: string, data: any) => void

  scopedEval = (scope, script) => Function(`"use strict"; return ${script}`).bind(scope)();

  render() {
    console.log("render renserc")
    console.log(this.datasourcesData)
    return <Host>
      <button value={'Arsch'} onClick={() => this.updateDatasource("test", {a: 10})}>ARsch</button>
      {this.scopedEval(this.datasourcesData, "`" + this.value + "`")}
    </Host>
  }
}

Tunnel.injectProps(Text, ['datasourcesData', 'updateDatasource'])
styled(Text);

