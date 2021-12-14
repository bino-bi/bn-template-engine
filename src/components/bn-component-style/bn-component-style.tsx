import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import state from "../../stores/componentStyles";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-component-style',
  styleUrl: 'bn-component-style.scss'
})
export class ComponentStyle {
  @Prop() name: string = "default";
  @Prop() component: string;

  constructor() {
    withComponentStatus(this);
    withBodyObserver(this, (data) => {
      try {
        const parsedData = JSON.parse(data);
        //console.dir(["Hint: ",this.component, this.name, parsedData, state, state[this.component] && state[this.component][this.name]])
        //TODO: throw exception if no default is defind in state
        //TODO: need manual tests
        var current = current;

        if(state[this.component] && state[this.component][this.name]) {
          current = state[this.component][this.name];
        }

        state[this.component][this.name] = {...current, ...parsedData}
      } catch (e) {
        console.error(e)
      }
    });
  }

  render() {
    return <Host/>
  }
}

