import { AnnotationPoint } from "../../../utils/annotations";
import { ComponentLayoutState, DualRect, LayoutPoint } from "../../../utils/layoutState/types";

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
export function matchPoint(state: ComponentLayoutState, point: AnnotationPoint): DualRect[] {
  const candidates: { rect: DualRect; point?: LayoutPoint }[] =
    state.table && point.scenario == null ? state.table.rows : ((state.elements ?? []) as typeof candidates);
  const noThereof = state.table != null && point.subCategory == null;
  return candidates
    .filter((candidate) => matches(candidate.point, point) && !(noThereof && candidate.point!.subCategory != null))
    .map((candidate) => candidate.rect);
}
