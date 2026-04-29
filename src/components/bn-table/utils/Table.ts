import { VisualisationRuleSet, FactoryState } from "./model";
// import {IBCSRuleSet} from "../../../utils/ibcsRuleSet";
import { TableDataSetFactory } from "./factories/tableDataSetFactory";
import { TableRow } from "./elements";
import { TableComponentConfig } from "./model/TableComponentConfig";
// import { Order } from "../../../utils/model/Order";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { Order } from "../../../components";
import { AlaSQLDatabase, buildFromExpr } from "../../../context/scopedDb";

/**
 * High-level controller for IBCS table generation.
 *
 * Coordinates the data pipeline: raw data is filtered via AlaSQL, scenarios are
 * sorted by the visualization rule set, and TableDataSetFactory produces the
 * header rows (with i18n-translated labels) and body rows (with grouped/drilled data).
 *
 * Uses a dirty-flag pattern (FactoryState) to lazily regenerate header/body rows
 * only when configuration, data, or i18n changes. getHeader() and getBody() trigger
 * regeneration if the state is dirty.
 */
export class Table {
  private ruleSet: VisualisationRuleSet;
  private config: TableComponentConfig;
  private dataSetFactory: TableDataSetFactory;
  private i18n: Map<string | number, string>;
  private state: FactoryState; // is uesed to track if dataset has to be reenerated (true) or if the stored one is still valid (false)

  private db: AlaSQLDatabase;
  private fromExpr: string = "";
  private rowCount: number = 0;
  private headerRows: TableRow[] = [];
  private bodyRows: TableRow[] = [];

  /**
   * Initialises all Variables for the DataSet, created by the factory.
   * Reads data directly from the shared alasql database (named by `tableName`).
   */
  constructor(ruleSet: VisualisationRuleSet, db: AlaSQLDatabase, tableName: string, config: TableComponentConfig) {
    this.ruleSet = ruleSet || new IBCSRuleSet();
    this.db = db;
    this.dataSetFactory = new TableDataSetFactory();

    this.config = this.initConfig(config);
    this.i18n = this.initI18n(new Map<string, string>());
    this.setSource(tableName, config.filter);
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

  public setSource(tableName: string, filter: string) {
    if (!tableName) {
      this.fromExpr = "";
      this.rowCount = 0;
      return;
    }

    this.fromExpr = buildFromExpr(tableName, filter);

    try {
      const r = this.db.exec<{ cnt: number }[]>(`SELECT COUNT(*) AS cnt FROM ${this.fromExpr}`);
      this.rowCount = (r[0]?.cnt ?? 0) as number;
    } catch (_e) {
      // Table may not exist yet (e.g. datasource hasn't loaded). Treat as empty.
      this.rowCount = 0;
    }

    const normalizedScenarios = this.normalizeScenarios(
      this.config.scenarios,
      this.config.categoryThereOf,
      this.config.sortOrder,
    );

    this.headerRows = this.dataSetFactory.createHeader(
      this.config.type,
      normalizedScenarios,
      this.i18n,
      this.config.measureScale,
      this.config.measureUnit,
      this.config.showMeasureScale,
    );

    this.bodyRows =
      this.rowCount === 0 ? [] : this.dataSetFactory.createBodyRows(this.config, this.i18n, this.db, this.fromExpr);
    this.state = FactoryState.UP_TO_DATE;
  }

  public update() {
    const normalizedScenarios = this.normalizeScenarios(
      this.config.scenarios,
      this.config.categoryThereOf,
      this.config.sortOrder,
    );

    this.headerRows = this.dataSetFactory.createHeader(
      this.config.type,
      normalizedScenarios,
      this.i18n,
      this.config.measureScale,
      this.config.measureUnit,
      this.config.showMeasureScale,
    );
    this.bodyRows =
      this.rowCount === 0 || !this.fromExpr
        ? []
        : this.dataSetFactory.createBodyRows(this.config, this.i18n, this.db, this.fromExpr);
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
            name: drillElement.name as string,
            group: drillElement.name as string,
            type: scenario,
            order: undefined,
          });
          for (const drillSubElement of (drillElement as Record<string, unknown>).subGroups as string[]) {
            normalizedScenarios.push({
              name: drillSubElement,
              group: drillElement.name as string,
              type: scenario,
              order: undefined,
            });
          }
        }
        normalizedScenarios.push({ name: "REST", group: "REST", type: scenario, order: undefined });
      }

      let orderDirection = undefined;
      if (order?.hierarchy?.at(0) === scenario) {
        orderDirection = order.direction;
      }

      normalizedScenarios.push({ name: scenario, group: scenario, type: scenario, order: orderDirection });
    }
    return normalizedScenarios;
  }

  hasNoData() {
    return this.rowCount === 0;
  }
}
