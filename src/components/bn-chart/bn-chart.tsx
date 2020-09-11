import {Component, Element, h, Host} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import Tunnel from "../../data/context";

@Component({
  tag: 'bn-chart'
})
export class Chart {
  // @ts-ignore
  @Element() private element: HTMLElement;

  render() {
    return <Host>
      <ibcs-chart-structure></ibcs-chart-structure>
    </Host>
  }
}

Tunnel.injectProps(Chart, ['dataSources']);
styled(Chart);
