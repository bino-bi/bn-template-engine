import { AnnotationStyle, SYSTEM_STYLE_DEFAULTS } from "../stores/componentStyles";
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
  mark?: "marker" | "frame" | "arrow" | "difference";
  /** Named colour, see {@link annotationColor}. */
  color?: string;
  /** `data-bino-annotation-target` of the slot that holds the component. */
  target: string;
  point?: AnnotationPoint;
  to?: string;
  toPoint?: AnnotationPoint;
  /** `frame`: a text the frame is drawn around, on the target. `difference`: not used. */
  text?: string;
  /** `difference`: also print the relative difference, in brackets. */
  percent?: boolean;
  /** `difference`: digits of the absolute difference, 1 by default. */
  digits?: number;
  /** `difference`: `good-down` when a lower value is the good one. */
  sentiment?: "good-up" | "good-down";
  /** `difference`: a frame around the relative difference. */
  highlight?: boolean;
}

/** One entry of the `items` attribute of `bn-annotation-list`. */
export interface AnnotationListItem {
  label?: string;
  title?: string;
  /** Inline HTML of the text. */
  html?: string;
}

const COLOR_NAME = /^[a-z][a-z0-9-]*$/i;

/**
 * CSS value of a named colour: `--bn-annotation-color-<name>` when the page
 * sets it, else the colour of that name in the style, else the main colour
 * (`--bn-annotation-color`, else `color` of the style). The name ends up in a
 * style, so only a plain name counts.
 */
export function annotationColor(name: string | undefined, style: AnnotationStyle | null | undefined): string {
  // a style can set the section or its keys to null, and that must not cost the page its marks
  const main = style?.color ?? SYSTEM_STYLE_DEFAULTS["bn-annotation"].color;
  const colors = style?.colors ?? {};
  const base = `var(--bn-annotation-color, ${main})`;
  if (!name || !COLOR_NAME.test(name)) return base;
  const own = Object.prototype.hasOwnProperty.call(colors, name) ? colors[name] : undefined;
  return `var(--bn-annotation-color-${name}, ${own ?? base})`;
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
    text: text(item.text),
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
