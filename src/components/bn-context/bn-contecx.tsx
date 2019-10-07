import {Component, h, Prop, State} from "@stencil/core";
import Tunnel, {ContextState} from '../../data/context';

@Component({
  tag: 'bn-context',
  shadow: true
})
export class Context {

  /**
   * Enable the preview mode to generate fake data.
   */
  @Prop() isPreview: boolean = false;

  constructor() {
    this.updateDataSource = this.updateDataSource.bind(this)
  }

  @State() dataSources: {} = {};

  updateDataSource(name: string, data: object) {
    this.dataSources = {...this.dataSources, [name]: data};
  }

  render() {
    const state: ContextState = {
      isPreview: this.isPreview,
      dataSources: this.dataSources,
      updateDataSource: this.updateDataSource
    };

    return (
      <Tunnel.Provider state={state}>
        <slot/>
      </Tunnel.Provider>
    )
  }
}
