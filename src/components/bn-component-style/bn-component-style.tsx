import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import state from "../../stores/componentStyles";

@Component({
  tag: 'bn-component-style',
  styleUrl: 'bn-component-style.scss'
})
export class ComponentStyle {
  @Prop() name: string = "default";
  @Prop() component: string;

  constructor() {
    withBodyObserver(this, (data) => {
      try {
        const parsedData = JSON.parse(data);
        console.dir([this.component, this.name, parsedData])
        state[this.component][this.name] = {...state[this.component][this.name], ...parsedData}
      } catch (e) {
        console.error(e)
      }
    });
  }

  render() {
    return <Host/>
  }
}

