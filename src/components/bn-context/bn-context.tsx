import {Component, h, Host, State, Element} from "@stencil/core";

@Component({
  tag: 'bn-context',
  styleUrl: 'bn-context.scss'
})
export class Context {
  @Element() el: HTMLElement;

  @State() datasourcesData: { [key: string]: any } = {};

  observer = new MutationObserver(() => {
    this.el.querySelectorAll('bn-page').forEach((el, index) => {
      // @ts-ignore
      el._setCurrentPageIndex(index + 1);
    })
  });

  connectedCallback() {
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
