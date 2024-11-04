import {TableRow} from "../elements";

export interface VisualisationRuleSet {
  getScenario(scenarioName: string): Scenario;

  getScenarioGroup(scenarioName: string): string;

  getScenarioColorIndex(scenarioName: string): number;

  getScenarioSorIndex(scenarioName: string): number;

  // getDateFormatter(type: DateDistanceType, modus: DateDistanceMode): string;
}


export enum GroupSelection {
  ALL = -1,
}

export enum FactoryState {
  UP_TO_DATE,
  DIRTY,
}

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


export enum TableType {
  LIST = "list",
  SUM = "sum",
  SUMNOTOTAL = "sumnototal",
  OPT = "opt",
  OPTNOTOTAL = "optnototal"
}

export enum OrderDirection {
  ASC = "asc",
  DESC = "desc",
}

export enum TableRowType {
  HEADER = "HEADER",
  GROUPHEAD = "GROUPHEAD",
  SEPERATORLINE = "SEPERATORLINE",
  SUM = "SUM",
  GROUPSUM = "GROUP_SUM",
  DRILLELEMENT = "DRILLELEMENT",
  STANDARD = "STANDARD",
  PARTELEMENT = "PARTELEMENT",
  ENTRY = "ENTRY"
}




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


export interface Scenario {
  name: string;
  group: string;
  colorIndex: number;
  sortIndex: number;
}


