import { Formatter } from "../formatter";

/** Prints a number of an XY chart (axis tick, iso line, bubble value) with a fixed number of decimals. */
export function formatXYValue(value: number, decimals: number, locale: string): string {
  return Formatter.number(value, "decimal", decimals, decimals, 1, locale);
}
