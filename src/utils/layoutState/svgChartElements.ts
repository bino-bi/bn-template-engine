import { readSvgBaseline } from "./baseline";
import { readLayoutPoint } from "./dataPoint";
import { readDiagnostics } from "./diagnostics";
import { Origins, measure } from "./geometry";
import { resolveStandaloneId } from "./identity";
import {
  AxisElement,
  BarElement,
  Baseline,
  ComponentLayoutState,
  EmContext,
  LabelElement,
  LayoutElement,
  LayoutRegion,
  LAYOUT_STATE_VERSION,
  PointElement,
} from "./types";

const SCENARIO_GROUP_RE = /^Scenario([1-4])$/;
const STACK_SEGMENT_RE = /^stacked_(?:col|bar)_(\d+)_seg_\d+$/;
const STACK_SEGMENTS = 'g[id^="stacked_col_"], g[id^="stacked_bar_"]';

/** The value a bar group carries in `data-bn-value`. */
function readValue(group: Element): number | undefined {
  const raw = group.getAttribute("data-bn-value");
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Nearest `#Scenario1..4` ancestor of an element, as "scenario1".."scenario4". */
function scenarioOf(el: Element, root: Element): string | undefined {
  let current: Element | null = el.parentElement;
  while (current && current !== root) {
    const match = SCENARIO_GROUP_RE.exec(current.id ?? "");
    if (match) return `scenario${match[1]}`;
    current = current.parentElement;
  }
  return undefined;
}

/** Data-point index encoded in a group id like "3_RECT" or "3_DATA_Label". */
function indexOfGroup(id: string): number | undefined {
  if (id === "") return undefined;
  const parsed = Number(id.split("_")[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Ordinal a mark without a group of its own carries itself. */
function ownIndex(el: Element): number | undefined {
  const index = el.getAttribute("data-bn-index");
  return index === null ? undefined : Number(index);
}

/** Index of the data-point group around an element: a marker shape has no id of its own. */
function indexAround(el: Element, root: Element): number | undefined {
  for (let current: Element | null = el; current && current !== root; current = current.parentElement) {
    const index = indexOfGroup(current.id ?? "");
    if (index !== undefined) return index;
  }
  return undefined;
}

function hasClass(el: Element, name: string): boolean {
  return (el.getAttribute("class") ?? "").split(/\s+/).includes(name);
}

/** True when the element sits inside a `*_Label` group below `root`. */
function insideLabelGroup(el: Element, root: Element): boolean {
  let current: Element | null = el.parentElement;
  while (current && current !== root) {
    if ((current.id ?? "").endsWith("_Label")) return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * Walks one time/structure chart segment SVG (`svg#drawCanvas`) and classifies
 * its rendered elements by the chart's stable group-id conventions:
 * `<index>_RECT` bar groups inside `#Scenario1..4`, `stacked_col_<index>_seg_<n>`
 * stack segments, `<index>_DATA_Label` / `<index>_SCENARIO_Label` label groups,
 * the `#axis` group's `.axis-*` line, and the category/title texts of the
 * axis-labels group. Every other element with a `data-bn-part` attribute is a
 * data point too: a value label, a stack total, a line or scenario marker.
 */
export function collectChartSegmentElements(svgRoot: Element, segment: string, origins: Origins): LayoutElement[] {
  const elements: LayoutElement[] = [];
  const collected = new Set<Element>();

  svgRoot.querySelectorAll('g[id$="_RECT"]').forEach((group, walkIndex) => {
    collected.add(group);
    const bar: BarElement = {
      kind: "bar",
      id: group.id,
      segment,
      scenario: scenarioOf(group, svgRoot),
      index: indexOfGroup(group.id) ?? walkIndex,
      rect: measure(group, origins),
      point: readLayoutPoint(group),
      value: readValue(group),
    };
    elements.push(bar);
  });

  svgRoot.querySelectorAll(STACK_SEGMENTS).forEach((group) => {
    const match = STACK_SEGMENT_RE.exec(group.id);
    // a segment without a value keeps its place in the stack and draws nothing
    if (!match || !group.querySelector("rect")) return;
    collected.add(group);
    const point = readLayoutPoint(group);
    const bar: BarElement = {
      kind: "bar",
      id: group.id,
      segment,
      scenario: `stack:${point?.scenario ?? point?.subCategory ?? point?.category ?? ""}`,
      index: Number(match[1]),
      rect: measure(group, origins),
      point,
      value: readValue(group),
    };
    elements.push(bar);
  });

  (["DATA", "SCENARIO"] as const).forEach((prefix) => {
    svgRoot.querySelectorAll(`g[id$="_${prefix}_Label"]`).forEach((group, walkIndex) => {
      if (hasClass(group, "hide")) return;
      const text = group.textContent?.trim() ?? "";
      if (!text) return;
      collected.add(group);
      const label: LabelElement = {
        kind: "label",
        id: group.id,
        role: prefix === "DATA" ? "data" : "scenario",
        text,
        segment,
        index: indexOfGroup(group.id) ?? walkIndex,
        rect: measure(group.querySelector("text") ?? group, origins),
        point: readLayoutPoint(group),
      };
      elements.push(label);
    });
  });

  svgRoot.querySelectorAll("[data-bn-part]").forEach((el, walkIndex) => {
    if (collected.has(el)) return;
    const point = readLayoutPoint(el)!;
    const index = ownIndex(el) ?? indexAround(el, svgRoot);
    if (point.part === "element") {
      const mark: PointElement = {
        kind: "point",
        series: point.scenario,
        index: index ?? walkIndex,
        rect: measure(el, origins),
        point,
      };
      elements.push(mark);
      return;
    }
    const label: LabelElement = {
      kind: "label",
      id: el.id || undefined,
      role: "data",
      text: el.textContent?.trim() ?? "",
      segment,
      index,
      rect: measure(el.querySelector("text") ?? el, origins),
      point,
    };
    elements.push(label);
  });

  svgRoot.querySelectorAll('g[id="axis"] line').forEach((line) => {
    const styleClass = (line.getAttribute("class") ?? "").split(/\s+/).find((cls) => cls.startsWith("axis-"));
    const rect = measure(line, origins);
    const axis: AxisElement = {
      kind: "axis",
      style: styleClass?.slice("axis-".length),
      orientation: rect.context.width >= rect.context.height ? "horizontal" : "vertical",
      segment,
      rect,
    };
    elements.push(axis);
  });

  svgRoot.querySelectorAll('g[id="AxisAndDateLables"] text, g[id="AxisAndDateLabelsLine"] text').forEach((textEl) => {
    if (hasClass(textEl, "hide") || insideLabelGroup(textEl, svgRoot)) return;
    const text = textEl.textContent?.trim() ?? "";
    if (!text) return;
    const label: LabelElement = {
      kind: "label",
      role: hasClass(textEl, "categories") ? "title" : "category",
      text,
      segment,
      rect: measure(textEl, origins),
    };
    elements.push(label);
  });

  return elements;
}

/** Number of data-point groups in the primary scenario layer, or of stacks in a stacked chart (= category/bar count). */
export function countPrimaryDataPoints(svgRoot: Element): number {
  const scenario1 = svgRoot.querySelector('g[id="Scenario1"]');
  if (scenario1) {
    return Array.from(scenario1.children).filter((child) => /^\d+$/.test(child.id ?? "")).length;
  }
  const stacks = new Set<string>();
  svgRoot.querySelectorAll(STACK_SEGMENTS).forEach((group) => {
    const match = STACK_SEGMENT_RE.exec(group.id);
    if (match && group.querySelector("rect")) stacks.add(match[1]);
  });
  if (stacks.size > 0) return stacks.size;
  // a line or an area has no columns: the chart writes the number of its periods
  const periods = Number(svgRoot.querySelector("[data-bn-periods]")?.getAttribute("data-bn-periods"));
  return Number.isFinite(periods) ? periods : 0;
}

export interface ChartFacadeLayout {
  regions: LayoutRegion[];
  elements?: LayoutElement[];
  /** Category/bar count of the base segment. */
  barCount: number;
  /** Baseline of the base segment's axis line. */
  baseline: Baseline;
}

/**
 * Walks a chart facade's inner segment components (one per base/variance
 * segment, paired by DOM order - CSS only reverses the visual order):
 * one `canvas:<segment>` region per inner `svg#drawCanvas`, plus the
 * per-element breakdown and the measure-scale footer at full detail.
 */
export function collectChartFacadeLayout(
  host: HTMLElement,
  innerTag: string,
  segments: string[],
  origins: Origins,
  detail: "summary" | "full",
): ChartFacadeLayout {
  const layout: ChartFacadeLayout = { regions: [], barCount: 0, baseline: {} };
  const elements: LayoutElement[] = [];
  const inners = Array.from(host.shadowRoot?.querySelectorAll(innerTag) ?? []);

  inners.forEach((inner, index) => {
    const segment = segments[index] ?? `segment${index}`;
    const svg = inner.shadowRoot?.querySelector("svg#drawCanvas");
    if (svg) {
      layout.regions.push({ id: `canvas:${segment}`, rect: measure(svg, origins) });
      if (index === 0) {
        layout.barCount = countPrimaryDataPoints(svg);
        layout.baseline = readSvgBaseline(svg, host);
      }
      if (detail === "full") {
        elements.push(...collectChartSegmentElements(svg, segment, origins));
      }
    }
    if (detail === "full") {
      const footer = inner.shadowRoot?.querySelector(".footer");
      const footerText = footer?.textContent?.trim();
      if (footerText) {
        elements.push({ kind: "label", role: "footer", text: footerText, segment, rect: measure(footer, origins) });
      }
    }
  });

  if (detail === "full") layout.elements = elements;
  return layout;
}

/**
 * Walks an XY/bullet chart SVG. Its marks carry no ids or classes, so
 * classification is by tag: circles/ellipses become points, keyed rects
 * (the bullet bars) become bars, texts become data labels. Gridlines and
 * frame geometry are deliberately skipped.
 */
export function collectXYElements(svgRoot: Element, origins: Origins): LayoutElement[] {
  const elements: LayoutElement[] = [];
  svgRoot.querySelectorAll("circle, ellipse").forEach((mark, index) => {
    const point: PointElement = { kind: "point", index, rect: measure(mark, origins), point: readLayoutPoint(mark) };
    elements.push(point);
  });
  svgRoot.querySelectorAll('rect[data-bn-part="element"]').forEach((mark, index) => {
    const point = readLayoutPoint(mark);
    const bar: BarElement = {
      kind: "bar",
      segment: "base",
      scenario: point?.scenario,
      index: ownIndex(mark) ?? index,
      rect: measure(mark, origins),
      point,
    };
    elements.push(bar);
  });
  svgRoot.querySelectorAll("text").forEach((textEl) => {
    const text = textEl.textContent?.trim() ?? "";
    if (!text) return;
    const label: LabelElement = {
      kind: "label",
      role: "data",
      text,
      rect: measure(textEl, origins),
      point: readLayoutPoint(textEl),
    };
    elements.push(label);
  });
  return elements;
}

/**
 * Complete layout state of a single-inner XY/bullet chart facade: host box,
 * one `canvas` region, point count, diagnostics - and the tag-classified
 * element list at full detail.
 */
export function collectXYFacadeState(
  host: HTMLElement,
  innerTag: string,
  title: string | undefined,
  em: EmContext,
  origins: Origins,
  detail: "summary" | "full",
): ComponentLayoutState {
  const state: ComponentLayoutState = {
    version: LAYOUT_STATE_VERSION,
    tag: host.localName,
    id: resolveStandaloneId(host),
    slot: host.getAttribute("slot") ?? undefined,
    rect: measure(host, origins),
    em,
    regions: [],
    metadata: { title },
    diagnostics: readDiagnostics(host),
  };

  const svg = host.shadowRoot?.querySelector(innerTag)?.shadowRoot?.querySelector("svg#drawCanvas");
  if (svg) {
    state.regions.push({ id: "canvas", rect: measure(svg, origins) });
    state.metadata.pointCount = svg.querySelectorAll("circle, ellipse").length;
    state.baseline = readSvgBaseline(svg, host);
    if (detail === "full") {
      state.elements = collectXYElements(svg, origins);
    }
  }
  return state;
}
