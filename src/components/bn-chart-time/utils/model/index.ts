export * from "./DataPoint";
export * from "./DataPoint";
export * from "./TimeChartDataRow";
export * from "./styles/TimeChartStyle";
export * from "./styles/ScaleFactorsTimeChart";
export * from "./OverflowConfig";
/** A single table cell for the chart's internal tabular data representation. */
export interface Cell {
  value?: number | string;
  cssStyle?: string;
  mark?: string;
  colSpan?: number;
}

/**
 * A chart element within a row, supporting origin value and optional
 * "of-it" (thereof) and "share" (part-of) sub-cells.
 */
export interface Element {
  key: string;
  index: number;
  parent?: string;
  parentIndex?: number;
  colSpan?: number;

  origin: Cell;
  /** Thereof breakdown cell. */
  ofit?: Cell;
  /** Percentage share cell. */
  share?: Cell;
}

/** A rendered row in the chart's tabular sub-component. */
export interface Row {
  index: number;
  groupindex: number;
  type: string;
  cssStyle?: string;
  elements: Element[];
}

/**
 * IBCS scenario enumeration for time-series charts.
 *
 * Includes all 16 scenario slots (4 each of ac, pp, fc, pl) plus three
 * variance direction markers: POS (positive/favorable), NEG (negative/unfavorable),
 * NEU (neutral).
 */
export enum Scenario {
  AC1 = "ac1",
  PP1 = "pp1",
  FC1 = "fc1",
  PL1 = "pl1",
  AC2 = "ac2",
  PP2 = "pp2",
  FC2 = "fc2",
  PL2 = "pl2",
  AC3 = "ac3",
  PP3 = "pp3",
  FC3 = "fc3",
  PL3 = "pl3",
  AC4 = "ac4",
  PP4 = "pp4",
  FC4 = "fc4",
  PL4 = "pl4",
  /** Positive/favorable variance (rendered in green per IBCS). */
  POS = "pos",
  /** Negative/unfavorable variance (rendered in red per IBCS). */
  NEG = "neg",
  /** Neutral variance (rendered in grey per IBCS). */
  NEU = "neu",
}

/** Chart-internal table aggregation modes. */
export enum TableType {
  LIST = "LIST",
  SUM = "SUM",
  OPT = "OPT",
}

/** Axis-aligned bounding box for label collision detection in chart rendering. */
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

/**
 * Luxon format templates for date axis labels at each granularity level.
 *
 * Each property holds a Luxon-compatible format string (e.g. `"yyyy"`, `"MMM"`, `"dd"`).
 * The `fallback` template is used when no specific granularity matches.
 * Indexed by string to allow dynamic lookup by {@link DateDistance} keys.
 */
export interface DateFormat {
  year: string;
  quarter: string;
  month: string;
  week: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  millisecond: string;
  fallback: string;

  [index: string]: string;
}

/**
 * Luxon format templates for date link/aggregation labels.
 *
 * Used when dates represent aggregated periods (year-to-date, cumulative, etc.)
 * rather than individual points. Indexed by string for dynamic lookup.
 */
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

  [index: string]: string;
}

/**
 * Pre-calculated layout dimensions for a single time-series chart column.
 * Used by the SVG renderer to position bars, labels, and scenario indicators.
 */
export interface TimeChartDimension {
  /** Width of the data column in pixels. */
  columnLength: number;
  xPos: number;
  yPos: number;
  labelYPos: number;
  scenarioLabelXPos: number;
  scenarioLabelYPos: number;
  /** True if the value was clipped by the percentage threshold. */
  clipped: boolean;
}
