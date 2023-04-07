import {Component, Fragment, h, Prop} from "@stencil/core";

@Component({
  tag: 'bn-layout',
  styleUrl: 'bn-layout.scss',
  shadow: true
})
export class Layout {
  @Prop()
  layout: 'full' | 'split-vertical' | 'split-horizontal' | '2x2' | '3x3' | '4x4' | '1 over 2' | '1 over 3' | '2 over 1' | '3 over 1' = 'full'

  render() {
    return <div style={this.getLayoutStyle()}>
      {this.getSlots()}
    </div>
  }

  private getLayoutStyle() {

    if (this.layout === 'split-vertical') {
      return {
        display: 'flex',
        height: "100%",
        width: "100%",
        flexDirection: "row"
      };
    } else if (this.layout === 'split-horizontal') {
      return {
        display: 'flex',
        height: "100%",
        width: "100%",
        flexDirection: 'column'
      }
    } else if (this.layout === '2x2') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a b\" \"c d\"",
      }
    } else if (this.layout === '3x3') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a b c\" \"d e f\" \"g h i\"",
      }
    } else if (this.layout === '4x4') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a b c d\" \"e f g h\" \"i j k l\"",
      }
    }
    else if (this.layout === '1 over 2') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a a\" \"b c\"",
      }
    } else if (this.layout === '2 over 1') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a b\" \"c c c\"",
      }
    } else if (this.layout === '1 over 3') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a a a \" \"b c d\"",
      }
    } else if (this.layout === '3 over 1') {
      return {
        display: 'grid',
        height: "100%",
        width: "100%",
        "grid-template-areas": "\"a b c\" \"d d d\"",
      }
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
        "grid-area": x
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
