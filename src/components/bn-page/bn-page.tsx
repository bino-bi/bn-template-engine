import {Component, h, Host, Prop, Watch} from "@stencil/core";

@Component({
  tag: 'bn-page',
  styleUrl: 'bn-page.scss',
  //shadow: true, adjust css :) https://stenciljs.com/docs/host-element#shadow-dom
})
export class Template {

  /**
   * Define the size of the page
   *
   * values: xga | hd | full-hd | 4k | 4k2k | a4 | a3 | a2 | a1 | a0 | letter | legal
   * default: xga
   */
  @Prop() format: String;

  /**
   * values: landscape | portrait
   * default: based on the given format
   */
  @Prop() orientation: String;

  @Watch('format')
  // @ts-ignore
  validateFormat(newValue: String, oldValue: String) {
    //TODO: add validation
  }

  @Watch('format')
  // @ts-ignore
  validateOrientation(newValue: String, oldValue: String) {
    //TODO: add validation
  }

  render() {
    return <Host/>
  }
}
