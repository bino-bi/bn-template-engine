import {Component, Element, h, Host, Prop} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import Tunnel from "../../data/context";

@Component({
  tag: 'bn-table'
})
export class Table {
  // @ts-ignore
  @Element() private element: HTMLElement;

  @Prop() header: string;
  @Prop() scenarios: string;
  // @Prop() groups: string[];
  // @Prop() thereof: string[];
  // @Prop() order: string;
  // @Prop() type: string;
  // @Prop() limit: number;


  render() {

    return <Host>
      <p>{this.header}</p>
      <p>{this.scenarios}</p>
    </Host>
  }
}

Tunnel.injectProps(Table, ['dataSources']);
styled(Table);
