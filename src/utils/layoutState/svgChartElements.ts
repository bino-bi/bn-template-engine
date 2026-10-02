import { readDiagnostics } from "./diagnostics";
import { Origins, measure } from "./geometry";
import { resolveStandaloneId } from "./identity";
import {
  AxisElement,
  BarElement,
  ComponentLayoutState,
  EmContext,
  LabelElement,
  LayoutElement,
  LayoutRegion,
  LAYOUT_STATE_VERSION,
  PointElement,
} from "./types";

const SCENARIO_GROUP_RE = /^Scenario([1-4])$/;

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
  const parsed = Number(id.split("_")[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
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
 * `<index>_RECT` bar groups inside `#Scenario1..4`, `<index>_DATA_Label` /
 * `<index>_SCENARIO_Label` label groups, the `#axis` group's `.axis-*` line,
 * and the category/title texts of the axis-labels group.
 */
export function collectChartSegmentElements(svgRoot: Element, segment: string, origins: Origins): LayoutElement[] {
  const elements: LayoutElement[] = [];

  svgRoot.querySelectorAll('g[id$="_RECT"]').forEach((group, walkIndex) => {
    const bar: BarElement = {
      kind: "bar",
      id: group.id,
      segment,
      scenario: scenarioOf(group, svgRoot),
      index: indexOfGroup(group.id) ?? walkIndex,
      rect: measure(group, origins),
    };
    elements.push(bar);
  });

  (["DATA", "SCENARIO"] as const).forEach((prefix) => {
    svgRoot.querySelectorAll(`g[id$="_${prefix}_Label"]`).forEach((group, walkIndex) => {
      if (hasClass(group, "hide")) return;
      const text = group.textContent?.trim() ?? "";
      if (!text) return;
      const label: LabelElement = {
        kind: "label",
        id: group.id,
        role: prefix === "DATA" ? "data" : "scenario",
        text,
        segment,
        index: indexOfGroup(group.id) ?? walkIndex,
        rect: measure(group, origins),
      };
      elements.push(label);
    });
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

/** Number of data-point groups in the primary scenario layer (= category/bar count). */
export function countPrimaryDataPoints(svgRoot: Element): number {
  const scenario1 = svgRoot.querySelector('g[id="Scenario1"]');
  if (!scenario1) return 0;
  return Array.from(scenario1.children).filter((child) => /^\d+$/.test(child.id ?? "")).length;
}

export interface ChartFacadeLayout {
  regions: LayoutRegion[];
  elements?: LayoutElement[];
  /** Category/bar count of the base segment. */
  barCount: number;
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
  const layout: ChartFacadeLayout = { regions: [], barCount: 0 };
  const elements: LayoutElement[] = [];
  const inners = Array.from(host.shadowRoot?.querySelectorAll(innerTag) ?? []);

  inners.forEach((inner, index) => {
    const segment = segments[index] ?? `segment${index}`;
    const svg = inner.shadowRoot?.querySelector("svg#drawCanvas");
    if (svg) {
      layout.regions.push({ id: `canvas:${segment}`, rect: measure(svg, origins) });
      if (index === 0) layout.barCount = countPrimaryDataPoints(svg);
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
 * classification is by tag: circles/ellipses become points, texts become
 * data labels. Gridlines and frame geometry are deliberately skipped.
 */
export function collectXYElements(svgRoot: Element, origins: Origins): LayoutElement[] {
  const elements: LayoutElement[] = [];
  svgRoot.querySelectorAll("circle, ellipse").forEach((mark, index) => {
    const point: PointElement = { kind: "point", index, rect: measure(mark, origins) };
    elements.push(point);
  });
  svgRoot.querySelectorAll("text").forEach((textEl) => {
    const text = textEl.textContent?.trim() ?? "";
    if (!text) return;
    const label: LabelElement = { kind: "label", role: "data", text, rect: measure(textEl, origins) };
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
    if (detail === "full") {
      state.elements = collectXYElements(svg, origins);
    }
  }
  return state;
}
