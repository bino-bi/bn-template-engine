import { LayoutRect } from "./types";

type Linear = [a: number, b: number, c: number, d: number];
type ViewportRect = { left: number; top: number; width: number; height: number };

const IDENTITY: Linear = [1, 0, 0, 1];

const multiply = ([a1, b1, c1, d1]: Linear, [a2, b2, c2, d2]: Linear): Linear => [
  a1 * a2 + c1 * b2,
  b1 * a2 + d1 * b2,
  a1 * c2 + c1 * d2,
  b1 * c2 + d1 * d2,
];

/** The rotation and scale part of an element's own CSS transform. */
function ownLinear(el: Element): Linear {
  if (typeof getComputedStyle !== "function" || typeof DOMMatrix !== "function") return IDENTITY;
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return IDENTITY;
  try {
    const { a, b, c, d } = new DOMMatrix(transform);
    return [a, b, c, d];
  } catch {
    return IDENTITY;
  }
}

/** The parent in the composed tree: the slot a node is shown in, its parent, or the host of its shadow root. */
function composedParent(el: Element): Element | null {
  return (
    (el as HTMLElement).assignedSlot ??
    el.parentElement ??
    (el.getRootNode() as ShadowRoot | Document as ShadowRoot).host ??
    null
  );
}

/** Rotation and scale from an element's own layout px to viewport px, over all its ancestors. */
function linearToViewport(el: Element): Linear {
  let linear = IDENTITY;
  for (let current: Element | null = el; current; current = composedParent(current)) {
    linear = multiply(ownLinear(current), linear);
  }
  return linear;
}

/** Maps viewport boxes into the layout px of an element (origin at its top-left corner). */
export interface LocalFrame {
  toLocal(rect: ViewportRect): LayoutRect;
}

/**
 * The layout frame of an element, also on a turned or scaled page. A
 * viewport box is axis-aligned there, so it maps to the box its corners span.
 */
export function localFrameOf(el: Element): LocalFrame {
  const [a, b, c, d] = linearToViewport(el);
  const det = a * d - b * c;
  if (det === 0) {
    const origin = el.getBoundingClientRect();
    return {
      toLocal: (rect) => ({
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }),
    };
  }
  const apply = (x: number, y: number) => ({ x: a * x + c * y, y: b * x + d * y });
  const html = el as HTMLElement;
  const box = el.getBoundingClientRect();
  const width = html.offsetWidth ?? box.width;
  const height = html.offsetHeight ?? box.height;
  const corners = [apply(0, 0), apply(width, 0), apply(0, height), apply(width, height)];
  // the viewport box of the element is the box of its mapped corners: that fixes the translation
  const tx = box.left - Math.min(...corners.map((p) => p.x));
  const ty = box.top - Math.min(...corners.map((p) => p.y));
  const invert = (x: number, y: number) => {
    const dx = x - tx;
    const dy = y - ty;
    return { x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det };
  };
  return {
    toLocal: (rect) => {
      const points = [
        invert(rect.left, rect.top),
        invert(rect.left + rect.width, rect.top),
        invert(rect.left, rect.top + rect.height),
        invert(rect.left + rect.width, rect.top + rect.height),
      ];
      const x = Math.min(...points.map((p) => p.x));
      const y = Math.min(...points.map((p) => p.y));
      return {
        x,
        y,
        width: Math.max(...points.map((p) => p.x)) - x,
        height: Math.max(...points.map((p) => p.y)) - y,
      };
    },
  };
}
