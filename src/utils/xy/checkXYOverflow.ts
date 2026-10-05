import { getClippedHeight, getParentDimensions } from "../parentDimensions";
import { ErrorDispatcher } from "../withHasError";

/**
 * Sets or removes WARN_overflow on the facade of an XY chart. The chart takes the width
 * of its parent and its height follows from `aspect`, so the height is what usually does
 * not fit. It does not adapt to the height it has, so the height counts only when an
 * ancestor really cuts the chart off: on a page that grows or scrolls nothing is lost.
 */
export function checkXYOverflow(host: HTMLElement, innerTag: string, errors: ErrorDispatcher): void {
  const errId = "WARN_overflow";
  const parent = getParentDimensions(host);

  const svgHeight = parseFloat(
    host.shadowRoot?.querySelector(innerTag)?.shadowRoot?.querySelector("svg#drawCanvas")?.getAttribute("height") ?? "",
  );
  const contentHeight = Math.max(Number.isNaN(svgHeight) ? 0 : Math.floor(svgHeight), host.scrollHeight || 0);
  const contentWidth = host.scrollWidth || 0;

  const dims: string[] = [];
  if (parent.width > 0 && contentWidth > parent.width + 1) {
    dims.push(`width (${Math.round(contentWidth)}px > ${Math.round(parent.width)}px)`);
  }
  const clipped = getClippedHeight(host, contentHeight);
  if (clipped > 1) {
    dims.push(`height (${Math.round(contentHeight)}px > ${Math.round(contentHeight - clipped)}px)`);
  }

  if (dims.length === 0) {
    errors.remove(errId);
    return;
  }

  errors.addOrReplace({
    id: errId,
    type: "warning",
    message: `Chart exceeds available ${dims.join(" and ")} and will be cut off. Check the scale and aspect values or enlarge the container.`,
  });
}
