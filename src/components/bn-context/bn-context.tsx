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

  @Element() el: HTMLElement;

  @Prop() locale: string;

  @Watch('locale')
  setLocale(newValue: string) {
    state.locale = newValue;
  }

  currentPageUpdate = undefined

  // @ts-ignores
  observer = new MutationObserver((m: MutationRecord[]) => {
    if (this.currentPageUpdate) {
      clearTimeout(this.currentPageUpdate)
    }

    this.currentPageUpdate = setTimeout(() => {
      this.el.querySelectorAll('bn-page').forEach((page, index) => {
        const footer = page.querySelector("bn-footer");
        if (footer) {
          // @ts-ignore
          footer.setAttribute("page-number", (index + 1).toString());
        }
      })
    }, 50)
  });



  connectedCallback() {
    if (this.locale) {
      state.locale = this.locale;
    }
    this.observer.observe(this.el, { childList: true });
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
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
