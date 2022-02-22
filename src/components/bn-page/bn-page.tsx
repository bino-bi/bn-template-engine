import { Component, h, Host, Prop, Watch, Element } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";

@Component({
  tag: 'bn-page',
  styleUrl: 'bn-page.scss',
})
export class Page {
  private componentStyleName: string;
  private readonly componentStyle: (name: string) => any;

  constructor() {
    withComponentStatus(this);
    this.componentStyle =withComponentStyle(this).componentStyle;
  }

  @Element() el: HTMLElement
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
  /**
   *  Custom Styles for chart scnearios.
   *  <br /> <br />
   *  feature is not yet activated
   *  <br /> <br />
   *  interface for format is *BinoChartSyles*
   *
   */
  @Prop() styles: string = 'default';

  @Watch('styles')
  validateStyles(newValue: string) {
    if (newValue == null || newValue == 'null' || newValue.trim().length == 0){
      newValue = 'default';
    }
    this.componentStyleName = newValue;
  }
  render() {
    return <Host style={this.prepareStyle()}>
      <slot />
    </Host>
  }

  private prepareStyle() {
    return this.componentStyle(this.componentStyleName)
  }

}
