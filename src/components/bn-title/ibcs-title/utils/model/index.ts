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

export interface DateFormat {
  [key: string]: unknown;
  year: string;
  quarter: string;
  month: string;
  week: string;
  day: string;
  time: string;
  fallback: string;
}

export interface DateLinkFormat {
  avg: string;
  interval: string;
  start: string;
  end: string;
  ytd: string;
  ytg: string;
  cum: string;
  mat: string;
  none: string;
}
