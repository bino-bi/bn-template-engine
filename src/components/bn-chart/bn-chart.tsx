import {Component, Element, h, Host, Prop, State, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import { isValidBoolean, isValidMeasure, validateScenarioList, validateVariancesList } from "../../utils/validate";

@Component({
  tag: 'bn-chart',
  styleUrl: "bn-chart.scss",
})
export class Chart {
  // @ts-ignore
  @Element() private element: HTMLElement;

  // @Prop() order?: string;
  // @Prop() orderDirection?: string;
  
  
    /** 
    * (mandatory) List of Scenarios Map. 
    * the position of the scenario is maped to the datasource
    * column scenario1 - scenario4
    * 
    * if empty the main chart is hidden
    * 
    * Valid scenarios are 
    *  
    *  values: ac | fc | py | pl  (1-4) 
    *  example: ac, ac2, ac3, ac4
    * 
    *  list of additonal variances which 
   *   are calculated form the given scenarios.
   *   the scenarios used in the variances have also 
   *   be defined in the *scenarios* property.
   *   
   *   the variance is defiend as  (Scenario A -  SvenarioB)
   *   neg and pos post fix defines which value is *good* 
   *   a negative or a positive value.
   * 
   *   if empty variance charts are hidden
   *   
   *   each variance creates a chart  
   *  
   *   pattern:  d<scenarioB>_<scenarioA>_[pos|neg] 
    */
   @Prop() scenarios!: string;
  
    
  /**
   * Name of the 'scaling-group' which the chart uses 
   * scalig groups are maintained globaly 
   *  
   * alternativly a number which represent the 
   * pixel per measure unit directy. the 
   */
  @Prop() unitScaling!: string;

  /**
   * (optional) Name of Chart displayed on top of the axis
   * 
   */
  @Prop() chartTitle: string;


  @Prop() i18n?: string;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() styles?: 'String';
  @State() datasouce: any

  private pixelPerUnit: number = 0;
  private scenariosArray: string[];
  private basicScenarios: string[];
  private canvasWidthSegmented: number;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    this.scenariosArray = this.scenarios.split(";"); 
    
    const invalidScenarios: string[] = validateScenarioList(this.scenariosArray[0]);
  
    if (invalidScenarios.length > 0) { 
          throw new Error('scenarios: invalid value(s) \'' + invalidScenarios.toString() + '\' are not supported.') 
    }
    else{
        this.basicScenarios = this.scenariosArray[0].split(',');
    }
  
    let invalidVariances: string[] = [];
    for(let  i = 1; i < this.scenariosArray.length; i++) {
  
      invalidVariances = invalidVariances.concat(validateVariancesList(this.scenariosArray[i]));
    }
    
    if (invalidVariances.length > 0) { 
        throw new Error('scenarios: invalid value(s) \'' + invalidVariances.toString() + '\' are not supported.') 
    }

    this.canvasWidthSegmented =  this.element.clientHeight / this.scenarios.length;
   
  }

 
  
  @Watch('unitScaling')
  validateUnitScaling(newValue: string) {
    // 
    // Change with global unitmap  
    //
    let map = new Map<string, number>();
    map.set('test', 2 );
    // 

    if( map.has(newValue) ) {
      this.pixelPerUnit = map.get(newValue);  
    }
    else if( !isNaN( Number(newValue) ) ) {
       this.pixelPerUnit = Number(newValue);
    }
    else{
      throw new Error('unitScaling: invalid value(s) \'' + newValue + '\' are not supported.')
    }  

  }

 

  constructor(){
    this.chartTemplate = this.chartTemplate.bind(this);
  }


  componentWillLoad() {
    this.validateScenario(this.scenarios);
    this.validateUnitScaling(this.unitScaling);
  }

 
  chartTemplate(localScenarioString: string) {
    let localVariances = null;
    let isValidateVariancesList: boolean = validateVariancesList(localScenarioString).length == 0;

    if(isValidateVariancesList){
      localVariances = localScenarioString.split(',');
    }
 
    return     <ibcs-chart-structure
    width= {this.canvasWidthSegmented}
    height= {this.element.clientHeight}
    data= { [{name: "100",    scenario1: 5, scenario2: 15, scenario3: 10, scenario4: 5},
             {name: "test-B", scenario1: 5,  scenario2: 30,  scenario3: 5, scenario4: 5},
             {name: "test-CFDFDFDFG", scenario1: 10,  scenario2: 10, scenario3: 5, scenario4: 5},
             {name: "test-D", scenario1: 10, scenario2: 50, scenario3: 23, scenario4: 45},
             {name: "test-E", scenario1: 25,  scenario2: 5,  scenario3: 43, scenario4: 56},
             {name: "test-F", scenario1: 10,  scenario2: 20, scenario3: 44, scenario4: 23},
             {name: "100",    scenario1: 10, scenario2: 5, scenario3: 5, scenario4: 5},
   ]}
   scenarios={this.basicScenarios}
   variances={localVariances}
   hideCategories={isValidateVariancesList}
   pixelPerUnit={this.pixelPerUnit}
   chartTitle = {this.chartTitle}
   styles = {null}
   i18n = {null}
  ></ibcs-chart-structure>
  }

  render() {
    this.canvasWidthSegmented = this.width / this.scenariosArray.length;

    return <Host>
    <div class="container">
      {this.scenariosArray.map(this.chartTemplate)}
    </div>
    </Host>
  }
}

styled(Chart);
