import {Component, Fragment, h, Prop} from "@stencil/core";

@Component({
  tag: 'bn-layout',
  styleUrl: 'bn-layout.scss',
  shadow: true
})
export class Layout {
  @Prop()
  layout: 'full' | 'split-vertical' | 'split-horizontal' | '2x2' | '3x3' | '4x4' | '1-over-2' | '1-over-3' | '2-over-1' | '3-over-1' | 'custom-template' = 'full'

  @Prop()
  customTemplate: string  =  "\"a b\" \"c d\"";

  @Prop()
  gridGap: string  = "0";

  @Prop()
  fitToContent: boolean = true;

  render() {
    let style = this.getLayoutStyle();
    let arrOfSlots: string[] =  this.extractSlotNames(style["grid-template-areas"]);

    return <div style={style}>
      {this.getSlots(arrOfSlots)}
    </div>
  }

  private getCommonStyles() {
    let height = "100%";
    let width  = "100%";

    if(this.fitToContent === true) {
      width = "fit-content";
      height = "fit-content";
    }

    return {
      display: "grid",
      height: height,
      width: width,
      'grid-gap': this.gridGap
    };
  }

  private getLayoutStyle() {
    switch (this.layout) {
      case 'split-vertical':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a  b\"",
        };
      case 'split-horizontal':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a\" \"b\"",
        };
      case '2x2':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b\" \"c d\"",
        };
      case '3x3':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b c\" \"d e f\" \"g h i\"",
        };
      case '4x4':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b c d\" \"e f g h\" \"i j k l\"",
        };
      case '1-over-2':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a a\" \"b c\"",
        };
      case '2-over-1':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b\" \"c c c\"",
        };
      case '1-over-3':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a a a \" \"b c d\"",
        };
      case '3-over-1':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b c\" \"d d d\"",
        };
      case 'custom-template':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": this.customTemplate,
        };    
      default:
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a\"",
        };
    }

  }

  private createDivAreaStyles(elements :string[]) {
    return elements.map(x => (
      {"overflow": "hidden",
        "grid-area": x,
      }));
  }

  private getSlots(slotNames: string[]) {
    const items = this.createDivAreaStyles(slotNames);

    return <Fragment>
      {items.map((value, index) => {
        return <div style={value}>
          <slot name={'slot-' + index}></slot>
        </div>
      })}
    </Fragment>
  }

  private extractSlotNames(styleElement: string | null) {
    if( styleElement == null) {
      return [];
    }

    const words = styleElement.match(/\b\w+\b/g);
    if (!words) {
      return [];
    }

    return  Array.from(new Set(words));
  }
}
