import { findContextElement } from "../../context/context-protocol";
import { DualRect, LayoutRect } from "./types";

/** Top-left corners (viewport coordinates) the dual rects are expressed against. */
export interface Origins {
  context: { x: number; y: number };
  component: { x: number; y: number };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Converts a viewport rect into a rounded {@link LayoutRect}. */
export function toLayoutRect(rect: { left: number; top: number; width: number; height: number }): LayoutRect {
  return {
    x: round2(rect.left),
    y: round2(rect.top),
    width: round2(rect.width),
    height: round2(rect.height),
  };
}

/** Expresses a viewport rect in both coordinate spaces of the given origins. */
export function toDualRect(
  rect: { left: number; top: number; width: number; height: number },
  origins: Origins,
): DualRect {
  const width = round2(rect.width);
  const height = round2(rect.height);
  return {
    context: { x: round2(rect.left - origins.context.x), y: round2(rect.top - origins.context.y), width, height },
    component: {
      x: round2(rect.left - origins.component.x),
      y: round2(rect.top - origins.component.y),
      width,
      height,
    },
  };
}

/** Measures an element and expresses its box in both coordinate spaces. */
export function measure(el: Element, origins: Origins): DualRect {
  return toDualRect(el.getBoundingClientRect(), origins);
}

/**
 * Width in layout px of a sign that a `::before` draws in front of the content
 * of an element. 0 without one. A range does not see it, and a screen box has no
 * "in front" on a rotated page, so it is reported next to the box.
 */
export function measureSign(el: Element): number {
  const before = getComputedStyle(el, "::before").content;
  if (!before || before === "none" || before === "normal") return 0;
  const context = el.ownerDocument.createElement("canvas").getContext("2d");
  if (!context) return 0;
  const { fontStyle, fontWeight, fontSize, fontFamily } = getComputedStyle(el);
  context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
  return context.measureText(before.replace(/^"|"$/g, "")).width;
}

/**
 * The box of what a table cell shows, without its free space: the text, or the
 * number of an in-cell bar chart. Cut to the cell, which clips a long text.
 * `undefined` when it shows nothing.
 */
export function measureContent(el: Element, origins: Origins): DualRect | undefined {
  const range = el.ownerDocument?.createRange?.();
  if (!range) return undefined;
  const cell = el.getBoundingClientRect();
  const chartLabel = el.querySelector("svg text");
  let measured: { left: number; top: number; right: number; bottom: number };
  if (chartLabel) {
    measured = chartLabel.getBoundingClientRect();
  } else {
    range.selectNodeContents(el);
    // a repeated prefix ("thereof ") is there, but transparent
    const hidden = el.querySelector(".prefix-second");
    if (hidden) range.setStartAfter(hidden);
    measured = range.getBoundingClientRect();
  }
  const left = Math.max(measured.left, cell.left);
  const top = Math.max(measured.top, cell.top);
  const width = Math.min(measured.right, cell.right) - left;
  const height = Math.min(measured.bottom, cell.bottom) - top;
  return width > 0 && height > 0 ? toDualRect({ left, top, width, height }, origins) : undefined;
}

/**
 * Resolves the coordinate origins for a component host: the nearest
 * `bn-context` ancestor's top-left and the host's own top-left. Without a
 * `bn-context` ancestor (standalone call) the host doubles as context
 * origin, so context rects equal component rects.
 */
export function originsFor(componentHost: HTMLElement): Origins {
  const componentRect = componentHost.getBoundingClientRect();
  const contextEl = findContextElement(componentHost);
  const contextRect = contextEl ? contextEl.getBoundingClientRect() : componentRect;
  return {
    context: { x: contextRect.left, y: contextRect.top },
    component: { x: componentRect.left, y: componentRect.top },
  };
}
