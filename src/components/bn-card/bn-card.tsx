import { Component, h, Host, Element } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: 'bn-card',
  styleUrl: 'bn-card.scss',
  shadow: true
})
export class Card {
  private readonly componentStyle: <T, >(q: (Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
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
      '--bn-font-family': this.componentStyle($ => $.global["fontFamily"]) || "'Noto Sans', sans-serif",
      '--bn-font-size': `${this.componentStyle($ => $.global["fontSizePx"]) || 13.3333}px`,
      '--bn-font-color': this.componentStyle($ => $.global["fontColor"]) || '#000000',
      '--bn-font-background': this.componentStyle($ => $.global["fontBackgroundColor"]) || '#ffffff',
    };

    return pageStyle;
  }

}
