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

/** What the layer draws for one item, in the coordinates of its SVG. */
export type DrawnMark =
  | { kind: "marker"; color: string; badge: Badge }
  | { kind: "frame"; color: string; x: number; y: number; width: number; height: number; rx: number; badge?: Badge }
  | { kind: "arrow"; color: string; x1: number; y1: number; x2: number; y2: number; head: string; badge?: Badge };

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

/**
 * The geometry of one item. `whole` says that the box is a component and not
 * one of its data points: a marker then sits in the top-right corner. An arrow
 * between two boxes with the same centre has no direction and gives `undefined`.
 * `area` is the size of the layer: a frame that would leave it stays inside.
 */
export function buildMark(
  item: AnnotationLayerItem,
  color: string,
  box: Box,
  toBox: Box | undefined,
  em: number,
  whole: boolean,
  area?: Area,
): DrawnMark | undefined {
  const label = item.label;

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
    const padding = 0.2 * em;
    // half of the stroke stays inside the layer too
    const inset = 1;
    const left = area ? Math.max(inset, box.x - padding) : box.x - padding;
    const top = area ? Math.max(inset, box.y - padding) : box.y - padding;
    const right = box.x + box.width + padding;
    const bottom = box.y + box.height + padding;
    const x2 = area ? Math.min(area.width - inset, right) : right;
    const y2 = area ? Math.min(area.height - inset, bottom) : bottom;
    return {
      kind: "frame",
      color,
      x: left,
      y: top,
      width: x2 - left,
      height: y2 - top,
      rx: 0.25 * em,
      badge: label != null ? keepInside({ cx: x2, cy: top, r: 0.65 * em, label }, area) : undefined,
    };
  }

  // without a number the circle is only a dot
  const r = label != null ? 0.75 * em : 0.4 * em;
  const at = whole ? { x: box.x + box.width - r, y: box.y + r } : centre(box);
  return { kind: "marker", color, badge: keepInside({ cx: at.x, cy: at.y, r, label }, area) };
}
