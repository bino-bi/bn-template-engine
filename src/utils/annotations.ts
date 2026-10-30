import { DataPointPart } from "./layoutState/types";

/** What an annotation points at. Values are raw dataset values, a field left out is a wildcard. */
export interface AnnotationPoint {
  rowGroup?: string;
  category?: string;
  subCategory?: string;
  date?: string;
  scenario?: string;
  row?: "subtotal" | "total";
  part?: DataPointPart;
}

/** One entry of the `items` attribute of `bn-annotation-layer`. */
export interface AnnotationLayerItem {
  /** Number on the mark. Absent when the annotation has none. */
  label?: string;
  mark?: "marker" | "frame" | "arrow";
  /** Named colour, see {@link annotationColor}. */
  color?: string;
  /** `data-bino-annotation-target` of the slot that holds the component. */
  target: string;
  point?: AnnotationPoint;
  to?: string;
  toPoint?: AnnotationPoint;
}

/** One entry of the `items` attribute of `bn-annotation-list`. */
export interface AnnotationListItem {
  label?: string;
  title?: string;
  /** Inline HTML of the text. */
  html?: string;
}

const DEFAULT_COLOR = "#0070c0";
const NAMED_DEFAULTS = new Map([
  ["negative", "#ff0000"],
  ["positive", "#008f96"],
]);
const COLOR_NAME = /^[a-z][a-z0-9-]*$/i;

/**
 * CSS value of a named colour: `--bn-annotation-color-<name>` when the page
 * sets it, else the built-in value of the name, else the highlight blue
 * (`--bn-annotation-color`). The name ends up in a style, so only a plain name counts.
 */
export function annotationColor(name?: string): string {
  const base = `var(--bn-annotation-color, ${DEFAULT_COLOR})`;
  if (!name || !COLOR_NAME.test(name)) return base;
  return `var(--bn-annotation-color-${name}, ${NAMED_DEFAULTS.get(name.toLowerCase()) ?? base})`;
}

/** A value of an item as text. Anything else is dropped: an object in a JSX child would be taken for a vnode. */
const text = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;

/** The `items` of a layer. `undefined` when it is not a JSON array of objects. */
export function parseLayerItems(json: string | undefined): AnnotationLayerItem[] | undefined {
  return parseItems<AnnotationLayerItem>(json)?.map((item) => ({
    ...item,
    label: text(item.label),
    color: text(item.color),
    target: text(item.target) ?? "",
    to: text(item.to),
  }));
}

/** The `items` of a list. `undefined` when it is not a JSON array of objects. */
export function parseListItems(json: string | undefined): AnnotationListItem[] | undefined {
  return parseItems<AnnotationListItem>(json)?.map((item) => ({
    label: text(item.label),
    title: text(item.title),
    html: text(item.html),
  }));
}

function parseItems<T>(json: string | undefined): T[] | undefined {
  if (json == null || json.trim() === "") return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((item) => item !== null && typeof item === "object")) {
      return parsed as T[];
    }
  } catch {
    // reported by the caller
  }
  return undefined;
}

const pageKeys = new WeakMap<Element, string>();
let nextPageKey = 1;

/** Key of the page an annotation element sits on: a label is unique only within one page. */
export function annotationPageKey(element: Element): string {
  const page = element.closest("bn-layout-page");
  if (!page) return "";
  let key = pageKeys.get(page);
  if (!key) {
    key = `page-${nextPageKey++}`;
    pageKeys.set(page, key);
  }
  return key;
}
