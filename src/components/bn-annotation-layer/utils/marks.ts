import { AnnotationLayerItem } from "../../../utils/annotations";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Area {
  width: number;
  height: number;
}

interface Badge {
  cx: number;
  cy: number;
  r: number;
  label?: string;
}

/** What the layer draws for one item, in the coordinates of its SVG. `color` is the name given in the item. */
export type DrawnMark =
  | { kind: "marker"; color?: string; badge: Badge }
  | {
      kind: "frame";
      color?: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      ry: number;
      badge?: Badge;
    }
  | { kind: "arrow"; color?: string; x1: number; y1: number; x2: number; y2: number; head: string; badge?: Badge };

export interface MarkOptions {
  /** The box is a component and not one of its data points. */
  whole?: boolean;
  /** The size of the layer: marks that would leave it stay inside. */
  area?: Area;
  /** The box of the text, when the data point is a table cell. */
  text?: Box;
  /** What a marker next to a text must not cover: the texts of the other cells. */
  obstacles?: Box[];
}

const centre = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Where the line from the centre of a box to `towards` leaves the box. */
export function boxEdge(box: Box, towards: { x: number; y: number }): { x: number; y: number } {
  const from = centre(box);
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  const scale = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
  );
  if (!Number.isFinite(scale)) return from;
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

/** Keeps a circle inside the layer: `bn-body` clips what is outside of it. */
function keepInside(badge: Badge, area: Area | undefined): Badge {
  if (!area) return badge;
  return {
    ...badge,
    cx: Math.max(badge.r, Math.min(badge.cx, area.width - badge.r)),
    cy: Math.max(badge.r, Math.min(badge.cy, area.height - badge.r)),
  };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The size unit of a mark on a cell: the font of a scaled table or of a thereof row is smaller than the one of the page. */
const unitOf = (text: Box | undefined, em: number): number => (text ? Math.min(em, text.height / 1.3) : em);

/**
 * A marker must not hide the number it points at: left of the text, else right
 * of it. A dense table has no room for that, so there it gets as small as the
 * wider gap next to the number, and sits in the middle of that gap.
 */
function besideText(text: Box, r: number, unit: number, options: MarkOptions): { x: number; y: number; r: number } {
  const gap = 0.25 * unit;
  const y = text.y + text.height / 2;
  const obstacles = options.obstacles ?? [];
  const isFree = (x: number): boolean => {
    const circle = { x: x - r, y: y - r, width: 2 * r, height: 2 * r };
    const area = options.area;
    const inside = !area || (circle.x >= 0 && circle.x + circle.width <= area.width);
    return inside && !obstacles.some((box) => overlaps(circle, box));
  };
  const textRight = text.x + text.width;
  const left = text.x - gap - r;
  const right = textRight + gap + r;
  if (isFree(left)) return { x: left, y, r };
  if (isFree(right)) return { x: right, y, r };

  // a side without a neighbour on this line has room for the marker, and no more: it must stay at its number
  const reach = 2 * (r + gap);
  const onLine = obstacles.filter((box) => box.y < y && box.y + box.height > y);
  const leftEdge = Math.max(
    0,
    text.x - reach,
    ...onLine.filter((box) => box.x + box.width <= text.x).map((box) => box.x + box.width),
  );
  const rightEdge = Math.min(
    options.area?.width ?? Infinity,
    textRight + reach,
    ...onLine.filter((box) => box.x >= textRight).map((box) => box.x),
  );
  const leftGap = text.x - leftEdge;
  const rightGap = rightEdge - textRight;
  const wider = Math.max(leftGap, rightGap);
  const x = rightGap >= leftGap ? textRight + rightGap / 2 : text.x - leftGap / 2;
  // the number in the circle must stay readable
  return { x, y, r: Math.min(r, Math.max(wider / 2, 0.3 * unit)) };
}

/**
 * The geometry of one item. On a whole component a marker sits in the top-right
 * corner, and on a table cell next to the number. A frame goes around the text
 * of a cell. It is an oval around a text, and long sides stay straight, so it
 * also fits a long label; a whole component keeps its corners. An arrow between
 * two boxes with the same centre has no direction and gives `undefined`.
 */
export function buildMark(
  item: AnnotationLayerItem,
  box: Box,
  toBox: Box | undefined,
  em: number,
  options: MarkOptions = {},
): DrawnMark | undefined {
  const { label, color } = item;
  const { whole, area, text } = options;
  // a table row has no text of its own, but the same font
  const isRow = !whole && !text && options.obstacles != null;
  const unit = unitOf(text ?? (isRow ? box : undefined), em);

  if (item.mark === "arrow") {
    if (!toBox) return undefined;
    const from = centre(box);
    const to = centre(toBox);
    if (from.x === to.x && from.y === to.y) return undefined;
    let start = boxEdge(box, to);
    let end = boxEdge(toBox, from);
    // boxes that overlap: the edges have passed each other, the arrow would point backwards
    if ((end.x - start.x) * (to.x - from.x) + (end.y - start.y) * (to.y - from.y) <= 0) {
      start = from;
      end = to;
    }
    const length = Math.hypot(end.x - start.x, end.y - start.y);

    const headLength = Math.min(0.8 * em, length);
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    const baseX = end.x - ux * headLength;
    const baseY = end.y - uy * headLength;
    const halfWidth = 0.35 * em;
    return {
      kind: "arrow",
      color,
      x1: start.x,
      y1: start.y,
      // the line ends in the head: its blunt end must not stick out at the tip
      x2: baseX,
      y2: baseY,
      head: [
        `${end.x},${end.y}`,
        `${baseX - uy * halfWidth},${baseY + ux * halfWidth}`,
        `${baseX + uy * halfWidth},${baseY - ux * halfWidth}`,
      ].join(" "),
      badge: label != null ? keepInside({ cx: start.x, cy: start.y, r: 0.65 * em, label }, area) : undefined,
    };
  }

  if (item.mark === "frame") {
    const around = text ?? box;
    const part = item.point?.part;
    const oval = !whole && (text != null || part === "label" || part === "total");
    const paddingX = (oval ? 0.45 : 0.2) * unit;
    const paddingY = (oval ? 0.1 : 0.2) * unit;
    // a single digit gets a circle and not a narrow upright oval
    const width = oval ? Math.max(around.width, around.height) : around.width;
    const midX = around.x + around.width / 2;
    // half of the stroke stays inside the layer too
    const inset = 1;
    const left = Math.max(area ? inset : -Infinity, midX - width / 2 - paddingX);
    const top = Math.max(area ? inset : -Infinity, around.y - paddingY);
    const x2 = Math.min(area ? area.width - inset : Infinity, midX + width / 2 + paddingX);
    const y2 = Math.min(area ? area.height - inset : Infinity, around.y + around.height + paddingY);
    const short = Math.min(x2 - left, y2 - top) / 2;
    const ry = whole ? 0.25 * em : short;
    const rx = whole ? 0.25 * em : oval ? Math.min((x2 - left) / 2, 1.6 * short) : short;
    // the number sits on the outline, also where the outline is round; on a tight oval just outside, to not hide the text
    const curve = 1 - Math.SQRT1_2;
    const badgeR = 0.65 * unit;
    const outside = oval ? 0.6 * badgeR : 0;
    return {
      kind: "frame",
      color,
      x: left,
      y: top,
      width: x2 - left,
      height: y2 - top,
      rx,
      ry,
      badge:
        label != null
          ? keepInside({ cx: x2 - rx * curve + outside, cy: top + ry * curve - outside, r: badgeR, label }, area)
          : undefined,
    };
  }

  // without a number the circle is only a dot
  if (text && !whole) {
    const beside = besideText(text, (label == null ? 0.4 : 0.65) * unit, unit, options);
    return { kind: "marker", color, badge: keepInside({ cx: beside.x, cy: beside.y, r: beside.r, label }, area) };
  }
  const size = (label == null ? 0.4 : 0.75) * unit;
  const r = isRow ? Math.min(size, box.height / 2) : size;
  const at = whole ? { x: box.x + box.width - r, y: box.y + r } : centre(box);
  if (isRow) {
    // the middle of a row is free in a wide table. In a narrow one it is a number: then next to that number
    const circle = { x: at.x - r, y: at.y - r, width: 2 * r, height: 2 * r };
    const number = options.obstacles!.find((other) => overlaps(circle, other));
    if (number) {
      const beside = besideText(number, r, unit, options);
      return { kind: "marker", color, badge: keepInside({ cx: beside.x, cy: beside.y, r: beside.r, label }, area) };
    }
  }
  return { kind: "marker", color, badge: keepInside({ cx: at.x, cy: at.y, r, label }, area) };
}
