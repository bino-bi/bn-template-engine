import { Svg } from "@svgdotjs/svg.js";

/**
 * Keeps a working SVG attached to the document while it is being drawn, so
 * svg.js can measure it in place.
 *
 * svg.js's `bbox()` calls `getBBox()` on the node; on a **detached** tree that
 * returns a nulled box, so it falls back to a retry path that deep-clones the
 * subtree, appends the clone to a hidden sandbox in `document.body`, measures
 * *that*, and removes it again. Charts are drawn detached and measure heavily
 * (every label reads its own box), so the retry dominates render cost: one
 * logical measurement costs two `getBBox()` calls plus a full subtree clone and
 * two DOM mutations.
 *
 * Drawing inside a host that is already in the document makes the first
 * `getBBox()` succeed, which skips the clone entirely.
 *
 * The host is styled exactly like svg.js's own parser sandbox (see
 * `parser()` in @svgdotjs/svg.js) so the measurement context — and therefore
 * every measured value — is identical to what the retry path produced.
 */
const HOST_ID = "bn-measurement-host";
const HOST_CSS = "opacity:0;position:absolute;left:-100%;top:-100%;overflow:hidden";

function getHost(): HTMLElement | null {
  if (typeof document === "undefined" || !document.body) {
    return null;
  }
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = HOST_CSS;
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
  }
  return host;
}

/**
 * Runs `drawFn` with `container` temporarily attached to the hidden
 * measurement host, then detaches it again.
 *
 * Falls back to drawing detached when there is no live document (spec runs
 * under mock-doc), so callers need no environment check of their own.
 */
export function drawAttached(container: Svg, drawFn: () => void): void {
  const host = getHost();
  if (!host) {
    drawFn();
    return;
  }

  host.appendChild(container.node);
  try {
    drawFn();
  } finally {
    if (container.node.parentNode === host) {
      host.removeChild(container.node);
    }
  }
}
