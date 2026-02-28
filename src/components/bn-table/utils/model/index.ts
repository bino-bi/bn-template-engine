import { TableRow } from "../elements";

/**
 * Strategy interface for IBCS visualisation rules.
 * Maps scenario names to their visual properties (color, sort order, grouping).
 */
export interface VisualisationRuleSet {
  getScenario(scenarioName: string): Scenario;

  getScenarioGroup(scenarioName: string): string;

  getScenarioColorIndex(scenarioName: string): number;

  getScenarioSorIndex(scenarioName: string): number;

  // getDateFormatter(type: DateDistanceType, modus: DateDistanceMode): string;
}

/** Sentinel value indicating all groups should be included. */
export enum GroupSelection {
  ALL = -1,
}

/**
 * Tracks whether a factory's output is current or needs recalculation.
 * Used to avoid redundant re-rendering when underlying data has not changed.
 */
export enum FactoryState {
  /** Output matches the current input data. */
  UP_TO_DATE,
  /** Input data has changed; output needs to be regenerated. */
  DIRTY,
}

/** Fully assembled table dataset ready for rendering, including header and detail rows. */
export interface TableDataSet {
  type: string;
  version: string;
  name: string;
  author: string;
  description: string;
  executedBy: string;
  timestamp: Date;
  query: string;
  header: TableRow[];
  details: TableRow[];
}

/**
 * Table aggregation modes controlling how rows are grouped and totalled.
 *
 * - `LIST` -- Flat list with no aggregation.
 * - `SUM` -- Grouped rows with sum totals per group and a grand total.
 * - `SUMNOTOTAL` -- Grouped rows with group sums but no grand total row.
 * - `OPT` -- Operation-aware aggregation (respects the +/- operation field).
 * - `OPTNOTOTAL` -- Operation-aware aggregation without a grand total row.
 */
export enum TableType {
  LIST = "list",
  SUM = "sum",
  SUMNOTOTAL = "sumnototal",
  OPT = "opt",
  OPTNOTOTAL = "optnototal",
}

export enum OrderDirection {
  ASC = "asc",
  DESC = "desc",
}

/**
 * Discriminator for rendered table rows, controlling visual styling and behavior.
 *
 * - `HEADER` -- Column header row.
 * - `GROUPHEAD` -- Group title row (rendered when `grouped` is true).
 * - `SEPERATORLINE` -- Visual divider between groups.
 * - `SUM` -- Grand total row.
 * - `GROUPSUM` -- Sub-total row for a single group.
 * - `DRILLELEMENT` -- "Thereof" drill-down sub-row.
 * - `STANDARD` -- Normal data row.
 * - `PARTELEMENT` -- "Part of" percentage row.
 * - `ENTRY` -- Generic entry row.
 */
export enum TableRowType {
  HEADER = "HEADER",
  GROUPHEAD = "GROUPHEAD",
  SEPERATORLINE = "SEPERATORLINE",
  SUM = "SUM",
  GROUPSUM = "GROUP_SUM",
  DRILLELEMENT = "DRILLELEMENT",
  STANDARD = "STANDARD",
  PARTELEMENT = "PARTELEMENT",
  ENTRY = "ENTRY",
}

/**
 * Maps logical column roles to their actual SQL column names in AlaSQL queries.
 * Used by the query engine to build dynamic SELECT/GROUP BY statements
 * without hard-coding column identifiers.
 */
export interface ColumnNameMap {
  currentRow: string;
  operation: string;
  rowGroup: string;
  rowGroupIndex: string;
  category: string;
  categoryIndex: string;
  subcategory: string;
  subCategoryIndex: string;
  columnGroup: string;
  columnIndex: string;
  columnSubGroup: string;
  columnSubGroupIndex: string;
  ac1: string;
  ac2: string;
  ac3: string;
  ac4: string;
  pp1: string;
  pp2: string;
  pp3: string;
  pp4: string;
  fc1: string;
  fc2: string;
  fc3: string;
  fc4: string;
  pl1: string;
  pl2: string;
  pl3: string;
  pl4: string;
}

/**
 * IBCS scenario descriptor with visual properties for rendering.
 *
 * @property colorIndex - Index into the IBCS color palette (determines fill/stroke color).
 * @property sortIndex - Controls the left-to-right display order of scenario columns.
 */
export interface Scenario {
  name: string;
  /** Scenario type group (e.g. "ac", "pp", "fc", "pl"). */
  group: string;
  colorIndex: number;
  sortIndex: number;
}
