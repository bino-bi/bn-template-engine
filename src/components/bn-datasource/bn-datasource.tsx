import {Component, Prop, h, Host} from "@stencil/core";
//import {set} from '../../data/datasource';

@Component({
  tag: 'bn-datasource',
  styleUrl: 'bn-datasource.css',
})
export class Datasource {
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  /**
   * single or collection
   */
  @Prop() type: 'single' | 'collection' = 'single';

  render() {
    return <Host/>
  }
}
