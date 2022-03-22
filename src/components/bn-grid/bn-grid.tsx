import { Component, Prop, h, Host } from "@stencil/core";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";

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
  @Prop() align: 'start' | 'end' | 'center' | 'stretch' = "start"
  @Prop() justify: 'start' | 'end' | 'center' | 'stretch' = "start"
  @Prop() justifyContent: 'start' | 'end' | 'center' | 'stretch' | 'space-around' | 'space-between' | 'space-evenly' = "space-between"
  @Prop() alignContent: 'start' | 'end' | 'center' | 'stretch' | 'space-around' | 'space-between' | 'space-evenly' = "space-between"
  // TODO: add that with 'string' or 'int to unit' + add gaps
  @Prop() columnGap: string; //10px;
  @Prop() rowGap: string; //15px;

  render() {
    const style = {
      'grid-template-columns': Array.apply(null, { length: this.columns }).map(() => 100.0 / this.columns + "%").join(' '),
      'grid-template-rows': Array.apply(null, { length: this.rows }).map(() => 100.0 / this.rows + "%").join(' '),
      'justify-items': this.justify,
      'align-items': this.align,
      'justify-content': this.justifyContent,
      'align-content': this.alignContent,
    };

    return <Host style={style} />
  }
}
