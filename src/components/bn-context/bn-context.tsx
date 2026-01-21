import { Component, h, Host, Element, Prop, Watch } from "@stencil/core";
import state from '../../stores/context';
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-context',
  styleUrl: 'bn-context.css'
})
export class Context {
  constructor() {
    withComponentStatus(this);
  }

  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  @Prop() locale: string;

  @Watch('locale')
  setLocale(newValue: string) {
    state.locale = newValue;
  }

  currentPageUpdate = undefined

  connectedCallback() {
    if (this.locale) {
      state.locale = this.locale;
    }

    this.currentPageUpdate = setTimeout(() => {

      this.element.querySelectorAll('bn-page, bn-layout-page').forEach((page, index) => {
        if (page.localName === 'bn-layout-page') {
          page.setAttribute("page-number", (index + 1).toString());
        } else {
          const footer = page.querySelector("bn-footer");
          if (footer) {
            // @ts-ignore
            footer.setAttribute("page-number", (index + 1).toString());
          }
        }
      })
    }, 250)
  }

  disconnectedCallback() {
    if (this.currentPageUpdate) {
      clearTimeout(this.currentPageUpdate)
    }
  }

  componentWillLoad() {
    // stencil needs one componenet implementing all lifecycle steps to get mixing working
  }

  componentDidLoad() { }

  componentShouldUpdate() { }

  componentWillRender() { }

  componentDidRender() { }

  componentWillUpdate() { }

  componentDidUpdate() { }

  render() {
    return (
      <Host >
        <slot />
      </Host>);
  }
}
