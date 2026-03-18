export interface ParentDimensions {
  width: number;
  height: number;
}

/**
 * Returns the available dimensions for a component.
 *
 * Width: visual parent's content-box width (excluding padding).
 * Height: walks up the DOM to find the nearest ancestor with a constrained
 *   height (overflow !== 'visible' or explicit max-height). Falls back to
 *   the viewport height when every ancestor auto-grows with its content.
 *
 * When the component is slotted into a shadow DOM (e.g. inside
 * bn-layout-page or bn-layout-card), the light DOM parentElement is NOT the
 * visual container. We cross the light→shadow boundary via assignedSlot to
 * find the actual slot wrapper that determines layout.
 */
export function getParentDimensions(element: HTMLElement): ParentDimensions {
  const parent = findLayoutParent(element);
  if (!parent) {
    return { width: 0, height: 0 };
  }

  const parentStyle = getComputedStyle(parent);
  const width = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);

  const height = findConstrainedHeight(element);

  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Returns the visual layout parent of an element, crossing the
 * light→shadow DOM boundary when the element's parent is slotted.
 *
 * For a slotted element, the light DOM parentElement is NOT where
 * the element renders visually. The actual container is the shadow
 * DOM element that wraps the <slot>. We reach it via assignedSlot.
 */
function findLayoutParent(element: HTMLElement): HTMLElement | null {
  const lightParent = element.parentElement;
  if (lightParent?.assignedSlot?.parentElement) {
    return lightParent.assignedSlot.parentElement as HTMLElement;
  }
  return lightParent;
}

/**
 * Returns the visual parent, crossing shadow DOM boundaries via assignedSlot.
 */
function getVisualParent(element: HTMLElement): HTMLElement | null {
  if (element.assignedSlot?.parentElement) {
    return element.assignedSlot.parentElement as HTMLElement;
  }
  return element.parentElement;
}

/**
 * Walks up the ancestor chain to find a height that is actually constrained
 * (not just "whatever my content needs"). Crosses shadow DOM boundaries
 * via assignedSlot when encountering slotted elements. Returns viewport
 * height as a last resort.
 */
function findConstrainedHeight(element: HTMLElement): number {
  let current: HTMLElement | null = findLayoutParent(element);

  while (current) {
    const style = getComputedStyle(current);
    const overflow = style.overflowY;

    // An ancestor that clips / scrolls its content has a meaningful height
    if (overflow === "hidden" || overflow === "scroll" || overflow === "auto") {
      return current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    }

    // An explicit max-height constrains the available space
    if (style.maxHeight !== "none") {
      const mh = parseFloat(style.maxHeight);
      if (!isNaN(mh) && mh > 0) {
        return Math.min(mh, current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      }
    }

    current = getVisualParent(current);
  }

  // No constrained ancestor found — use viewport
  return typeof window !== "undefined" ? window.innerHeight : 0;
}
