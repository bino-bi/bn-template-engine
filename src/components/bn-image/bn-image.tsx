import { Component, h, Host, Prop } from "@stencil/core";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStatus from "../../utils/withComponentStatus";
import state from "../../stores/assets";

@Component({
    tag: 'bn-image',
    styleUrl: 'bn-image.scss'
})
export class Image {
    // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
    @Element() private element: HTMLElement;

    constructor() {
        withStyled(this);
        withComponentStatus(this);
    }

    /**
  /**
   *  Url of the image.
   *  <br />
   *  if not http it looks up the url in the components asset folder
   *  <br />
   *  If empty string (`''` or `null`) the image is omitted
   * <br /><br />
   *  example:<br /> ```debug/concordia.png```
   */
    @Prop() readonly source: string;

    prepareAssetUrl(value: string) {
        if (value == null || value == "") {
            return "";
        }
        // for backward compatibility deprecated "asset:" prefix
        if (value.startsWith("asset:")) {
            return state[value.substring(6)] // TODO: will not work with IE11 (state proxie is not available) )
        }

        return state[value] || value;
    }

    render() {
        return <Host>
            {this.source != null && this.source != "" ? <img src={this.prepareAssetUrl(this.source)} /> : ""}
        </Host>;
    }
}