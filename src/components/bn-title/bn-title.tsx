import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import {Component, h, Host, Prop, State} from "@stencil/core";
import {get ,onChange} from '../../data/datasource';
import { styled } from "../../utils/styled/styled";

@Component({
  tag: 'bn-title',
  styleUrl: 'bn-title.scss'
})
export class Title {


  @Prop() businessUnit?: string;   
  @Prop() scenarios: string;

  @Prop() order?: string;
  @Prop() orderDirection?: string;
  
  @Prop() measures?: string;

  @Prop() dateStart: string;
  @Prop() dateEnd: string;
  @Prop() dateFormat: string;
  @Prop() dateLink: string;

  @State() datasouce: any

  //componentWillLoad() {
  //    this.datasouce= get("test");
  //    this.unsubscribe = onChange("test", (value) => this.datasouce = value);
 // }

  unsubscribe: () => void
  
  render() {
    console.dir(["title",this.datasouce]);
    
    const titleOrder = {
      columnshierachy: this.order? this.order.split(",") : null,
      direction: this.orderDirection
    };
    
    const titleTimeperiod = {
      start:   this.dateStart,
      end:     this.dateEnd,
      format:  this.dateFormat,
      link:    this.dateLink,
    };

    return <Host>
              <ibcs-title
                  data = {null}
                  businessUnit = {this.businessUnit}
                  scenarios={this.scenarios.split(",")}
                  measures = {this.measures ? JSON.parse(this.measures!) : null}
                  timeperiod = {titleTimeperiod}
                  order={titleOrder}
                  i18n={new Map([
                    ["title1", "🤩"]
                  ])}
              ></ibcs-title>
            </Host>
  }
}

styled(Title);

