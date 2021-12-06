import {Component, h, Host, Prop, Watch, Element, Method} from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-page',
  styleUrl: 'bn-page.scss',
})
export class Page {
  constructor() {
    withComponentStatus(this);
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

  //TODO: add observer and append to connected footer
  @Method()
  async _setCurrentPageIndex(value: number) {
    const footer = this.el.querySelector('bn-footer')
    if (footer) {
      footer.setAttribute("page-number", value.toString());
    }
  }

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
    return <Host>
      <slot/>
    </Host>
  }
}
