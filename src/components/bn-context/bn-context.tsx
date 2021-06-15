import {Component, h, Host, State, Element} from "@stencil/core";
import Tunnel, {ContextState} from './tunnel';

@Component({
  tag: 'bn-context',
  styleUrl: 'bn-context.scss'
})
export class Context {

  constructor() {
    this.updateDatasource = this.updateDatasource.bind(this);
  }

  @Element() el: HTMLElement;

  @State() datasourcesData: { [key: string]: any } = {};

  observer = new MutationObserver(() => {
    this.el.querySelectorAll('bn-page').forEach((el, index) => {
      // @ts-ignore
      el._setCurrentPageIndex(index + 1);
    })
  });

  updateDatasource = (key: string, value: any) => (this.datasourcesData = {...this.datasourcesData, [key]: value})

  connectedCallback() {
    this.observer.observe(this.el, {childList: true});
  }

  disconnectedCallback() {
    if(this.observer) this.observer.disconnect();
  }

  render() {
    const tunnelState: ContextState = {
      datasourcesData: this.datasourcesData,
      updateDatasource: this.updateDatasource,
    };

    return (<Host>
      <Tunnel.Provider state={tunnelState}>
        <slot/>
      </Tunnel.Provider>
    </Host>);
  }
}
