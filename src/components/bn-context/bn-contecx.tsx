import {Component, Prop, h, Host} from "@stencil/core";

@Component({
  tag: 'bn-context'
})
export class Context {
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

  @Prop({context: "ping"}) ping: string;

  render() {
    return <Host>
      I'm a datasource
    </Host>
  }
}
