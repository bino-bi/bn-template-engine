import { VisualisationRuleSet, FactoryState } from "./model";
// import {IBCSRuleSet} from "../../../utils/ibcsRuleSet";
import { TableDataSetFactory } from "./factories/tableDataSetFactory";
import { TableRow } from "./elements";
import { TableComponentConfig } from "./model/TableComponentConfig";
import { TableDataRow } from "./model/TableDataRow";
// import { Order } from "../../../utils/model/Order";
import alasql from "alasql";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { Order } from "../../../components";

export class Table {
  private ruleSet: VisualisationRuleSet;
  private config: TableComponentConfig;
  private dataSetFactory: TableDataSetFactory;
  private i18n: Map<string | number, string>;
  private state: FactoryState; // is uesed to track if dataset has to be reenerated (true) or if the stored one is still valid (false)

  private data: TableDataRow[] = [];
  private headerRows: TableRow[] = [];
  private bodyRows: TableRow[] = [];

  /**
   * Initialises all Variables for the DataSet, created by the factory
   * @param ruleSet
   */

  constructor(ruleSet: VisualisationRuleSet, data: TableDataRow[], config: TableComponentConfig) {
    this.ruleSet = ruleSet || new IBCSRuleSet();

    this.dataSetFactory = new TableDataSetFactory();

    this.config = this.initConfig(config);
    this.i18n = this.initI18n(new Map<string, string>());
    this.setData(data, config.filter);
    this.state = FactoryState.DIRTY;
  }

  /**
   * Init load of translation dictionary map
   * map is used to translate lables in the table
   *
   * example:
   * ```
   *   let i18n: Map<string, string> = new Map();
   *   [{key: 'ac',value: 'AC'}].forEach(function(entry){
   *         i18n.set(entry.key, entry.value);
   *   })
   * ```
   * @param i18n
   */
  public setI18n(i18n: Map<string, string>) {
    this.i18n = this.initI18n(i18n);
  }

  private initI18n(i18n: Map<string, string>): Map<string, string> {
    const defaultI18n: Map<string, string> = new Map<string, string>([
      ["", ""],
      ["SEPERATOR_WS", ", "],
      ["in", "in"],
      ["ORDER_asc", "↑"],
      ["ORDER_desc", "↓"],
      ["ac1", "AC"],
      ["pp1", "PY"],
      ["fc1", "FC"],
      ["pl1", "PL"],
      ["ac2", "AC2"],
      ["pp2", "PY2"],
      ["fc2", "FC2"],
      ["pl2", "PL2"],
      ["ac3", "AC3"],
      ["pp3", "PY3"],
      ["fc3", "FC3"],
      ["pl3", "PL3"],
      ["ac4", "AC4"],
      ["pp4", "PY4"],
      ["fc4", "FC4"],
      ["pl4", "PL4"],
      ["in", "in"],
      ["category", " "],
      ["operation", " "],
      ["there_of", "davon"],
      ["part_of", "in % von"],
      ["ibcssymbol_delta_ac", "Δ{%}"],
      ["ibcssymbol_delta_generic", "Δ({%})"],
      ["ibcssymbol_delta_ac_relative", "Δ{%}%"],
      ["ibcssymbol_delta_generic_relative", "Δ({%})%"],
      ["SUM_TOTAL", "❖"],
    ]);

    this.state = FactoryState.DIRTY; // mark dataSet for update
    return new Map([...defaultI18n, ...(i18n || new Map<string, string>())]);
  }

  private initConfig(config: TableComponentConfig): TableComponentConfig {
    this.state = FactoryState.DIRTY; // mark dataSet for update
    const tmpConfig: TableComponentConfig = config;

    // this.checkConfigIfValidElseSetDefaultOrder(config.order);
    // sorting scenario order based on Ruleset
    const self = this;

    config.scenarios.sort((n1, n2) => {
      return self.ruleSet.getScenarioSorIndex(n1) - self.ruleSet.getScenarioSorIndex(n2);
    });

    return tmpConfig;
  }

  /**
   * loads and varifies configuration which describes
   * the filte for the to be generated dataset
   *
   * missing but necessary attributes are replaced by default values
   *
   * @param config
   */
  public setConfig(config: TableComponentConfig) {
    this.config = this.initConfig(config);
  }

  public setData(data: TableDataRow[], filter: string) {
    if (data == null) {
      return;
    }

    if (filter != null && filter.length > 0) {
      try {
        this.data = alasql(`SELECT * FROM ? WHERE ${filter}`, [data]);
      } catch (e) {
        console.error("Table: filter query failed, using unfiltered data", filter, e);
        this.data = data;
      }
    } else {
      this.data = data;
    }

    const normalizedScenarios = this.normalizeScenarios(
      this.config.scenarios,
      this.config.categoryThereOf,
      this.config.order,
    );

    this.headerRows = this.dataSetFactory.createHeader(
      this.config.type,
      normalizedScenarios,
      this.i18n,
      this.config.measureScale,
      this.config.measureUnit,
      this.config.showMeasureScale,
    );

    this.bodyRows = this.dataSetFactory.createBodyRows(this.config, this.i18n, this.data);
    this.state = FactoryState.UP_TO_DATE;
  }

  public update() {
    const normalizedScenarios = this.normalizeScenarios(
      this.config.scenarios,
      this.config.categoryThereOf,
      this.config.order,
    );

    this.headerRows = this.dataSetFactory.createHeader(
      this.config.type,
      normalizedScenarios,
      this.i18n,
      this.config.measureScale,
      this.config.measureUnit,
      this.config.showMeasureScale,
    );
    this.bodyRows = this.dataSetFactory.createBodyRows(this.config, this.i18n, this.data);
    this.state = FactoryState.UP_TO_DATE;
  }

  public getHeader(): TableRow[] {
    if (this.state === FactoryState.DIRTY) {
      this.update();
    }

    return this.headerRows;
  }

  public getBody(): TableRow[] {
    if (this.state === FactoryState.DIRTY) {
      this.update();
    }

    return this.bodyRows;
  }

  private normalizeScenarios(
    scenarios: string[],
    categoryThereOf: Map<string, Record<string, unknown>[]>,
    order: Order,
  ): { name: string; group: string; type: string; order: string | undefined }[] {
    const normalizedScenarios: { name: string; group: string; type: string; order: string | undefined }[] = [];

    for (const scenario of scenarios) {
      if (categoryThereOf?.has(scenario)) {
        const categoryDrills = categoryThereOf.get(scenario);
        for (const drillElement of categoryDrills) {
          normalizedScenarios.push({
            name: drillElement.name,
            group: drillElement.name,
            type: scenario,
            order: undefined,
          });
          for (const drillSubElement of drillElement.subGroups) {
            normalizedScenarios.push({
              name: drillSubElement,
              group: drillElement.name,
              type: scenario,
              order: undefined,
            });
          }
        }
        normalizedScenarios.push({ name: "REST", group: "REST", type: scenario, order: undefined });
      }

      let orderDirection = undefined;
      if (order?.hierarchy?.at(0) == scenario) {
        orderDirection = order.direction;
      }

      normalizedScenarios.push({ name: scenario, group: scenario, type: scenario, order: orderDirection });
    }
    return normalizedScenarios;
  }

  hasNoData() {
    return this.data.length == 0;
  }
}
