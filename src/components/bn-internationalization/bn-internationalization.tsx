import {Component, Prop, h, Host} from "@stencil/core";
import withBodyObserver from "../../utils/withBodyObserver";

@Component({
  tag: 'bn-internationalization',
  styleUrl: 'bn-internationalization.scss'
})
export class Internationalization {
  @Prop() code: string;

  constructor() {
    withBodyObserver(this, (data) => {

    });
  }

  render() {
    return <Host />
  }
}

