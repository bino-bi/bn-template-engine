import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import withDataset from "../../utils/withDataset";
import withTranslation from "../../utils/withTranslation";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
// import { BinoChartSyles } from "@bino-bi/ibcs-component/dist/types/utils/model";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { BinoChartSyles } from "../../utils/model/ChartStyles";

@Component({
  tag: 'bn-text',
  styleUrl: 'bn-text.scss',
  shadow: true
})


export class Text {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.t = withTranslation(this).t;
    withDataset(this, (name, data) => {
      this.data = { ...this.data, [name]: data };
    });
    this.componentStyle = withComponentStyle(this);
  }

  @Prop() value?: string;

  @State() data: any = {}

  private readonly componentStyle: <T, >(q: (Style) => T) => T;
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;

  @Watch('value')
  validateValue(newValue: string) {
    const isBlank = typeof newValue !== 'string' || newValue === '';
    if (isBlank) {
      this.errors.addOrReplace({ id: 'no_value', type: 'warning', message: 'Empty value' })
    } else {
      this.errors.remove("no_value")
    };
  }

  scopedEval = (scope, script) => {
    try {
      return Function(`"use strict"; try { return ${script} } catch { return ""}`).bind(scope)();
    } catch (e) {
      console.error("bn-text", e)
    }
  }


  private prepareStyle(): BinoChartSyles {
    return this.componentStyle($ => $.chart);
  }

  private container!: HTMLSpanElement

  componentDidRender() {
    this.container.innerHTML = this.scopedEval({ data: this.data, t: this.t }, "`" + this.value + "`")
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle($ => ({
      '--bn-font-family': $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      '--bn-font-size': `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      '--bn-font-color': $["global"]?.["fontColor"] || '#000000',
      '--bn-font-background': $["global"]?.["fontBackgroundColor"] || '#ffffff',
    }));
  }

  render() {
    // TODO Stlye fuer etxgt noch setzen
    this.prepareStyle();
    const fontStyles = this.getFontStyles();

    return <Host style={fontStyles}>
      <div>
        <span class="container" ref={(el) => { this.container = el }}></span>
      </div>
    </Host>
  }
}

