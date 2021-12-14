import {Component, h, Host} from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-body',
  styleUrl: 'bn-body.scss'
})
export class Body {
  constructor() {
    withComponentStatus(this);
  }
  render() {
    return <Host/>
  }
}
