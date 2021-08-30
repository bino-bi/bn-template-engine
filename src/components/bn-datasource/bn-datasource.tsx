import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import {set} from "../../stores/datasources";
@Component({
  tag: 'bn-datasource',
  styleUrl: 'bn-datasource.css',
})
export class Datasource {
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
