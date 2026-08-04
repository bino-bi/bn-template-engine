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
