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

  scopedEval = (scope, script) => Function(`"use strict"; try { return ${script} } catch { return ""}`).bind(scope)();

  render() {
try { } catch {}
    return <Host>
      {this.scopedEval(this.datasourcesData, "`" + this.value + "`")}
    </Host>
  }
}

Tunnel.injectProps(Text, ['datasourcesData'])
styled(Text);

