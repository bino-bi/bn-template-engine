import {Component, h, Host, State} from "@stencil/core";
import Tunnel, { ContextState} from './tunnel';

@Component({
  tag: 'bn-context',
  shadow: false
})
export class Context {

  constructor() {
    this.updateDatasource = this.updateDatasource.bind(this);
  }

  @State() datasourcesData: {[key: string]: any} = {};

  updateDatasource = (key: string, value: any) => ( this.datasourcesData = {...this.datasourcesData, [key]: value} )

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
