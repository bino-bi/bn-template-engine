import {Component, Prop, h, Host} from "@stencil/core";

@Component({
  tag: 'bn-datasource'
})
export class Datasource {
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name: string;

  /**
   * single or collection
   */
  @Prop() type: string;

  /**
   * JSON that configure the data source.
   */
  @Prop() context?: string;

  render() {
    return <Host>
      I'm a datasource
    </Host>
  }
}
