import { AxisConfig, LegendConfig } from "./model/AxisConfig";

/** The two lines of an axis title that stands beside the end of its axis. */
export function axisTitleLines(axis: AxisConfig, inWord: string): { label: string; suffix: string } {
  return {
    label: axis.label ?? "",
    suffix: axis.unit !== undefined && axis.unit !== "" ? `${inWord} ${axis.unit}` : "",
  };
}

/** The title has a label and stands beside the end of its axis. */
export function isTitleBeside(axis: AxisConfig): boolean {
  return axis.titlePosition === "beside" && (axis.label ?? "") !== "";
}

/** How far the legend is moved along its side: 0 at the start, the whole free room at the end. */
export function legendOffset(legend: LegendConfig, free: number): number {
  const share = legend.align === "center" ? 0.5 : legend.align === "end" ? 1 : 0;
  return Math.max(0, free) * share;
}
