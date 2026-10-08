import { VisualisationRuleSet, FactoryState, ScenarioHeaderColumn } from "./model";
// import {IBCSRuleSet} from "../../../utils/ibcsRuleSet";
import { TableDataSetFactory } from "./factories/tableDataSetFactory";
import { TableRow } from "./elements";
import { TableComponentConfig } from "./model/TableComponentConfig";
// import { Order } from "../../../utils/model/Order";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { Order } from "../../../components";
import { AlaSQLDatabase, sourceExpr } from "../../../context/scopedDb";
import { INTERVAL_NONE, IntervalBucket, queryIntervalBuckets, resolveIntervalGranularity } from "./helper";

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
  private intervalBuckets: IntervalBucket[] = [];

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
      ["SEPARATOR_WS", ", "],
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
      ["category", " "],
      ["operation", " "],
      ["thereof", "davon"],
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

  /**
   * Resolves the dataset (a table or view in the shared alasql database),
   * caches its row count, and marks the rows stale.
   *
   * Deliberately does NOT build header/body rows. The constructor runs before
   * the component calls {@link setI18n}, so rows built here would carry the
   * built-in fallback labels and be thrown away by the first `update()` - the
   * whole N+1 query pass, run twice per render, for a result that was wrong.
   *
   * `fromExpr` and `rowCount` must stay eager: `hasNoData()` reads `rowCount`
   * and the component consults it before any `getHeader()`/`getBody()` call
   * would trigger the deferred update.
   */
  public setSource(tableName: string, filter: string) {
    this.state = FactoryState.DIRTY;

    // "" while the source is not registered (e.g. the datasource has not loaded yet): treated as empty
    this.fromExpr = sourceExpr(this.db, tableName, filter);
    if (!this.fromExpr) {
      this.rowCount = 0;
      return;
    }

    // a failure here (e.g. a filter alasql cannot read) is the caller's ERR_sql
    const r = this.db.exec<{ cnt: number }[]>(`SELECT COUNT(*) AS cnt FROM ${this.fromExpr}`);
    this.rowCount = (r[0]?.cnt ?? 0) as number;
  }

  public update() {
    this.prepareIntervalBuckets();

    const normalizedScenarios = this.normalizeScenarios(
      this.config.scenarios,
      this.config.categoryThereOf,
      this.config.sortOrder,
      this.intervalBuckets,
    );

    this.headerRows = this.dataSetFactory.createHeader(
      this.config.type,
      normalizedScenarios,
      this.i18n,
      this.config.measureScale,
      this.config.measureUnit,
      this.config.showMeasureScale,
      this.config.attributes,
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

  /** Effective column definitions: category/operation + attributes + scenarios × interval buckets. */
  public getColumns(): ScenarioHeaderColumn[] {
    if (this.state === FactoryState.DIRTY) {
      this.update();
    }

    return this.dataSetFactory.getNormalizedHeader();
  }

  /**
   * Resolves the interval configuration into the concrete bucket list.
   * `auto` is narrowed to a concrete granularity (written back to the config so
   * the query engine sees it); when no usable buckets exist the feature is
   * deactivated. `columnthereof` takes precedence (both use the `##` namespace).
   */
  private prepareIntervalBuckets() {
    this.intervalBuckets = [];
    if (this.config.interval === INTERVAL_NONE || !this.fromExpr || this.config.categoryThereOf.size > 0) {
      this.config.interval = INTERVAL_NONE;
      return;
    }

    this.config.interval = resolveIntervalGranularity(this.db, this.fromExpr, this.config.interval);
    this.intervalBuckets = queryIntervalBuckets(this.db, this.fromExpr, this.config.interval, this.config.locale);

    if (this.intervalBuckets.length === 0) {
      // e.g. date interval selected but the data carries no valid dates
      this.config.interval = INTERVAL_NONE;
    }
  }

  private normalizeScenarios(
    scenarios: string[],
    categoryThereOf: Map<string, Record<string, unknown>[]>,
    order: Order,
    intervalBuckets: IntervalBucket[] = [],
  ): ScenarioHeaderColumn[] {
    const normalizedScenarios: ScenarioHeaderColumn[] = [];

    if (intervalBuckets.length > 0) {
      for (const bucket of intervalBuckets) {
        for (const scenario of scenarios) {
          normalizedScenarios.push({
            name: scenario,
            group: scenario,
            type: scenario,
            order: order?.hierarchy?.at(0) === scenario ? order.direction : undefined,
            bucket: bucket.key,
            bucketLabel: bucket.label,
          });
        }
      }
      return normalizedScenarios;
    }

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

  /** True once the body was built and the grouped table has rows with a blank rowGroup. */
  public hasBlankRowGroup(): boolean {
    return this.dataSetFactory.hasBlankRowGroup;
  }
}
