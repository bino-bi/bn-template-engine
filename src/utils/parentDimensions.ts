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

  // A parent that is not laid out has no computed padding: the width is NaN then, and a caller that scales by it never recovers.
  return { width: Number.isFinite(width) ? Math.max(0, width) : 0, height: Math.max(0, height) };
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
 * `data-bn-fit-content` by bn-layout-page / bn-layout-card, and by every
 * cell of bn-grid and node of bn-tree) are skipped
 * even when they clip overflow: their height is derived from their own
 * content - including the measuring component itself - so using it for
 * auto-scaling creates a feedback loop where the chart inflates the cell
 * and then reads the inflated cell back as "available height". The marker
 * value carries the grid's row count; the constraint found above the
 * fit-content region is divided by it, approximating the equal-share cell
 * height the same layout would produce with fit-to-content disabled. A grid
 * cell and a tree node carry no row count: their content gets the same
 * height with and without a card around it.
 */
function findConstrainedHeight(element: HTMLElement, debug = false): number {
  let current: HTMLElement | null = findLayoutParent(element);
  let depth = 0;
  let candidate: number | null = null;
  let rowShareDivisor = 1;

  while (current) {
    // A fit-content region sizes itself from its content - every height
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
  // No constrained ancestor found - use viewport, applying the same
  // equal-share division a marked fit-content region demands
  return typeof window !== "undefined" ? window.innerHeight / rowShareDivisor : 0;
}

/**
 * How many px of an element are cut off at the bottom, given the height of its content
 * (both in layout px). Only an element that hides its overflow cuts something off: the
 * element itself or one of its visual ancestors. 0 when there is none, the page then
 * grows or scrolls and nothing is lost. Unlike the height of getParentDimensions this is
 * no estimate, so it suits a warning for content that does not adapt its height to the
 * space it has.
 */
export function getClippedHeight(element: HTMLElement, contentHeight: number): number {
  const rect = element.getBoundingClientRect();

  // Rects are in screen px, after transforms (a page that is scaled to fit its window).
  // `scale` converts the content height to them. Without a box (display: none) or under a
  // rotation, where width and height swap, there is nothing to compare: no cut is reported.
  const scale = element.offsetHeight > 0 ? rect.height / element.offsetHeight : 0;
  const scaleX = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 0;
  if (!(scale > 0) || Math.abs(scale - scaleX) > scale * 0.01) {
    return 0;
  }

  const bottom = rect.top + contentHeight * scale;
  let clipped = 0;

  for (let current: HTMLElement | null = element; current; current = getVisualParent(current)) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === "hidden" || overflow === "clip") {
      clipped = Math.max(clipped, bottom - current.getBoundingClientRect().bottom);
    } else if ((overflow === "auto" || overflow === "scroll") && current.scrollHeight > current.clientHeight + 1) {
      // what lies below the fold of a container that scrolls can be scrolled into view
      break;
    }
  }

  return clipped / scale;
}
