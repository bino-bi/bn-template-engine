import { Component, h, Host, Prop, Watch, Element } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";

@Component({
  tag: 'bn-page',
  styleUrl: 'bn-page.scss',
})
export class Page {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T, >(q: (Style) => T) => T;

  constructor() {
    withComponentStatus(this);
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Defines the size of the page
   * <br /><br />
   * values:
   * <br /> ``` xga // hd // full-hd // 4k // 4k2k // a4 // a3 // a2 // a1 // a0 // letter // legal ```
   * <br /><br />
   * default: <br /> ```xga```
   */
  @Prop() format: string;

  /**
   * Defines page orientation
   * <br /><br />
   * values:
   * <br /> ``` landscape // portrait ```
   * <br /><br />
   * default:
   * <br /> based on the given format
   */
  @Prop() orientation: string;

  @Watch('format')
  // @ts-ignore
  validateFormat(newValue: string, oldValue: string) {
    //TODO: add validation
  }

  @Watch('orientation')
  // @ts-ignore
  validateOrientation(newValue: string, oldValue: string) {
    //TODO: add validation
  }

  render() {
    return <Host format={this.format} orientation={this.orientation} style={this.prepareStyle()}>
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
