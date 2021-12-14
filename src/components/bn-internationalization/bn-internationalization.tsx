import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";
import {get, set} from "../../stores/internationalization";
import flattenObject from "../../utils/flattenObject";
import withComponentStatus from "../../utils/withComponentStatus";

@Component({
  tag: 'bn-internationalization',
  styleUrl: 'bn-internationalization.scss'
})
export class Internationalization {
  constructor() {
    withComponentStatus(this);
    withBodyObserver(this, (data) => {
      try {
        const i18n = flattenObject(JSON.parse(data));
        // @ts-ignore
        set(this.code, {...get(this.code), ...i18n})
      } catch (e) {
        console.error(e)
      }
    });
  }

  @Prop() code: string;

  render() {
    return <Host/>
  }
}

