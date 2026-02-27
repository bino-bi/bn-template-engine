export interface ParentDimensions {
  width: number;
  height: number;
}

/**
 * Returns the available dimensions for a component.
 *
 * Width: parent content-box width (excluding padding).
 * Height: walks up the DOM to find the nearest ancestor with a constrained
 *   height (overflow !== 'visible' or explicit max-height). Falls back to
 *   the viewport height when every ancestor auto-grows with its content.
 */
export function getParentDimensions(element: HTMLElement): ParentDimensions {
  const parent = element.parentElement;
  if (!parent) {
    return { width: 0, height: 0 };
  }

  const parentStyle = getComputedStyle(parent);
  const width = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);

  const height = findConstrainedHeight(element);

  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Walks up the ancestor chain to find a height that is actually constrained
 * (not just "whatever my content needs").  Returns viewport height as a
 * last resort.
 */
function findConstrainedHeight(element: HTMLElement): number {
  let current = element.parentElement;

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

    current = current.parentElement;
  }

  // No constrained ancestor found — use viewport
  return typeof window !== "undefined" ? window.innerHeight : 0;
}
