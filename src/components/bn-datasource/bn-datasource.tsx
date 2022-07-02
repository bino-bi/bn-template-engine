import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import {set} from "../../stores/datasources";
import withComponentStatus from "../../utils/withComponentStatus";
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
    withComponentStatus(this);
    withBodyObserver(this, (data => {
      // @ts-ignore
      set(this.name, JSON.parse(data));

    }));
  }

  render() {
    return <Host/>
  }
}
