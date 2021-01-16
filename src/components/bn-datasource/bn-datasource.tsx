import {Component, Prop, h, Host, Listen} from "@stencil/core";
import Tunnel from "../bn-context/tunnel";

@Component({
  tag: 'bn-datasource',
  styleUrl: 'bn-datasource.css',
})
export class Datasource {
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  @Prop() updateDatasource?: (key: string, data: any) => void;

  @Listen('DOMNodeInserted')
  getChangedValue(event) {
    const data = JSON.parse(event.target.textContent);
    console.dir(['data:', this.name, data]);
    this.updateDatasource?.(this.name, data);
  }


  render() {
    return <Host/>
  }
}

Tunnel.injectProps(Datasource, ['updateDatasource'])
