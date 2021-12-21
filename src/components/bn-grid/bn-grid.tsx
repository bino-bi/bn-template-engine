import {Component, Prop, h, Host} from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import {withStyled} from "../../utils/styled/withStyled";

@Component({
  tag: 'bn-grid',
  styleUrl: 'bn-grid.scss'
})
export class Grid {
  constructor() {
    withStyled(this);
    withComponentStatus(this);
  }
  @Prop() rows: number;
  @Prop() columns: number;
  @Prop() align: 'start' | 'end' | 'center' | 'stretch' = "stretch"
  @Prop() justify: 'start' | 'end' | 'center' | 'stretch' = "stretch"


  render() {
    const style = {
      'grid-template-columns':  Array.apply(null, {length: this.columns}).map(() => 100.0 / this.columns + "%").join(' '),
      'grid-template-rows': Array.apply(null, {length: this.rows}).map(() => 100.0 / this.rows + "%").join(' '),
      'justify-items': this.justify,
      'align-items': this.align,
    };

    return <Host style={style}/>
  }
}
