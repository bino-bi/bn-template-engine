import {Component, Prop, h, Host, Listen, Method} from "@stencil/core";
import Tunnel from '../../data/context';

@Component({
  tag: 'bn-datasource'
})
export class Datasource {
  constructor() {
    this.emitData = this.emitData.bind(this);
  }

  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name: string;

  /**
   * single or collection
   */
  @Prop() type: string;

  @Prop() isPreview: boolean;
  @Prop() updateDataSource?: (name: string, data: object) => void;

  @Listen('DOMSubtreeModified')
  contentModified(event: MutationEvent) {
    const target: any | HTMLElement | Text = event.target;
    const data = target.data || target.innerText;
    console.dir(data);
  }

  @Method()
  emitData(data: any) {
    this.updateDataSource(this.name, data);
  }

  render() {
    return <Host/>
  }
}

Tunnel.injectProps(Datasource, ['updateDataSource', 'isPreview']);
