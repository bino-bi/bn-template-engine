//import { DateDistanceType, DateLinkType } from "@bino-bi/ibcs-component/dist/types/utils/model";
import {Component, h, Host, Prop, State, Watch} from "@stencil/core";
//import {get ,onChange} from '../../data/datasource';
import { styled } from "../../utils/styled/styled";
import { validateScenarioList } from "../../utils/validate";

@Component({
  tag: 'bn-title',
  styleUrl: 'bn-title.scss'
})
export class Title {
  /** (optional) Name of business unit. If empty buisnes unit row is omitted */
  @Prop() businessUnit: string;    
 
  /** (optional) List of scenarios. Valid scenarios are *( ac | fc | py | pl )* */
  @Prop() scenarios: string;
   
  /** (optional) Sets the primary scenario on which the order direction is applied */
  @Prop() order: string;
  
 /** (optional) The icon to display */
  @Prop() orderDirection: 'asc' | 'desc' = 'asc'; // behind
  
  @Prop() measures?: string;

  @Prop() dateStart: string;
  @Prop() dateEnd: string;
  @Prop() dateFormat: string;
  @Prop() dateLink: string;

  @State() datasouce: any


  @Watch('scenarios')  
  validateName(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue); 
    if (invalidScenarios.length > 0) { throw new Error('businessUnit: invalid scenario(s) \'' + invalidScenarios.toString() + '\' are not supported.') }; 
  }

  //@Watch('order')  
  //validateName(newValue: string) {

    //const invalidScenarios: string[] = validateScenarioList(newValue); 
    //if (invalidScenarios.length > 0) { throw new Error('businessUnit: invalid scenario(s) \'' + invalidScenarios.toString() + '\' are not supported.') };
   
  //}

  
  render() {
    console.dir(["title",this.datasouce]);
    console.log(this.businessUnit, this.scenarios,this.order, this.orderDirection,this.measures,this.dateStart,this.dateEnd,this.dateFormat,this.dateLink);
    
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

