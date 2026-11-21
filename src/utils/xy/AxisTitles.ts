import { xyTickDecimals } from "./formatXYValue";
import { AxisConfig, LegendConfig } from "./model/AxisConfig";
import { Rect } from "./FacetGrid";

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

/**
 * The place of a legend inside the plot. Without `align` it moves out of the way of the
 * marks and of the `blocked` boxes (panel titles): its own place when none touches it, else
 * the highest free place on the right edge of its panel, then on the left edge. With no
 * free place, or with `align`, it keeps its place.
 */
export function freeLegendPlace(
  legend: LegendConfig,
  place: Rect,
  panel: Rect,
  marks: { cx: number; cy: number; r: number }[],
  em: number,
  blocked: Rect[] = [],
): Rect {
  if (legend.align !== undefined) return place;
  const free = (rect: Rect) =>
    marks.every(({ cx, cy, r }) => {
      const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
      const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
      return (cx - nx) ** 2 + (cy - ny) ** 2 >= r * r;
    }) &&
    blocked.every(
      (box) =>
        box.x >= rect.x + rect.width ||
        box.x + box.width <= rect.x ||
        box.y >= rect.y + rect.height ||
        box.y + box.height <= rect.y,
    );
  const top = panel.y + 0.3 * em;
  const bottom = panel.y + panel.height - 0.3 * em - place.height;
  // the left edge only when the legend fits into the panel from there
  const left = panel.x + 0.5 * em;
  const edges = left + place.width <= panel.x + panel.width - 0.5 * em ? [place.x, left] : [place.x];
  for (const x of edges) {
    for (let y = top; y <= bottom; y += 0.5 * em) {
      const rect = { ...place, x, y };
      if (free(rect)) return rect;
    }
  }
  return place;
}
