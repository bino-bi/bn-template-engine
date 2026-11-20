import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import {
  annotationColor,
  AnnotationLayerItem,
  annotationPageKey,
  AnnotationPoint,
  parseLayerItems,
} from "../../utils/annotations";
import { ComponentRegister } from "../../utils/componentRegister";
import { ComponentLayoutState, DualRect } from "../../utils/layoutState/types";
import { Style } from "../../stores/componentStyles";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import {
  Box,
  buildBracket,
  buildDifference,
  buildHorizontalDifference,
  buildMark,
  buildPointer,
  DrawnMark,
} from "./utils/marks";
import { isWholeComponent, matchPoint } from "./utils/matchPoint";

/** A component with a layout state of its own. */
interface TargetElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>;
  getLayoutState?: (options: { detail: "full" }) => Promise<ComponentLayoutState>;
}

/** The result of looking up one end of an item, in viewport coordinates. */
type Anchor =
  | {
      box: Box;
      whole: boolean;
      text?: CellText;
      obstacles?: CellText[];
      stacked?: boolean;
      label?: boolean;
      horizontal?: boolean;
    }
  | { problem: string };

/** The bars of one point of a difference: their common box and the sum of their values. */
type SumAnchor = { box: Box; negatives: Box[]; value: number; horizontal: boolean } | { problem: string };

/** The text of a cell: its screen box, and the width of the sign in front of it. */
interface CellText {
  box: Box;
  sign?: number;
}

/** A chart can draw its data late: a point without a match is reported when the page has been quiet for two checks. */
const REPORT_CHECK_MS = 200;
const REPORT_MAX_CHECKS = 50;

/** The centre of a screen box lies inside an element. An element without a size has no layout to judge by. */
function isVisibleIn(box: Box, element: Element): boolean {
  const area = element.getBoundingClientRect();
  if (area.width === 0 || area.height === 0) return true;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}

/** Elements in a slot that show nothing, so they are not what a mark points at. */
const CONFIG_ELEMENTS = new Set([
  "bn-asset",
  "bn-component-style",
  "bn-dataset",
  "bn-datasource",
  "bn-internationalization",
  "bn-ruleset",
  "bn-scaling-group",
]);

/** The box has a size, and part of it lies inside an element. An element without a size has no layout to judge by. */
function reachesInto(box: Box, element: Element): boolean {
  const area = element.getBoundingClientRect();
  if (area.width === 0 || area.height === 0) return true;
  return box.x < area.right && box.x + box.width > area.left && box.y < area.bottom && box.y + box.height > area.top;
}

/** A whole component cannot be seen: it has no box, or it lies outside of a cell around it or of the layer. */
function isHidden(box: Box, slot: Element, layer: Element): boolean {
  if (box.width === 0 || box.height === 0 || !reachesInto(box, layer)) return true;
  for (let cell: Element | null = slot; cell && cell.localName !== "bn-layout-page"; cell = cell.parentElement) {
    if (!reachesInto(box, cell)) return true;
  }
  return false;
}

/** The slot of a target can grow with its content: what clips it is then a cell further out, in a fit-to-content card. */
function isCutOff(box: Box, slot: Element): boolean {
  for (let cell: Element | null = slot; cell && cell.localName !== "bn-layout-page"; cell = cell.parentElement) {
    if (!isVisibleIn(box, cell)) return true;
  }
  return false;
}

/**
 * Draws annotation marks over a page: a numbered circle on a data point, a
 * rounded frame around a value, or a straight arrow between two data points.
 *
 * The marks are an overlay and not part of the charts, because a chart
 * rewrites its SVG on every render. Positions come from `getLayoutState()` of
 * the components, and they are measured again when a component resizes or
 * draws again. A point with no match, or with more than one, draws nothing:
 * that is a finding in the data and not a broken page, so the layer does not fail.
 *
 * Place it in the `annotations` slot of `bn-layout-page`. The numbers are given,
 * the layer never counts.
 *
 * A target can sit anywhere in the page, also on the child of one `bn-grid`
 * cell or of a card in it. The mark then points at the first component in
 * that element.
 *
 * @example
 * <bn-layout-page>
 *   <div slot="slot-0" data-bino-annotation-target="t1"><bn-chart-time ...></bn-chart-time></div>
 *   <bn-annotation-layer slot="annotations"
 *     items='[{"label":"1","mark":"marker","target":"t1","point":{"date":"2024-01-01","scenario":"pl1"}}]'>
 *   </bn-annotation-layer>
 * </bn-layout-page>
 */
@Component({
  tag: "bn-annotation-layer",
  styleUrl: "bn-annotation-layer.scss",
  shadow: true,
})
export class AnnotationLayer {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError)
  @Element() private element: HTMLElement;

  /**
   * JSON array of the marks, each one `{ label?, mark?, color?, target, point?, to?, toPoint? }`.
   * `mark` is `marker` (default), `frame` or `arrow`. `target` and `to` name a
   * `data-bino-annotation-target` on this page. `point` and `toPoint` hold raw
   * data values (`rowGroup`, `category`, `subCategory`, `date`, `scenario`, `row`)
   * and a `part` (`element`, `label`, `total`). Without a field they mean the
   * component as a whole.
   */
  @Prop() items?: string;

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its section `bn-annotation` sets the colours.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  @State() private marks: DrawnMark[] = [];

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private readonly holdStatus: (work: Promise<unknown>) => void;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private stores: ScopedStores;
  private pageKey = "";
  private parsedItems: AnnotationLayerItem[] = [];
  private svg?: SVGSVGElement;
  private scheduled = false;
  private run = 0;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private observed = new WeakSet<Node>();
  private observedAround = new WeakSet<Node>();
  private reported = new Set<string>();

  constructor() {
    this.holdStatus = withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
    this.pageKey = annotationPageKey(this.element);
    this.observed = new WeakSet();
    this.observedAround = new WeakSet();
    this.resizeObserver = new ResizeObserver(this.schedule);
    this.mutationObserver = new MutationObserver(this.schedule);
    this.observeSize(this.element);
    // a target can be added or moved later, in a morphing preview for example
    const page = this.element.closest("bn-layout-page");
    if (page) {
      this.mutationObserver.observe(page, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["slot", "data-bino-annotation-target"],
      });
    }
    document.fonts?.addEventListener("loadingdone", this.schedule);
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    document.fonts?.removeEventListener("loadingdone", this.schedule);
    this.run++;
    if (this.stores?.annotationsUnplaced.state[this.pageKey]) {
      this.stores.annotationsUnplaced.set(this.pageKey, undefined);
    }
  }

  componentWillLoad() {
    this.parseItems();
  }

  componentDidLoad() {
    this.schedule();
  }

  @Watch("items")
  onItemsChange() {
    this.parseItems();
    this.schedule();
  }

  private parseItems() {
    const items = parseLayerItems(this.items);
    if (items) {
      this.errors.remove("ERR_items");
    } else {
      this.errors.addOrReplace({ id: "ERR_items", type: "error", message: "items: not a JSON array of objects." });
    }
    this.parsedItems = items ?? [];
  }

  /**
   * Places the marks after the next paint. The layer counts as working until
   * then, so a printer does not print a page with marks of an older layout.
   */
  private readonly schedule = () => {
    if (this.scheduled) return;
    this.scheduled = true;
    this.holdStatus(
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          this.scheduled = false;
          this.place()
            .catch((e) => console.error("bn-annotation-layer: placing the marks failed", e))
            .finally(resolve);
        });
      }),
    );
  };

  private async place(): Promise<void> {
    const run = ++this.run;
    if (!this.element.isConnected || !this.svg) return;

    const page = this.element.closest("bn-layout-page");
    const targets = new Map<string, TargetElement>();
    const slots = new Map<TargetElement, Element>();
    page?.querySelectorAll("[data-bino-annotation-target]").forEach((slot) => {
      const visual = Array.from(slot.querySelectorAll<TargetElement>("*")).find(
        (el) => el.localName.startsWith("bn-") && !CONFIG_ELEMENTS.has(el.localName),
      );
      const target = visual ?? (slot as TargetElement);
      targets.set(slot.getAttribute("data-bino-annotation-target")!, target);
      slots.set(target, slot);
    });
    // a cell that changes its size can move a target without resizing it, in a card too
    page?.querySelectorAll("[slot]").forEach((cell) => this.observeSize(cell));

    const needed = new Set(this.parsedItems.flatMap((item) => [item.target, item.to]));
    const visuals = [...targets].filter(([id]) => needed.has(id)).map(([, visual]) => visual);
    await Promise.all(visuals.map((visual) => visual.componentOnReady?.()));
    if (run !== this.run) return;
    visuals.forEach((visual) => {
      this.observe(visual);
      this.observeAround(visual, page);
    });

    const states = new Map<TargetElement, ComponentLayoutState | undefined>();
    await Promise.all(
      visuals.map(async (visual) => {
        states.set(visual, await visual.getLayoutState?.({ detail: "full" }).catch(() => undefined));
      }),
    );
    if (run !== this.run) return;

    const anchorOf = (id: string | undefined, point: AnnotationPoint | undefined): Anchor => {
      const visual = id != null ? targets.get(id) : undefined;
      if (!visual) return { problem: `no target "${id}" on this page` };
      const host = visual.getBoundingClientRect();
      if (isWholeComponent(point)) {
        const box = { x: host.left, y: host.top, width: host.width, height: host.height };
        if (isHidden(box, slots.get(visual)!, this.element)) return { problem: `"${id}" cannot be seen` };
        return { box, whole: true };
      }
      const state = states.get(visual);
      const found = state ? matchPoint(state, point!) : [];
      if (found.length !== 1) {
        return { problem: `${found.length} elements match the point ${JSON.stringify(point)} in "${id}"` };
      }
      const onScreen = ({ component: { x, y, width, height } }: DualRect): Box => ({
        x: host.left + x,
        y: host.top + y,
        width,
        height,
      });
      const box = onScreen(found[0].rect);
      // measuring ignores clipping: a row cut off by its cell would get its mark on the next component
      if (isCutOff(box, slots.get(visual)!) || !isVisibleIn(box, this.element)) {
        return { problem: `the point ${JSON.stringify(point)} in "${id}" is cut off` };
      }
      const content = found[0].content;
      if (!state!.table) {
        return { box, whole: false, stacked: found[0].stacked, label: found[0].label, horizontal: isHorizontal(state) };
      }
      const cells = (state!.elements ?? []).flatMap((element) =>
        element.kind === "cell" && element.content
          ? [{ box: onScreen(element.content), sign: element.contentSign }]
          : [],
      );
      return {
        box,
        whole: false,
        text: content && { box: onScreen(content), sign: found[0].contentSign },
        obstacles: cells,
      };
    };

    // the bars of a structure chart run from left to right: its value axis is an upright line
    const isHorizontal = (state: ComponentLayoutState | undefined): boolean =>
      (state?.elements ?? []).some((element) => element.kind === "axis" && element.orientation === "vertical");

    // a difference takes all bars of a point: the segments of a stack together are its sum
    const sumOf = (id: string | undefined, point: AnnotationPoint | undefined): SumAnchor => {
      const visual = id != null ? targets.get(id) : undefined;
      if (!visual) return { problem: `no target "${id}" on this page` };
      const state = states.get(visual);
      const found = state && point ? matchPoint(state, { ...point, part: "element" }) : [];
      const bars = found.filter((match) => match.value != null);
      if (bars.length === 0) {
        return { problem: `no bar with a value matches the point ${JSON.stringify(point)} in "${id}"` };
      }
      // bars side by side or behind each other are no sum: the point must name one of them
      if (bars.length > 1 && !bars.every((bar) => bar.stacked)) {
        return { problem: `${bars.length} elements match the point ${JSON.stringify(point)} in "${id}"` };
      }
      const host = visual.getBoundingClientRect();
      const left = Math.min(...bars.map((bar) => bar.rect.component.x));
      const top = Math.min(...bars.map((bar) => bar.rect.component.y));
      const right = Math.max(...bars.map((bar) => bar.rect.component.x + bar.rect.component.width));
      const bottom = Math.max(...bars.map((bar) => bar.rect.component.y + bar.rect.component.height));
      const screen = (rect: { x: number; y: number; width: number; height: number }): Box => ({
        x: host.left + rect.x,
        y: host.top + rect.y,
        width: rect.width,
        height: rect.height,
      });
      return {
        box: { x: host.left + left, y: host.top + top, width: right - left, height: bottom - top },
        negatives: bars.filter((bar) => bar.value! < 0).map((bar) => screen(bar.rect.component)),
        value: bars.reduce((sum, bar) => sum + bar.value!, 0),
        horizontal: isHorizontal(state),
      };
    };

    // the share of the rows from one point to another in all rows of the chart, for the bars the points name
    const shareOf = (item: AnnotationLayerItem, upper: Box, lower: Box): number | undefined => {
      const visual = targets.get(item.target);
      const state = visual && states.get(visual);
      if (!visual || !state || !item.point) return undefined;
      const host = visual.getBoundingClientRect();
      const { rowGroup: _r, category: _c, subCategory: _s, date: _d, ...series } = item.point;
      // the bar of a sum row holds the rows again: it is no part of the whole
      const bars = matchPoint(state, { ...series, part: "element" }).filter(
        (bar) => bar.value != null && (bar.row == null || series.row != null),
      );
      const all = bars.reduce((sum, bar) => sum + bar.value!, 0);
      const inside = bars
        .filter((bar) => {
          const middle = host.top + bar.rect.component.y + bar.rect.component.height / 2;
          return middle >= upper.y && middle <= lower.y + lower.height;
        })
        .reduce((sum, bar) => sum + bar.value!, 0);
      return all !== 0 ? inside / all : undefined;
    };

    const toLocal = this.toLocalSpace();
    // here the text runs along x and a layout px is a px, also on a rotated or scaled page
    const textToLocal = ({ box, sign = 0 }: CellText): Box => {
      const local = toLocal(box);
      return { ...local, x: local.x - sign, width: local.width + sign };
    };
    const em = parseFloat(getComputedStyle(this.svg).fontSize) || 13.3333;
    // the layout size: on a rotated page the screen box has the sides swapped
    const area = { width: this.element.clientWidth, height: this.element.clientHeight };
    const marks: DrawnMark[] = [];
    const problems: { item: AnnotationLayerItem; problem: string }[] = [];

    for (const item of this.parsedItems) {
      if (item.mark === "difference") {
        const first = sumOf(item.target, item.point);
        const second = sumOf(item.to ?? item.target, item.toPoint);
        const failed = "problem" in first ? first : "problem" in second ? second : undefined;
        if (failed) {
          problems.push({ item, problem: failed.problem });
          continue;
        }
        const [a, b] = [first, second] as { box: Box; negatives: Box[]; value: number; horizontal: boolean }[];
        if (a.horizontal) {
          // the level of a sum is the right end, and left of it by the length of the negative values
          const endOf = (anchor: { box: Box; negatives: Box[] }): number => {
            const local = toLocal(anchor.box);
            return local.x + local.width - anchor.negatives.reduce((sum, bar) => sum + toLocal(bar).width, 0);
          };
          const mark = buildHorizontalDifference(item, toLocal(a.box), toLocal(b.box), a.value, b.value, em, {
            from: endOf(a),
            to: endOf(b),
          });
          if (mark) marks.push(mark);
          continue;
        }
        // the level of a sum: the top for positive values, and below it by the length of the negative ones.
        // Measured in the space of the layer, so it holds on a turned page too.
        const levelOf = (anchor: { box: Box; negatives: Box[] }): number =>
          toLocal(anchor.box).y + anchor.negatives.reduce((sum, bar) => sum + toLocal(bar).height, 0);
        const mark = buildDifference(item, toLocal(a.box), toLocal(b.box), a.value, b.value, em, {
          from: levelOf(a),
          to: levelOf(b),
        });
        if (mark) marks.push(mark);
        continue;
      }
      if (item.mark === "pointer" || item.mark === "bracket") {
        const first = sumOf(item.target, item.point);
        const second = item.mark === "bracket" ? sumOf(item.to ?? item.target, item.toPoint) : first;
        const failed = "problem" in first ? first : "problem" in second ? second : undefined;
        if (failed) {
          problems.push({ item, problem: failed.problem });
          continue;
        }
        const [a, b] = [first, second] as { box: Box; negatives: Box[]; horizontal: boolean }[];
        // the end of a value: the right end of a bar or the top of a column, moved by the negative values
        const endOf = (anchor: { box: Box; negatives: Box[]; horizontal: boolean }): { x: number; y: number } => {
          const local = toLocal(anchor.box);
          return anchor.horizontal
            ? {
                x: local.x + local.width - anchor.negatives.reduce((sum, bar) => sum + toLocal(bar).width, 0),
                y: local.y,
              }
            : {
                x: local.x + local.width / 2,
                y: local.y + anchor.negatives.reduce((sum, bar) => sum + toLocal(bar).height, 0),
              };
        };
        if (item.mark === "pointer") {
          marks.push(buildPointer(item, endOf(a), em));
          continue;
        }
        if (!a.horizontal) {
          problems.push({ item, problem: "a bracket needs bars that run from left to right" });
          continue;
        }
        if (item.to != null && item.to !== item.target) {
          problems.push({ item, problem: "both ends of a bracket must be in one chart" });
          continue;
        }
        const [upper, lower] = a.box.y <= b.box.y ? [a.box, b.box] : [b.box, a.box];
        const share = item.percent ? shareOf(item, upper, lower) : undefined;
        const host = targets.get(item.target)!.getBoundingClientRect();
        const hostBox = toLocal({ x: host.left, y: host.top, width: host.width, height: host.height });
        const caption = item.text ?? (share != null ? `${Math.round(share * 100)}%` : undefined);
        marks.push(
          buildBracket(
            item,
            toLocal(a.box),
            toLocal(b.box),
            { first: endOf(a).x, last: endOf(b).x },
            hostBox.x,
            caption,
            em,
          ),
        );
        continue;
      }
      const from = anchorOf(item.target, item.point);
      const to = item.mark === "arrow" ? anchorOf(item.to, item.toPoint) : undefined;
      const failed = "problem" in from ? from : to && "problem" in to ? to : undefined;
      if (failed) {
        problems.push({ item, problem: failed.problem });
        continue;
      }
      const start = from as {
        box: Box;
        whole: boolean;
        text?: CellText;
        obstacles?: CellText[];
        stacked?: boolean;
        label?: boolean;
        horizontal?: boolean;
      };
      const end = to as { box: Box } | undefined;
      const mark = buildMark(item, toLocal(start.box), end && toLocal(end.box), em, {
        whole: start.whole,
        area,
        text: start.text && textToLocal(start.text),
        obstacles: start.obstacles?.map(textToLocal),
        stacked: start.stacked,
        label: start.label,
        horizontal: start.horizontal,
      });
      if (mark) {
        marks.push(mark);
      } else {
        problems.push({ item, problem: "an arrow needs two ends at different places" });
      }
    }

    this.marks = marks;
    this.storeUnplaced(problems.flatMap(({ item }) => (item.label != null ? [item.label] : [])));

    if (problems.length > 0) void this.reportWhenQuiet(run, problems);
  }

  /**
   * Not part of the placement: the register would wait for this layer, and this
   * layer for the register. The checks end within the quiet period the register
   * has before it publishes, so the warning is out before a page counts as ready.
   */
  private async reportWhenQuiet(run: number, problems: { item: AnnotationLayerItem; problem: string }[]) {
    let quiet = 0;
    for (let check = 0; check < REPORT_MAX_CHECKS && quiet < 2; check++) {
      await new Promise((resolve) => window.setTimeout(resolve, REPORT_CHECK_MS));
      if (run !== this.run) return;
      quiet = ComponentRegister.componentRegisterStatus().running === 0 ? quiet + 1 : 0;
    }
    this.report(problems);
  }

  private report(problems: { item: AnnotationLayerItem; problem: string }[]) {
    for (const { item, problem } of problems) {
      const line = `bn-annotation-layer: ${item.mark ?? "marker"} ${item.label ?? "without a number"} is not drawn: ${problem}.`;
      if (!this.reported.has(line)) {
        this.reported.add(line);
        console.warn(line);
      }
    }
  }

  /** The screen box of an element is axis-aligned on a rotated page too, so its corners map to a box here. */
  private toLocalSpace(): (box: Box) => Box {
    const matrix = this.svg!.getScreenCTM()?.inverse();
    return (box) => {
      if (!matrix) return box;
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      const x = Math.min(corners[0].x, corners[1].x);
      const y = Math.min(corners[0].y, corners[1].y);
      return { x, y, width: Math.abs(corners[1].x - corners[0].x), height: Math.abs(corners[1].y - corners[0].y) };
    };
  }

  private storeUnplaced(labels: string[]) {
    const store = this.stores?.annotationsUnplaced;
    const current = store?.state[this.pageKey] ?? [];
    if (store && JSON.stringify(current) !== JSON.stringify(labels)) {
      store.set(this.pageKey, labels);
    }
  }

  /** A chart redraws inside its shadow roots, where the host and a mutation observer on it see nothing. */
  private observe(visual: TargetElement) {
    this.observeSize(visual);
    const walk = (root: ShadowRoot | null | undefined) => {
      if (!root) return;
      if (!this.observed.has(root)) {
        this.observed.add(root);
        // a table patches its cells in place: a bar gets a new width, its number a new x
        this.mutationObserver?.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["x", "y", "width", "height", "transform", "style", "class"],
        });
      }
      root.querySelectorAll("*").forEach((el) => walk(el.shadowRoot));
    };
    walk(visual.shadowRoot);
  }

  /**
   * A component around a target can move it without resizing anything: a
   * grid pads a cell down to line up a baseline, and writes that into its own
   * shadow root, or into the style of a card in the cell.
   */
  private observeAround(visual: Element, page: Element | null) {
    for (let el = visual.parentElement; el && el !== page; el = el.parentElement) {
      if (this.observedAround.has(el)) continue;
      this.observedAround.add(el);
      this.mutationObserver?.observe(el, { attributes: true, attributeFilter: ["style"] });
      if (el.shadowRoot) {
        this.mutationObserver?.observe(el.shadowRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
        });
      }
    }
  }

  private observeSize(element: Element) {
    if (!this.observed.has(element)) {
      this.observed.add(element);
      this.resizeObserver?.observe(element);
    }
  }

  private renderBadge(badge: { cx: number; cy: number; r: number; label?: string } | undefined, color: string) {
    if (!badge) return null;
    const outlined = this.componentStyle(($) => $["bn-annotation"])?.markerStyle === "outlined";
    // the ring lies inside the radius, so both styles take the same room
    const circle = outlined ? (
      <circle
        cx={badge.cx}
        cy={badge.cy}
        r={badge.r - 0.75}
        style={{ fill: "#ffffff", stroke: color, strokeWidth: "1.5" }}
      ></circle>
    ) : (
      <circle cx={badge.cx} cy={badge.cy} r={badge.r} style={{ fill: color }}></circle>
    );
    return (
      <g>
        {circle}
        {badge.label != null ? (
          <text
            class="badge-text"
            x={badge.cx}
            y={badge.cy}
            style={{ fontSize: `${badge.r * 1.1}px`, ...(outlined ? { fill: color } : {}) }}
          >
            {badge.label}
          </text>
        ) : null}
      </g>
    );
  }

  private renderMark(mark: DrawnMark) {
    const color = annotationColor(
      mark.color,
      this.componentStyle(($) => $["bn-annotation"]),
    );
    if (mark.kind === "marker") {
      return (
        <g class="mark marker" data-label={mark.badge.label}>
          {this.renderBadge(mark.badge, color)}
        </g>
      );
    }
    if (mark.kind === "frame") {
      return (
        <g class="mark frame" data-label={mark.badge?.label}>
          <rect
            x={mark.x}
            y={mark.y}
            width={mark.width}
            height={mark.height}
            rx={mark.rx}
            ry={mark.ry}
            style={{ fill: mark.caption ? "#ffffff" : "none", stroke: color, strokeWidth: "1.5" }}
          ></rect>
          {mark.caption ? (
            <text class="mark-text caption" x={mark.caption.x} y={mark.caption.y}>
              {mark.caption.text}
            </text>
          ) : null}
          {this.renderBadge(mark.badge, color)}
        </g>
      );
    }
    if (mark.kind === "difference") {
      const main = annotationColor(
        undefined,
        this.componentStyle(($) => $["bn-annotation"]),
      );
      return (
        <g class="mark difference" data-label={mark.badge?.label}>
          {mark.lines.map((line) => (
            <line class="difference-line" x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}></line>
          ))}
          <rect
            x={mark.bar.x}
            y={mark.bar.y}
            width={mark.bar.width}
            height={mark.bar.height}
            style={{ fill: color }}
          ></rect>
          <text class="mark-text" x={mark.text.x} y={mark.text.y} style={{ textAnchor: mark.text.anchor }}>
            {mark.text.value}
            {mark.text.percent ? (
              <tspan class="percent" dx="0.35em">
                {mark.text.percent}
              </tspan>
            ) : null}
          </text>
          {mark.frame ? (
            <rect
              x={mark.frame.x}
              y={mark.frame.y}
              width={mark.frame.width}
              height={mark.frame.height}
              rx={mark.frame.r}
              ry={mark.frame.r}
              style={{ fill: "none", stroke: main, strokeWidth: "1.5" }}
            ></rect>
          ) : null}
          {this.renderBadge(mark.badge, main)}
        </g>
      );
    }
    if (mark.kind === "pointer") {
      return (
        <g class="mark pointer" data-label={mark.badge?.label}>
          <polygon points={mark.shape} style={{ fill: color }}></polygon>
          {this.renderBadge(mark.badge, color)}
        </g>
      );
    }
    if (mark.kind === "bracket") {
      return (
        <g class="mark bracket" data-label={mark.badge?.label}>
          <polyline points={mark.path} style={{ fill: "none", stroke: color, strokeWidth: "1.5" }}></polyline>
          {mark.frame ? (
            <rect
              x={mark.frame.x}
              y={mark.frame.y}
              width={mark.frame.width}
              height={mark.frame.height}
              rx={mark.frame.r}
              ry={mark.frame.r}
              style={{ fill: "#ffffff", stroke: color, strokeWidth: "1.5" }}
            ></rect>
          ) : null}
          {mark.caption ? (
            <text class="mark-text caption" x={mark.caption.x} y={mark.caption.y}>
              {mark.caption.text}
            </text>
          ) : null}
          {this.renderBadge(mark.badge, color)}
        </g>
      );
    }
    return (
      <g class="mark arrow" data-label={mark.badge?.label}>
        <line x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} style={{ stroke: color, strokeWidth: "1.5" }}></line>
        <polygon points={mark.head} style={{ fill: color }}></polygon>
        {this.renderBadge(mark.badge, color)}
      </g>
    );
  }

  render() {
    return (
      <Host>
        <svg ref={(el) => (this.svg = el as SVGSVGElement)}>{this.marks.map((mark) => this.renderMark(mark))}</svg>
      </Host>
    );
  }
}
