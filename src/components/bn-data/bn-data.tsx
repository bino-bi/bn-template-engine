import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import {set} from "../../stores/datasources";
@Component({
  tag: 'bn-data',
  styleUrl: 'bn-data.css',
})
export class Data {
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  constructor() {
    withBodyObserver(this, (data => {
      // @ts-ignore
      set(this.name, JSON.parse(data));
    }));
  }

  render() {
    return <Host/>
  }
}
