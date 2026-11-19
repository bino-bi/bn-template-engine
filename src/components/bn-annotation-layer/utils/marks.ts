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
      /** The text the frame goes around, when the item brings its own. */
      caption?: { x: number; y: number; text: string };
    }
  | { kind: "arrow"; color?: string; x1: number; y1: number; x2: number; y2: number; head: string; badge?: Badge }
  | {
      kind: "difference";
      color?: string;
      /** The levels of the two values, drawn to the bar. */
      lines: { x1: number; y1: number; x2: number; y2: number }[];
      bar: Box;
      text: { x: number; y: number; anchor: "start" | "end"; value: string; percent?: string };
      /** Around the relative difference. */
      frame?: { x: number; y: number; width: number; height: number; r: number };
      badge?: Badge;
    }
  | {
      kind: "pointer";
      color?: string;
      /** A thick arrow that points down at the end of a bar. */
      shape: string;
      badge?: Badge;
    }
  | {
      kind: "bracket";
      color?: string;
      /** The line below the last row and up to the end of the first one. */
      path: string;
      caption?: { x: number; y: number; text: string };
      frame?: { x: number; y: number; width: number; height: number; r: number };
      badge?: Badge;
    };

export interface MarkOptions {
  /** The box is a component and not one of its data points. */
  whole?: boolean;
  /** The size of the layer: marks that would leave it stay inside. */
  area?: Area;
  /** The box of the text, when the data point is a table cell. */
  text?: Box;
  /** What a marker next to a text must not cover: the texts of the other cells. */
  obstacles?: Box[];
  /** The box is a segment of a stack: a marker sits on its right edge and leaves the value label free. */
  stacked?: boolean;
  /** The bars of the chart run from left to right. */
  horizontal?: boolean;
  /** The box is a value label of a chart: a mark stands right of it and not on it. */
  label?: boolean;
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

/** A text cannot be measured here: the width of the digits and signs of a number, close enough for a frame. */
const textWidth = (text: string, em: number): number => text.length * 0.6 * em;

const signed = (value: number, digits: number): string => (value < 0 ? "-" : "+") + Math.abs(value).toFixed(digits);

/**
 * The difference of two values of a chart. `box` and `toBox` are the bars of
 * the two values, and the upper edge of each is its level. A thin line runs
 * from each level to a bar behind the second value, which spans the
 * difference. The label is `to - from`, and with `percent` also relative to
 * `from`. A difference in the good direction has the colour `positive`, else
 * `negative`. Without two values there is nothing to print. `levels` gives
 * the y of the two values when it is not the upper edge of the boxes.
 */
export function buildDifference(
  item: AnnotationLayerItem,
  box: Box,
  toBox: Box,
  fromValue: number | undefined,
  toValue: number | undefined,
  em: number,
  levels?: { from: number; to: number },
): DrawnMark | undefined {
  if (fromValue == null || toValue == null) return undefined;
  const difference = toValue - fromValue;
  const digits = Number.isInteger(item.digits) && item.digits! >= 0 ? item.digits! : 1;
  const good = item.sentiment === "good-down" ? difference <= 0 : difference >= 0;

  // the bar stands behind the second value, away from the first one
  const direction = toBox.x + toBox.width / 2 >= box.x + box.width / 2 ? 1 : -1;
  const edge = (of: Box): number => (direction === 1 ? of.x + of.width : of.x);
  const barX = edge(toBox) + direction * 0.9 * em;
  const lineEnd = barX + direction * 0.125 * em;
  // the upper edge is the level of a positive value only: the caller knows better for a negative one
  const fromY = levels?.from ?? box.y;
  const toY = levels?.to ?? toBox.y;
  const barWidth = 0.25 * em;

  const percent =
    item.percent && fromValue !== 0 ? `(${signed((difference / Math.abs(fromValue)) * 100, 0)}%)` : undefined;
  const value = signed(difference, digits);
  const textX = barX + direction * 0.6 * em;
  const textY = (fromY + toY) / 2;
  const percentWidth = percent ? textWidth(percent, 0.85 * em) : 0;
  // digits and signs alone are narrower than a text with a percent sign
  const valueWidth = value.length * 0.5 * em;
  // the percent is the last part of the text, which ends at textX when it stands at the left
  const percentX = direction === 1 ? textX + valueWidth + 0.35 * em : textX - percentWidth;

  return {
    kind: "difference",
    color: item.color ?? (good ? "positive" : "negative"),
    lines: [
      { x1: edge(box), y1: fromY, x2: lineEnd, y2: fromY },
      { x1: edge(toBox), y1: toY, x2: lineEnd, y2: toY },
    ],
    bar: {
      x: barX - barWidth / 2,
      y: Math.min(fromY, toY),
      width: barWidth,
      height: Math.max(Math.abs(toY - fromY), 1),
    },
    text: { x: textX, y: textY, anchor: direction === 1 ? "start" : "end", value, percent },
    frame:
      percent && item.highlight
        ? {
            x: percentX - 0.25 * em,
            y: textY - 0.65 * em,
            width: percentWidth + 0.5 * em,
            height: 1.3 * em,
            r: 0.65 * em,
          }
        : undefined,
    badge:
      item.label != null
        ? { cx: barX, cy: Math.min(fromY, toY) - 0.9 * em, r: 0.65 * em, label: item.label }
        : undefined,
  };
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
    // a text of its own stands in the upper part of the target, above a value label in its middle
    const caption =
      item.text == null || whole
        ? undefined
        : options.label
          ? item.textPosition === "above"
            ? { x: box.x + box.width / 2 + 0.5 * em, y: box.y - 0.8 * em }
            : // right of a value label, so both can be read
              { x: box.x + box.width + 0.7 * em + textWidth(item.text, em) / 2, y: box.y + box.height / 2 }
          : { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, Math.max(0.9 * em, 0.3 * box.height)) };
    const captionBox = caption && {
      x: caption.x - textWidth(item.text!, em) / 2,
      y: caption.y - 0.6 * em,
      width: textWidth(item.text!, em),
      height: 1.2 * em,
    };
    const around = captionBox ?? text ?? box;
    const part = item.point?.part;
    const oval = !whole && (captionBox != null || text != null || part === "label" || part === "total");
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
      caption: caption && { ...caption, text: item.text! },
    };
  }

  // without a number the circle is only a dot
  if (text && !whole) {
    const beside = besideText(text, (label == null ? 0.4 : 0.65) * unit, unit, options);
    return { kind: "marker", color, badge: keepInside({ cx: beside.x, cy: beside.y, r: beside.r, label }, area) };
  }
  const size = (label == null ? 0.4 : 0.75) * unit;
  const r = isRow ? Math.min(size, box.height / 2) : size;
  let at = whole ? { x: box.x + box.width - r, y: box.y + r } : centre(box);
  if (!whole && options.label) {
    // right of the label of a chart, not on it
    at = { x: box.x + box.width + 0.25 * unit + r, y: box.y + box.height / 2 };
  } else if (!whole && options.stacked && options.horizontal) {
    // in a wide segment right of its label, like in a table. Else on the upper edge at its end.
    // The total behind the bar stays free in both cases.
    const beside = 1.3 * unit + r;
    at =
      box.width / 2 >= beside + r
        ? { x: box.x + box.width / 2 + beside, y: box.y + box.height / 2 }
        : { x: box.x + box.width - Math.min(r, box.width / 2), y: box.y };
  } else if (!whole && options.stacked && item.point?.part !== "label" && item.point?.part !== "total") {
    // on the upper right corner: the label in the middle and a name beside the segment stay free
    at = { x: box.x + box.width, y: box.y + Math.min(0.5 * r, box.height / 2) };
  }
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

/**
 * The difference of two bars that run from left to right. `levels` are the x of the
 * two values. The bar of the difference lies in the gap below the second row, or above
 * it when that row is the upper one. A thin line runs from each value to it, and the
 * label stands right of it.
 */
export function buildHorizontalDifference(
  item: AnnotationLayerItem,
  box: Box,
  toBox: Box,
  fromValue: number | undefined,
  toValue: number | undefined,
  em: number,
  levels: { from: number; to: number },
): DrawnMark | undefined {
  if (fromValue == null || toValue == null) return undefined;
  const difference = toValue - fromValue;
  const digits = Number.isInteger(item.digits) && item.digits! >= 0 ? item.digits! : 1;
  const good = item.sentiment === "good-down" ? difference <= 0 : difference >= 0;

  const direction = toBox.y + toBox.height / 2 >= box.y + box.height / 2 ? 1 : -1;
  const edge = (of: Box): number => (direction === 1 ? of.y + of.height : of.y);
  const barHeight = 0.25 * em;
  const barY = edge(toBox) + direction * 0.25 * em;
  const left = Math.min(levels.from, levels.to);
  const right = Math.max(levels.from, levels.to);

  const percent =
    item.percent && fromValue !== 0 ? `(${signed((difference / Math.abs(fromValue)) * 100, 0)}%)` : undefined;
  const value = signed(difference, digits);
  const textX = right + 0.5 * em;
  const valueWidth = value.length * 0.5 * em;
  const percentWidth = percent ? textWidth(percent, 0.85 * em) : 0;
  const percentX = textX + valueWidth + 0.35 * em;

  return {
    kind: "difference",
    color: item.color ?? (good ? "positive" : "negative"),
    lines: [
      { x1: levels.from, y1: edge(box), x2: levels.from, y2: barY },
      { x1: levels.to, y1: edge(toBox), x2: levels.to, y2: barY },
    ],
    bar: { x: left, y: barY - barHeight / 2, width: Math.max(right - left, 1), height: barHeight },
    text: { x: textX, y: barY, anchor: "start", value, percent },
    frame:
      percent && item.highlight
        ? {
            x: percentX - 0.25 * em,
            y: barY - 0.65 * em,
            width: percentWidth + 0.5 * em,
            height: 1.3 * em,
            r: 0.65 * em,
          }
        : undefined,
    badge: item.label != null ? { cx: left - 0.9 * em, cy: barY, r: 0.65 * em, label: item.label } : undefined,
  };
}

/** A thick arrow that points down at `tip`: the value end of a bar, or the top of a column. */
export function buildPointer(item: AnnotationLayerItem, at: { x: number; y: number }, em: number): DrawnMark {
  const x = at.x;
  const tip = at.y - 0.15 * em;
  const neck = tip - 0.7 * em;
  const top = tip - 1.9 * em;
  const head = 0.55 * em;
  const shaft = 0.22 * em;
  const points = [
    [x, tip],
    [x - head, neck],
    [x - shaft, neck],
    [x - shaft, top],
    [x + shaft, top],
    [x + shaft, neck],
    [x + head, neck],
  ];
  return {
    kind: "pointer",
    color: item.color,
    shape: points.map(([px, py]) => `${px},${py}`).join(" "),
    badge: item.label != null ? { cx: x + 1.1 * em, cy: top + 0.65 * em, r: 0.65 * em, label: item.label } : undefined,
  };
}

/**
 * A bracket around a range of rows of a chart with bars from left to right. A line
 * runs below the last row from `left` to the end of its bar, and from there up to the
 * end of the bar of the first row. `ends` are the x of the two values. `text` stands
 * in a frame at the left, at half the height of the rows.
 */
export function buildBracket(
  item: AnnotationLayerItem,
  first: Box,
  last: Box,
  ends: { first: number; last: number },
  left: number,
  text: string | undefined,
  em: number,
): DrawnMark {
  const firstIsUpper = first.y <= last.y;
  const [upper, lower] = firstIsUpper ? [first, last] : [last, first];
  const [upperEnd, lowerEnd] = firstIsUpper ? [ends.first, ends.last] : [ends.last, ends.first];
  const bottom = lower.y + lower.height + 0.2 * em;
  const points = [
    [left, bottom],
    [lowerEnd, bottom],
    [upperEnd, upper.y - 0.1 * em],
  ];
  const width = text ? textWidth(text, em) : 0;
  // beside the rows, at half their height
  const captionY = (upper.y + lower.y + lower.height) / 2;
  const caption = text ? { x: left + 0.5 * em + width / 2, y: captionY, text } : undefined;
  // the number stands behind the text, or in its place
  const badgeX = caption ? caption.x + width / 2 + 1.2 * em : left + 0.65 * em;
  return {
    kind: "bracket",
    color: item.color,
    path: points.map(([px, py]) => `${px},${py}`).join(" "),
    caption,
    frame: caption && {
      x: caption.x - width / 2 - 0.45 * em,
      y: caption.y - 0.7 * em,
      width: width + 0.9 * em,
      height: 1.4 * em,
      r: 0.7 * em,
    },
    badge: item.label != null ? { cx: badgeX, cy: captionY, r: 0.65 * em, label: item.label } : undefined,
  };
}
