import { Component, Prop, h, Host } from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
// @ts-ignore
import state, { set, Style } from "../../stores/componentStyles";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-component-style',
  styleUrl: 'bn-component-style.scss'
})
export class ComponentStyle {
  @Prop() name: string = "_default";

  constructor() {
    withComponentStatus(this);
    withBodyObserver(this, (data) => {
      try {
        const parsedData = JSON.parse(data);
        set(this.name, parsedData as Style)
      } catch (e) {
        //TODO: add error chanel for JSON parsing errors
        console.error(e)
      }
    });
  }

  render() {
    return <Host />
  }
}

