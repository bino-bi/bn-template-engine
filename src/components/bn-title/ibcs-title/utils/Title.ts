import {TitleDataSetFactory} from "./factories";
import {TitleConfig} from "./model/TitleConfig";
import {MeasureEntry} from "./model/MeasureEntriy";

 
enum FactoryState {
  UP_TO_DATE,
  DIRTY,
}

export class Title {

  i18n: Map<string, string> = new Map<string, string>();
  private ruleSet: IBCSRuleSet;
  public unit: string = '';
  public measures: MeasureEntry[] = [];
  public dimension: string = '';
  private dataSetFactory: TitleDataSetFactory;
  private config: TitleConfig = new TitleConfig();
  private state: FactoryState = FactoryState.DIRTY;

  constructor(ruleSet: IBCSRuleSet) {
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.dataSetFactory = new TitleDataSetFactory();
    this.state = FactoryState.DIRTY;

    this.setI18n(new Map<string, string>());
  }


  /**
   * Set Localisation Map
   * @param i18n
   */
  public setI18n(i18n: Map<string, string>) {
    this.state = FactoryState.DIRTY; // mark dataSet for update

    const defaultI18n: Map<string, string> = new Map<string, string>([
      ["SEPERATOR_WS", ", "], ["in", "in"], ["ORDER_asc", "↑"], ["ORDER_desc", "↓"],
      ["ac1", "AC"], ["pp1", "PY"], ["fc1", "FC"], ["pl1", "PL"],
      ["ac2", "AC2"], ["pp2", "PY2"], ["fc2", "FC2"], ["pl2", "PL2"],
      ["ac3", "AC3"], ["pp3", "PY3"], ["fc3", "FC3"], ["pp3", "PL3"],
      ["ac4", "AC4"], ["py4", "PY4"], ["fc4", "FC4"], ["pp4", "PL4"],
      ["category", " "], ["operation", " "], ["there_of", "davon"], ["part_of", "in % von"], ["ibcssymbol_delta_ac", "Δ{%}"],
      ["ibcssymbol_delta_generic", "Δ({%})"], ["ibcssymbol_delta_ac_relative", "Δ{%}%"],
      ["ibcssymbol_delta_generic_relative", "Δ({%})%"], ["SUM_TOTAL", "❖"], ["CONNECTOR_WS", " und "]
    ]);

    this.i18n = new Map([...defaultI18n, ...i18n || new Map<string, string>()]);

  }

  /**
   * Generates and Returns the DataSet based,
   * data and config.
   * if data or config have not been changed since last run
   * the dataSet will not be regenerated.
   */
  public update(): Title {
    if (FactoryState.DIRTY == this.state) {

      this.unit = this.config.businessunit;
      this.measures = this.dataSetFactory.createMeasures(this.config.measures, this.i18n, this.config.i18nMode);
      this.dimension = this.dataSetFactory.createDimension(this.config.scenarios, this.config.timeperiod, this.config.order, this.i18n, this.config.intervalSpanLimit);
      this.state = FactoryState.UP_TO_DATE;
    }
    return this;
  }


  public setConfig(config: TitleConfig) {
    this.config = this.initConfig(config);
  }

  private initConfig(config: TitleConfig): TitleConfig {
    this.state = FactoryState.DIRTY; 
    let tmpConfig: TitleConfig = config ;

    // this.checkConfigIfValidElseSetDefaultOrder(config.order);
    // sorting scenario order based on Ruleset
    let self = this;
    
    config.scenarios.sort((n1, n2) => {     
      return self.ruleSet.getScenarioSorIndex(n1) - self.ruleSet.getScenarioSorIndex(n2);
    });
  
    return tmpConfig;
  }


}
