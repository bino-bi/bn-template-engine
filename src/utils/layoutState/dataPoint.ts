import { DataPointKey, DataPointPart, LayoutPoint } from "./types";

const KEY_ATTRIBUTES: [keyof DataPointKey, string][] = [
  ["rowGroup", "data-bn-row-group"],
  ["category", "data-bn-category"],
  ["subCategory", "data-bn-sub-category"],
  ["date", "data-bn-date"],
  ["scenario", "data-bn-scenario"],
  ["row", "data-bn-row"],
];
const PART_ATTRIBUTE = "data-bn-part";

/**
 * The `data-bn-*` attributes of a data-point element. Unknown fields stay out.
 * Without `part` the element only carries the keys and cannot be addressed:
 * the group around a bar, or a second shape of one data point.
 */
export function dataPointAttributes(key: DataPointKey | undefined, part?: DataPointPart): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (!key) return attributes;
  for (const [field, attribute] of KEY_ATTRIBUTES) {
    const value = key[field];
    if (value != null && value !== "") attributes[attribute] = String(value);
  }
  if (part) attributes[PART_ATTRIBUTE] = part;
  return attributes;
}

/** The key of a rendered element, read back from its attributes. Only an element with a part has one. */
export function readLayoutPoint(element: Element): LayoutPoint | undefined {
  const part = element.getAttribute(PART_ATTRIBUTE);
  if (!part) return undefined;
  const point: LayoutPoint = { part: part as DataPointPart };
  for (const [field, attribute] of KEY_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value != null) (point as unknown as Record<string, string>)[field] = value;
  }
  return point;
}

/** The start of a bucket as `YYYY-MM-DD`, with the time when it is not midnight: a bucket can be shorter than a day. */
export function pointDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(iso);
  if (!match) return iso;
  return match[2] === "00:00:00" ? match[1] : `${match[1]}T${match[2]}`;
}

/** The dimension a chart's `level` shows, with the value of its row: `category` for `categoryIndex` too. */
export function levelKey(level: string, value: string | null | undefined): DataPointKey {
  if (value == null) return {};
  if (level.startsWith("rowGroup")) return { rowGroup: String(value) };
  if (level.startsWith("subCategory")) return { subCategory: String(value) };
  return { category: String(value) };
}
