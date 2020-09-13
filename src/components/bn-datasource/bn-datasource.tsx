import {Component, Prop, h, Host} from "@stencil/core";
import {set} from '../../data/datasource';

@Component({
  tag: 'bn-datasource',
  styleUrl: 'bn-datasource.css',
})
export class Datasource {

  constructor(){
    setInterval(() => {
      set("test", {abc: new Date().getMilliseconds()});
    }, 1000)
    
  }

  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  /**
   * single or collection
   */
  @Prop() type: string = 'single';

  render() {
    return <Host/>
  }
}