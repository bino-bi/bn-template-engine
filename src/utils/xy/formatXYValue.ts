import { Formatter } from "../formatter";
import { NumericScale } from "./NumericScale";

/**
 * Prints a number of an XY chart (axis tick, iso line, bubble value) with a fixed number
 * of decimals. `percent` is for relative variances: the value is a fraction and prints as 20%.
 */
export function formatXYValue(value: number, decimals: number, locale: string, percent: boolean = false): string {
  return Formatter.number(value, percent ? "percent" : "decimal", decimals, decimals, 1, locale);
}

/** Decimals for the ticks of an axis. The ticks of a percent axis are fractions and print times 100. */
export function xyTickDecimals(ticks: number[], percent: boolean): number {
  return NumericScale.tickDecimals(percent ? ticks.map((tick) => tick * 100) : ticks);
}
