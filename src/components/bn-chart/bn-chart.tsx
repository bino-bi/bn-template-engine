import {Component, Element, h, Host, Prop, State, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import { isValidBoolean, validateScenarioList, validateVariancesList } from "../../utils/validate";

@Component({
  tag: 'bn-chart'
})
export class Chart {
  // @ts-ignore
  @Element() private element: HTMLElement;

  // @Prop() order?: string;
  // @Prop() orderDirection?: string;

    /** 
    * (mandatory) List of 4 scenarios. 
    * the position of the scenario is maped to the datasource
    * column scenario1 - scenario4
    * 
    * Valid scenarios are 
    *  
    *  values: ac | fc | py | pl  (1-4)
    *  example: ac, ac2, ac3, ac4
    */
  @Prop() scenarios!: string;
  
  /**
   *  (optional) list of additonal variances which 
   *   are calculated form the given scenarios.
   *   the scenarios used in the variances have also 
   *   be defined in the *scenarios* property.
   *   
   *   the variance is defiend as  (Scenario A -  SvenarioB)
   *   neg and pos post fix defines which value is *good* 
   *   a negative or a positive value.
   * 
   *   pattern:  d<scenarioB>_<scenarioA>_[pos|neg] 
   * 
   */
  @Prop() variances: string = '';    //dfc_ac_neg

  /**
   * (optional) toggle for hiding categories labels
   * 
   * values: true | false
   */
  @Prop() hideCategories: boolean = false;

  /**
   * (optional) toggle for hiding main table 
   * and only displays variances
   * 
   * if hidden variances can display categories 
   *
   * values: true | false
   */
  @Prop() hideMain: boolean = false; 
  
  /**
   * Name of the 'scaling-group' which the chart uses 
   * scalig groups are maintained globaly 
   *  
   * alternativly a number which represent the 
   * pixel per measure unit directy. the 
   */
  @Prop() unitScaling!: string | number;

  @Prop() chartTitle: string;
  




  @Prop() i18n?: string;
  @Prop() canvasWidth?: number;
  @Prop() canvasHeight?: number;
  
  @Prop() styles?: 'String';
   
  @State() datasouce: any




  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios.length > 0) { throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.') };
  } 
  
  @Watch('variances')
  validateVariances(newValue: string) {
    const invalidScenarios: string[] = validateVariancesList(newValue);
    if (invalidScenarios.length > 0) { throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.') };
  }

  @Watch('hideCategories')
  validateHideCategories(newValue: boolean) {
    if (!isValidBoolean(newValue)) { throw new Error('hideCategories: invalid value(s) \'' + newValue + '\' are not supported.') };
  }
  
  @Watch('hideMain')
  validateHideMain(newValue: boolean) {
    if (!isValidBoolean(newValue)) { throw new Error('scenarios: invalid value(s) \'' + newValue + '\' are not supported.') };
  }



  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateHideCategories(this.hideCategories);
    this.validateHideMain(this.hideMain);
  }


  render() {
    // console.dir(["title",this.datasouce]);
    
    return <Host>
      <ibcs-chart-structure
        width= {this.canvasWidth}
        height= {this.canvasHeight}
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
       pixelPerUnit={this.unitScaling}
       chartTitle = {this.chartTitle}
       styles = {null}
       i18n = {null}
      ></ibcs-chart-structure>
    </Host>
  }
}

styled(Chart);
