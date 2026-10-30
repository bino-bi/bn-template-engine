// import {Formatter} from "../../../../utils/formatter";
// import {DataFormatDigits} from "../../../../utils/model/DataFormatDigits";

import { DataFormatDigits } from "../../../../components";
import { Formatter } from "../../../../utils";
import { WaterfallBarData } from "../helper/WaterfallCalculator";

/** The percent sign of a formatted percent (Latin or Arabic), with the spaces and direction marks around it. */
const PERCENT_SIGN = /[\s\u200e\u200f\u061c]*[%\u066a][\s\u200e\u200f\u061c]*/;

/** Min/max statistics for a single data column, used to scale inline bar charts. */
export interface ColumnStats {
  min: number;
  max: number;
  absMax: number;
  median: number;
}

/**
 * Represents a single table cell with formatting and rendering capabilities.
 *
 * The draw() method implements a formatting pipeline:
 * 1. Checks for undefined/null/NaN values -- returns empty string for missing data
 * 2. Non-numeric values (category labels) are returned as-is
 * 3. Numeric values are routed through Formatter.number() with the cell's type
 *    (decimal, percent or percentpoint) and configured digit precision
 * 4. For decimal type, the raw value is divided by measureScale before formatting,
 *    enabling SI prefix display (e.g. "in Mio EUR")
 */
export class Cell {
  key: string;
  index: number;
  prefix: string;
  value: number | string | null;
  cssStyle: string;
  prefixStyle: string = "prefix";
  type: string | null;
  mark: string | undefined;
  colSpan: number;
  isBarChart: boolean = false;
  columnStats?: ColumnStats;
  waterfall?: WaterfallBarData;
  measureScale: number;
  /** The first day of the bucket of an interval column. */
  date?: string;

  constructor(
    scenario: string,
    index: number,
    value: number | string | null,
    cssStyle: string | null,
    type: string | null,
    prefix: string | null,
    prefixStyle: string | null,
    colSpan: number | null,
    measureScale: number | null | undefined,
  ) {
    this.key = scenario;
    this.index = index;

    this.value = value;
    this.prefix = prefix || "";
    this.cssStyle = cssStyle || "";
    this.prefixStyle = prefixStyle || "prefix";
    this.type = type;
    this.mark = undefined;
    this.colSpan = colSpan || 1;
    this.measureScale = measureScale || 1;
  }

  getAsHeaderList(): Array<string | number> {
    if (this.value == null) {
      return [""];
    }

    const result: Array<string | number> = [];
    for (const line of this.value.toString().split("<br/>")) {
      result.push(line);
    }

    return result;
  }

  public draw(dataFormatDigits: DataFormatDigits, locale?: string) {
    let cellValue = this.value;

    if (cellValue === "undefined" || cellValue === undefined || cellValue == null) {
      return "";
    }

    if (Number.isNaN(Number(cellValue))) {
      return cellValue;
    }

    if (this.type === "" || this.type === undefined || this.type == null) {
      return cellValue;
    }

    let digitsMin = dataFormatDigits.percent;
    let scale = dataFormatDigits.percent;

    if (this.type === "percentpoint") {
      // difference of two percent values: percentage points, rounded like a percent cell, without the sign
      return Formatter.number(Number(cellValue), "percent", digitsMin, scale, 1, locale).replace(PERCENT_SIGN, "");
    }

    if (this.type === "decimal") {
      cellValue = +cellValue / this.measureScale;
      digitsMin = dataFormatDigits.decimal;
      scale = dataFormatDigits.decimal;
    }

    return Formatter.number(Number(cellValue), this.type, digitsMin, scale, 1, locale);
  }

  drawPrefix() {
    if (this.prefix == null) {
      return "";
    }

    return this.prefix;
  }
}
