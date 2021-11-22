import {Component, h, Host, Element, Prop, Watch} from "@stencil/core";
import state from '../../stores/context';

@Component({
  tag: 'bn-context',
  styleUrl: 'bn-context.scss'
})
export class Context {
  @Element() el: HTMLElement;

  @Prop() locale!: string;

  @Watch('locale')
  setLocale(newValue: string) {
    state.locale = newValue;
  }

  observer = new MutationObserver(() => {
    this.el.querySelectorAll('bn-page').forEach((page, index) => {
      // @ts-ignore
      page._setCurrentPageIndex(index + 1);
    })
  });

  connectedCallback() {
    state.locale = this.locale;
    this.observer.observe(this.el, {childList: true});
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
  }

  render() {
    return (<Host>
      <slot/>
    </Host>);
  }
}
