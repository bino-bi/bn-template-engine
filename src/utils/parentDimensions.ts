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
export function getParentDimensions(element: HTMLElement, debug = false): ParentDimensions {
  const parent = findLayoutParent(element);
  if (!parent) {
    if (debug) console.log("[parentDims] no layout parent found for", element.tagName);
    return { width: 0, height: 0 };
  }

  const parentStyle = getComputedStyle(parent);
  const width = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);

  const height = findConstrainedHeight(element, debug);

  if (debug) {
    console.log(
      "[parentDims]",
      element.tagName,
      "→ layoutParent:",
      parent.tagName,
      parent.className || "(no class)",
      `clientW=${parent.clientWidth} → w=${Math.round(width)}, h=${Math.round(height)}`,
      "overflow:",
      parentStyle.overflow,
    );
  }

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
 * Returns the visual parent, crossing shadow DOM boundaries in both
 * directions: via assignedSlot for slotted elements (light → shadow) and
 * via the shadow host when the element is a top-level child of a shadow
 * root (shadow → host). Without the host crossing, the ancestor walk dies
 * at the top of a component's shadow tree (e.g. inside bn-layout-card)
 * and never sees outer constraints.
 */
function getVisualParent(element: HTMLElement): HTMLElement | null {
  if (element.assignedSlot?.parentElement) {
    return element.assignedSlot.parentElement as HTMLElement;
  }
  if (element.parentElement) {
    return element.parentElement;
  }
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
}

/**
 * Walks up the ancestor chain to find a height that is actually constrained
 * (not just "whatever my content needs"). Crosses shadow DOM boundaries
 * via assignedSlot when encountering slotted elements. Returns viewport
 * height as a last resort.
 *
 * Ancestors inside a fit-content layout region (marked with
 * `data-bn-fit-content` by bn-layout-page / bn-layout-card) are skipped
 * even when they clip overflow: their height is derived from their own
 * content — including the measuring component itself — so using it for
 * auto-scaling creates a feedback loop where the chart inflates the cell
 * and then reads the inflated cell back as "available height". The marker
 * value carries the grid's row count; the constraint found above the
 * fit-content region is divided by it, approximating the equal-share cell
 * height the same layout would produce with fit-to-content disabled.
 */
function findConstrainedHeight(element: HTMLElement, debug = false): number {
  let current: HTMLElement | null = findLayoutParent(element);
  let depth = 0;
  let candidate: number | null = null;
  let rowShareDivisor = 1;

  while (current) {
    // A fit-content region sizes itself from its content — every height
    // measured below this point is circular. Discard inner candidates and
    // keep walking for a content-independent constraint further up.
    if (current.hasAttribute("data-bn-fit-content")) {
      if (debug) console.log(`[height:${depth}]`, current.tagName, "fit-content region → discarding inner candidate");
      candidate = null;
      const rows = parseInt(current.getAttribute("data-bn-fit-content"), 10);
      if (!isNaN(rows) && rows > 1) {
        rowShareDivisor *= rows;
      }
      current = getVisualParent(current);
      depth++;
      continue;
    }

    const style = getComputedStyle(current);
    const overflow = style.overflowY;

    if (debug) {
      console.log(
        `[height:${depth}]`,
        current.tagName,
        current.className || "(no class)",
        `overflow=${overflow} clientH=${current.clientHeight} h=${style.height}`,
      );
    }

    if (candidate === null) {
      // An ancestor that clips / scrolls its content has a meaningful height
      if (overflow === "hidden" || overflow === "scroll" || overflow === "auto") {
        candidate = current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        if (debug) console.log(`[height] candidate at depth ${depth}: ${Math.round(candidate)}px`);
      } else if (style.maxHeight !== "none") {
        // An explicit max-height constrains the available space
        const mh = parseFloat(style.maxHeight);
        if (!isNaN(mh) && mh > 0) {
          candidate = Math.min(
            mh,
            current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
          );
        }
      }
    }

    current = getVisualParent(current);
    depth++;
  }

  if (candidate !== null) {
    return candidate / rowShareDivisor;
  }

  if (debug) console.log("[height] NO constrained ancestor → viewport fallback");
  // No constrained ancestor found — use viewport
  return typeof window !== "undefined" ? window.innerHeight : 0;
}
