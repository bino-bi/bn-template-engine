import { Baseline } from "./types";

/** Marks the element a chart wants to be aligned on, where its markup has no other stable hook. */
export const BASELINE_ATTRIBUTE = "data-bn-baseline";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Origin of the component host, in viewport coordinates. */
function originOf(host: Element): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/**
 * Baseline of one axis line, relative to `origin`: a horizontal line gives its
 * y and its left end, a vertical line its x and its top end.
 */
function lineBaseline(line: Element, origin: { x: number; y: number }): Baseline {
  const rect = line.getBoundingClientRect();
  if (rect.width >= rect.height) {
    return { x: round2(rect.left - origin.x), y: round2(rect.top + rect.height / 2 - origin.y) };
  }
  return { x: round2(rect.left + rect.width / 2 - origin.x), y: round2(rect.top - origin.y) };
}

/** Baseline of a plot frame: its bottom edge (the x axis) and its left edge (the y axis). */
function frameBaseline(frame: Element, origin: { x: number; y: number }): Baseline {
  const rect = frame.getBoundingClientRect();
  return { x: round2(rect.left - origin.x), y: round2(rect.bottom - origin.y) };
}

/**
 * Baseline of a chart segment SVG: the first marked frame or axis line, else
 * the first line of the `#axis` group. `{}` when there is none, for example
 * before the chart has drawn or when it has no data.
 */
export function readSvgBaseline(svgRoot: ParentNode, host: Element): Baseline {
  const marked = svgRoot.querySelector(`[${BASELINE_ATTRIBUTE}]`);
  const el = marked ?? svgRoot.querySelector('g[id="axis"] line');
  if (!el) return {};
  const origin = originOf(host);
  return el.getAttribute(BASELINE_ATTRIBUTE) === "frame" ? frameBaseline(el, origin) : lineBaseline(el, origin);
}

/** Baseline of the first `innerTag` renderer in a chart facade (the base segment, in DOM order). */
export function readChartBaseline(host: HTMLElement, innerTag: string): Baseline {
  const svg = host.shadowRoot?.querySelector(innerTag)?.shadowRoot?.querySelector("svg#drawCanvas");
  return svg ? readSvgBaseline(svg, host) : {};
}

/**
 * Baseline of a rendered `<table>`: y is the bottom of the header, x the left
 * edge of the first value column (the cell after the category column of the
 * last header row, else of the first body row).
 */
export function readTableBaseline(table: Element | null | undefined, host: Element): Baseline {
  if (!table) return {};
  const origin = originOf(host);
  const baseline: Baseline = {};
  const thead = table.querySelector("thead");
  if (thead) {
    baseline.y = round2(thead.getBoundingClientRect().bottom - origin.y);
  }
  const rows = (section: Element | null) =>
    section ? Array.from(section.children).filter((child) => child.localName === "tr") : [];
  const headerRows = rows(thead);
  const row = headerRows[headerRows.length - 1] ?? rows(table.querySelector("tbody"))[0];
  const valueCell = row?.children[1];
  if (valueCell) {
    baseline.x = round2(valueCell.getBoundingClientRect().left - origin.x);
  }
  return baseline;
}
