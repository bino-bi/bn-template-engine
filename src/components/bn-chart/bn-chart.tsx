import {Component, Element, h, Host, Prop, State} from "@stencil/core";
import {styled} from "../../utils/styled/styled";

@Component({
  tag: 'bn-chart'
})
export class Chart {
  // @ts-ignore
  @Element() private element: HTMLElement;
  
  // @Prop() order?: string;
  // @Prop() orderDirection?: string;

  @Prop() width?: number;
  @Prop() height?: number;

  @Prop() scenarios: string;
  @Prop() variances: string;
  
  @Prop() hideCategories: boolean;
  
  @Prop() pixelPerUnit: number;
  @State() datasouce: any
  
  render() {
    // console.dir(["title",this.datasouce]);
    
    return <Host>
      <ibcs-chart-structure
        width= {this.width}
        height= {this.height}
        data= { [{name: "100",    scenario1: 5, scenario2: 15, scenario3: 10, scenario4: 5},
                 {name: "test-B", scenario1: 5,  scenario2: 30,  scenario3: 5, scenario4: 5},
                 {name: "test-CFDFDFDFG", scenario1: 10,  scenario2: 10, scenario3: 5, scenario4: 5},
                 {name: "test-D", scenario1: 10, scenario2: 50, scenario3: 23, scenario4: 45},
                 {name: "test-E", scenario1: 25,  scenario2: 5,  scenario3: 43, scenario4: 56},
                 {name: "test-F", scenario1: 10,  scenario2: 20, scenario3: 44, scenario4: 23},
                 {name: "100",    scenario1: 10, scenario2: 5, scenario3: 5, scenario4: 5},
       ]}
       scenarios={this.scenarios.split(",")}
       variances={this.variances.split(",")}
       hideCategories={this.hideCategories}
       pixelPerUnit={this.pixelPerUnit}
      ></ibcs-chart-structure>
    </Host>
  }
}

styled(Chart);
