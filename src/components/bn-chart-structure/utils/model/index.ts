export * from "./StructureChartComponentConfig";
export * from "./DataPoint";
export * from "./StructureChartDataRow";
export * from "./styles/StructureChartStyle";
export * from "./styles/ScaleFactorsStructureChart";

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

export enum Scenario {
  AC1 = "ac1",
  PP1 = "pp1",
  FC1 = "fc1",
  PL1 = "pl1",
  AC2 = "ac2",
  PP2 = "pp2",
  FC2= "fc2",
  PL2 = "pl2",
  AC3 = "ac3",
  PP3 = "pp3",
  FC3 = "fc3",
  PL3 = "pl3",
  AC4 = "ac4",
  PP4 = "pp4",
  FC4 = "fc4",
  PL4 = "pl4",
  POS = "pos",
  NEG = "neg",
  NEU = "neu",
}

export enum TableType {
  LIST = "LIST",
  SUM = "SUM",
  OPT = "OPT",
}


export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Data {
  label: string;
  count: number;
}

export interface StructureChartDimension{
  barLength: number;
  xPos: number;
  yPos: number;
  labelXPos: number;
  scenarioLabelXPos: number;
  scenarioLabelYPos:number;
  clipped: boolean;
};
