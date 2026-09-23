/**
 * Mirrors the inner no-data state on the outer component's host.
 *
 * Only the inner `ibcs-*` element knows it has no rows; it sets `no-data` on
 * its own host. The outer host sits in a layout slot wrapper as an
 * inline-block, so it must fill that wrapper too before the empty-state box
 * can fill the cell (see styles/_empty-state.scss). Call from the outer
 * component's componentDidRender, which runs after the inners have rendered.
 */
export function syncEmptyState(host: HTMLElement, innerTag: string): void {
  const inners = Array.from(host.shadowRoot?.querySelectorAll(innerTag) ?? []);
  const empty = inners.length > 0 && inners.every((inner) => inner.classList.contains("no-data"));
  // Not classList.toggle(name, force): Stencil's mock-doc ignores `force`.
  if (empty) {
    host.classList.add("no-data");
  } else {
    host.classList.remove("no-data");
  }
}
