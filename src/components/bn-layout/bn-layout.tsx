import {Component, Fragment, h, Method, Prop} from "@stencil/core";

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


  templateMap = new Map([['split-vertical', "\"a  b\""],
    ['split-horizontal', "\"a\" \"b\""],
    ['2x2', "\"a b\" \"c d\""],
    ['3x3', "\"a b c\" \"d e f\" \"g h i\""],
    ['4x4', "\"a b c d\" \"e f g h\" \"i j k l\""],
    ['1-over-2', "\"a a\" \"b c\""],
    ['2-over-1', "\"a b\" \"c c c\""],
    ['1-over-3', "\"a a a \" \"b c d\""],
    ['3-over-1', "\"a b c\" \"d d d\""],
    ['custom-template', "\"a b\" \"c c c\""]
  ]);

  render() {
    let style = this.getLayoutStyle();
    let arrOfSlots: string[] =  this.extractSlotNames(style["grid-template-areas"]);

    // console.log("Layout", this.layout, this.customTemplate, this.gridGap , this.fitToContent );


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
      gap: this.gridGap +"px"
    };
  }

  private getLayoutStyle() {    return {
      ...this.getCommonStyles(),
      "grid-template-areas": this.getTemplatePattern(this.layout),
    };
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

   private getTemplatePattern(name: string): string {
    if (this.templateMap.has(name) == false && name != 'custom-template') {
      return "\"a\"";
    }

    if (name == 'custom-template') {
      return this.customTemplate;
    }

    return this.templateMap.get(name);
  }


  @Method()
  async  getNumberOfSlot(name: string) {
    let template = this.getTemplatePattern(name);

    return  this.extractSlotNames(template).length;
  }
}
