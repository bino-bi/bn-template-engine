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

  dataSourceHashCache: {} = {};

  /**
   *
   * @param name
   * @param data
   * @param hash is used to avoid data regenerating on tempalte content changed in preview mode. Data should only create if the data schema changed.
   */
  updateDataSource(name: string, data: object, hash?: string) {
    console.dir(["lalala",data])
    if (this.isPreview) {
      if (this.dataSourceHashCache[name] !== hash) {
        this.dataSourceHashCache[name] = hash;
        this.dataSources = {...this.dataSources, [name]: data};
      }
    } else {
      this.dataSources = {...this.dataSources, [name]: data};
    }
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
