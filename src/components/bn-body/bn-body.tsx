import { Component, Element, h, Host } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-body",
  styleUrl: "bn-body.scss",
  shadow: true,
})
export class Body {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle(($) => ({
      "--bn-font-family": $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      "--bn-font-size": `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      "--bn-font-color": $["global"]?.["fontColor"] || "#000000",
      "--bn-font-background": $["global"]?.["fontBackgroundColor"] || "#ffffff",
    }));
  }

  render() {
    return (
      <Host style={this.getFontStyles()}>
        <slot />
      </Host>
    );
  }
}
