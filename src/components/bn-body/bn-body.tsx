import { Component, h, Host } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-body',
  styleUrl: 'bn-body.scss'
})
export class Body {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  constructor() {
    withComponentStatus(this);
  }
  render() {
    return <Host />
  }
}
