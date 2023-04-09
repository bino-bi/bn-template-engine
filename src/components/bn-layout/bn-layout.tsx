import {Component, Fragment, h, Prop} from "@stencil/core";

@Component({
  tag: 'bn-layout',
  styleUrl: 'bn-layout.scss',
  shadow: true
})
export class Layout {
  @Prop()
  layout: 'full' | 'split-vertical' | 'split-horizontal' | '2x2' | '3x3' | '4x4' | '1 over 2' | '1 over 3' | '2 over 1' | '3 over 1' | 'custom-template' = 'full'

  @Prop()
  customTemplate: string  =  "\"a b\" \"c d\"";

  @Prop()
  gridGap: string  = "0";

  @Prop()
  fitToConent: boolean = true;


  render() {
    return <div style={this.getLayoutStyle()}>
      {this.getSlots()}
    </div>
  }

  private getCommonStyles(display: string = "grid") {
    let height = "100%";
    let width  = "100%";

    if(this.fitToConent === true) {
      width = "fit-content";
      height = "fit-content";
    }

    return {
      display: display,
      height: height,
      width: width,
      'grid-gap': this.gridGap
    };
  }

  private getLayoutStyle() {
    switch(this.layout) {
      case 'split-vertical':
        return {
          ...this.getCommonStyles('flex'),
          flexDirection: "row"
        };
      case 'split-horizontal':
        return {
          ...this.getCommonStyles('flex'),
          flexDirection: 'column'
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
      case '1 over 2':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a a\" \"b c\"",
        };
      case '2 over 1':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b\" \"c c c\"",
        };
      case '1 over 3':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a a a \" \"b c d\"",
        };
      case '3 over 1':
        return {
          ...this.getCommonStyles(),
          "grid-template-areas": "\"a b c\" \"d d d\"",
        };
    }

  }




  private crateFullItems() {
    let divStyle = {
      height: "100%",
      width: "100%",
      overflow: "hidden",
    };

    return [divStyle];
  }

  private crateHSplitItems() {
    let divStyle = {
      height: "50%",
      width: "100%",
      overflow: "hidden",
    };

    return [divStyle, divStyle];
  }

  private crateVSplitItems() {
    let divStyle = {
      height: "100%",
      width: "50%",
      overflow: "hidden",
    };

    return [divStyle, divStyle];
  }



  private createDivAreaStyles(elements :string[]) {
    return elements.map(x => (
      {"overflow": "hidden",
        "grid-area": x,
      }));
  }

  private getSlots() {
    const items = this.getItemsArr();

    return <Fragment>
      {items.map((value, index) => {
        return <div style={value}>
          <slot name={'slot-' + index}></slot>
        </div>
      })}
    </Fragment>
  }

  private getItemsArr() {
    switch (this.layout) {
      case 'full':
        return this.crateFullItems();
      case 'split-vertical':
        return this.crateVSplitItems();
      case 'split-horizontal':
        return this.crateHSplitItems();
      case '2x2':
        return this.createDivAreaStyles(["a","b","c","d"]);
      case '3x3':
        return this.createDivAreaStyles(["a","b","c","d","e","f","g","h","i"]);
      case '4x4':
        return  this.createDivAreaStyles(["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p"]);
      case '1 over 2':
        return this.createDivAreaStyles(["a","b","c"]);
      case '2 over 1':
        return this.createDivAreaStyles(["a","b","c"]);
      case '1 over 3':
        return this.createDivAreaStyles(["a","b","c", "d"]);
      case '3 over 1':
        return this.createDivAreaStyles(["a","b","c", "d"]);
      default:
        return this.crateFullItems();
    }
  }


}
