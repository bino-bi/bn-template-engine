import { xyTickDecimals } from "./formatXYValue";
import { AxisConfig, LegendConfig } from "./model/AxisConfig";

/** One line of an axis title that stands beside the end of its axis. */
export interface AxisTitleLine {
  text: string;
  bold: boolean;
}

/** The label of an axis in one line: a line break typed in it counts as a space. */
export function axisLabel(axis: AxisConfig): string {
  return (axis.label ?? "").split(/\r?\n/).join(" ").trim();
}

/**
 * The lines of an axis title that stands beside the end of its axis: the label in bold,
 * one line per line typed in it, and the unit below it.
 */
export function axisTitleLines(axis: AxisConfig, inWord: string): AxisTitleLine[] {
  const lines: AxisTitleLine[] = (axis.label ?? "")
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter((text) => text !== "")
    .map((text) => ({ text, bold: true }));
  if (axis.unit !== undefined && axis.unit !== "") {
    lines.push({ text: `${inWord} ${axis.unit}`, bold: false });
  }
  return lines;
}

/** Decimals of the tick labels of an axis: the typed number, else what the ticks need. */
export function axisDecimals(axis: AxisConfig, ticks: number[], percent: boolean): number {
  return axis.decimals ?? xyTickDecimals(ticks, percent);
}

/** The title has a label and stands beside the end of its axis. */
export function isTitleBeside(axis: AxisConfig): boolean {
  return axis.titlePosition === "beside" && axisLabel(axis) !== "";
}

/** How far the legend is moved along its side: 0 at the start, the whole free room at the end. */
export function legendOffset(legend: LegendConfig, free: number): number {
  const share = legend.align === "center" ? 0.5 : legend.align === "end" ? 1 : 0;
  return Math.max(0, free) * share;
}
