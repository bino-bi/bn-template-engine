import { Component, h, Host, Element } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";

@Component({
  tag: 'bn-card',
  styleUrl: 'bn-card.scss',
})
export class Card {
  private readonly componentStyle: <T, >(q: (Style) => T) => T;

  constructor() {
    withComponentStatus(this);
    this.componentStyle = withComponentStyle(this);
  }

  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  render() {
    return <Host style={this.prepareStyle()}>
      <slot />
    </Host>
  }

  private prepareStyle() {
    let pageStyle = {
      "font-family": this.componentStyle($ => $.global["fontFamily"]),
      "font-size": `${this.componentStyle($ => $.global["fontSizePx"])}px`,
    };

    return pageStyle;
  }

}
