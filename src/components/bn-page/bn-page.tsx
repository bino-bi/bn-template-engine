import {Component, h, Host, Prop, Watch, Element, Method} from "@stencil/core";

@Component({
  tag: 'bn-page',
  styleUrl: 'bn-page.scss',
})
export class Template {
  @Element() el: HTMLElement
  /**
   * Define the size of the page
   *
   * values: xga | hd | full-hd | 4k | 4k2k | a4 | a3 | a2 | a1 | a0 | letter | legal
   * default: xga
   */
  @Prop() format: string;

  /**
   * values: landscape | portrait
   * default: based on the given format
   */
  @Prop() orientation: string;

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
    return <Host/>
  }
}
