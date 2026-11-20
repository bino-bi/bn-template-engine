import { AnnotationPoint } from "../../../utils/annotations";
import { ComponentLayoutState, DualRect, LayoutPoint } from "../../../utils/layoutState/types";

/** The box of a point, and the box of its text when it is a table cell. */
export interface MatchedPoint {
  rect: DualRect;
  content?: DualRect;
  contentSign?: number;
  /** The value of a bar, when its chart writes it. */
  value?: number;
  /** A segment of a stack: its value label stands in its middle. */
  stacked?: boolean;
  /** The point is a value label of a chart, not a bar. */
  label?: boolean;
  /** The point belongs to a sum row: `subtotal` or `total`. */
  row?: string;
}

const KEY_FIELDS = ["rowGroup", "category", "subCategory", "date", "scenario", "row"] as const;

/** A point without a field, or no point at all, means the component as a whole. */
export function isWholeComponent(point: AnnotationPoint | undefined): boolean {
  return !point || (KEY_FIELDS.every((field) => point[field] == null) && point.part == null);
}

function matches(found: LayoutPoint | undefined, point: AnnotationPoint): boolean {
  if (!found || found.part !== (point.part ?? "element")) return false;
  return KEY_FIELDS.every((field) => point[field] == null || String(point[field]) === found[field]);
}

/**
 * The rendered boxes of a point. A table point without a scenario means the
 * whole row, so it is looked up in the rows and not in the cells. A thereof row
 * of a table repeats the key of its parent and adds a `subCategory`, so a point
 * without one means the parent: otherwise the parent could never be named.
 */
export function matchPoint(state: ComponentLayoutState, point: AnnotationPoint): MatchedPoint[] {
  const candidates: (MatchedPoint & { point?: LayoutPoint; value?: number; scenario?: string; kind?: string })[] =
    state.table && point.scenario == null ? state.table.rows : ((state.elements ?? []) as typeof candidates);
  const noThereof = state.table != null && point.subCategory == null;
  return candidates
    .filter((candidate) => matches(candidate.point, point) && !(noThereof && candidate.point!.subCategory != null))
    .map(({ rect, content, contentSign, value, scenario, kind, point: found }) => ({
      rect,
      row: found?.row,
      content,
      contentSign,
      value,
      stacked: typeof scenario === "string" && scenario.startsWith("stack:"),
      label: kind === "label",
    }));
}
