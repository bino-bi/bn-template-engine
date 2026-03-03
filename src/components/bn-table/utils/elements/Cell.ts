// import {Formatter} from "../../../../utils/formatter";
// import {DataFormatDigits} from "../../../../utils/model/DataFormatDigits";

import { DataFormatDigits } from "../../../../components";
import { Formatter } from "../../../../utils";

/** Min/max statistics for a single data column, used to scale inline bar charts. */
export interface ColumnStats {
  min: number;
  max: number;
  absMax: number;
}

/**
 * Represents a single table cell with formatting and rendering capabilities.
 *
 * The draw() method implements a formatting pipeline:
 * 1. Checks for undefined/null/NaN values -- returns empty string for missing data
 * 2. Non-numeric values (category labels) are returned as-is
 * 3. Numeric values are routed through Formatter.number() with the cell's type
 *    (decimal or percent) and configured digit precision
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
  measureScale: number;

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

  public draw(dataFormatDigits: DataFormatDigits) {
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

    if (this.type === "decimal") {
      cellValue = +cellValue / this.measureScale;
      digitsMin = dataFormatDigits.decimal;
      scale = dataFormatDigits.decimal;
    }

    return Formatter.number(Number(cellValue), this.type, digitsMin, scale);
  }

  drawPrefix() {
    if (this.prefix == null) {
      return "";
    }

    return this.prefix;
  }
}
