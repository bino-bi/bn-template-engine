export interface Cell {
  value?: number | string;
  cssStyle?: string;
  mark?: string;
  colSpan?: number;
}

export interface Element {
  key: string;
  index: number;
  parent?: string;
  parentIndex?: number;
  colSpan?: number;

  origin: Cell;
  ofit?: Cell;
  share?: Cell;
}

export interface Row {
  index: number;
  groupindex: number;
  type: string;
  cssStyle?: string;
  elements: Element[];
}

export enum TableType {
  LIST = "LIST",
  SUM = "SUM",
  OPT = "OPT",
}

export interface Scenario {
  name: string;
  group: string;
  colorIndex: number;
  sortIndex: number;
}

export type { DateFormat, DateLinkFormat } from "../../../../../utils/model/DateFormat";
