import { LocalFrame, localFrameOf } from "./localFrame";
import { Baseline } from "./types";

/** Marks the element a chart wants to be aligned on, where its markup has no other stable hook. */
export const BASELINE_ATTRIBUTE = "data-bn-baseline";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Baseline of one axis line: a horizontal line gives its y and its left end,
 * a vertical line its x and its top end.
 */
function lineBaseline(line: Element, frame: LocalFrame): Baseline {
  const rect = frame.toLocal(line.getBoundingClientRect());
  if (rect.width >= rect.height) {
    return { x: round2(rect.x), y: round2(rect.y + rect.height / 2) };
  }
  return { x: round2(rect.x + rect.width / 2), y: round2(rect.y) };
}

/** Baseline of a plot frame: its bottom edge (the x axis) and its left edge (the y axis). */
function frameBaseline(frame: Element, local: LocalFrame): Baseline {
  const rect = local.toLocal(frame.getBoundingClientRect());
  return { x: round2(rect.x), y: round2(rect.y + rect.height) };
}

/**
 * Baseline of a chart segment SVG, in the layout px of `host`: the first
 * marked frame or axis line, else the first line of the `#axis` group. `{}`
 * when there is none, for example before the chart has drawn.
 */
export function readSvgBaseline(svgRoot: ParentNode, host: Element): Baseline {
  const marked = svgRoot.querySelector(`[${BASELINE_ATTRIBUTE}]`);
  const el = marked ?? svgRoot.querySelector('g[id="axis"] line');
  if (!el) return {};
  const frame = localFrameOf(host);
  return el.getAttribute(BASELINE_ATTRIBUTE) === "frame" ? frameBaseline(el, frame) : lineBaseline(el, frame);
}

/** Baseline of the first `innerTag` renderer in a chart facade (the base segment, in DOM order). */
export function readChartBaseline(host: HTMLElement, innerTag: string): Baseline {
  const svg = host.shadowRoot?.querySelector(innerTag)?.shadowRoot?.querySelector("svg#drawCanvas");
  return svg ? readSvgBaseline(svg, host) : {};
}

/**
 * Baseline of a rendered `<table>`, in the layout px of `host`: y is the
 * bottom of the header, x the left edge of the first value column of the last
 * header row, else of the first body row. That is the first cell that is not
 * the operation or the category column. Interval groups can stand left of the
 * category column, then it is the first cell of the row.
 */
export function readTableBaseline(table: Element | null | undefined, host: Element): Baseline {
  if (!table) return {};
  const frame = localFrameOf(host);
  const baseline: Baseline = {};
  const thead = table.querySelector("thead");
  if (thead) {
    const rect = frame.toLocal(thead.getBoundingClientRect());
    baseline.y = round2(rect.y + rect.height);
  }
  const rows = (section: Element | null) =>
    section ? Array.from(section.children).filter((child) => child.localName === "tr") : [];
  const headerRows = rows(thead);
  const row = headerRows[headerRows.length - 1] ?? rows(table.querySelector("tbody"))[0];
  const cells = row ? Array.from(row.children) : [];
  const isRowHeader = (cell: Element) => cell.classList.contains("category") || cell.classList.contains("operation");
  const valueCell = cells.some(isRowHeader) ? cells.find((cell) => !isRowHeader(cell)) : cells[1];
  if (valueCell) {
    baseline.x = round2(frame.toLocal(valueCell.getBoundingClientRect()).x);
  }
  return baseline;
}
