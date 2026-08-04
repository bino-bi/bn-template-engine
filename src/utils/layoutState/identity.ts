/**
 * Identity rules for layout-state entries: an explicit `id` attribute wins,
 * then a `name` attribute, otherwise `bn-context` assigns a generated
 * `tag[index]` path (per-tag document-order index).
 */

/** Explicit identity of a component host: `id` attr, then `name` attr. */
export function resolveOwnIdentity(el: HTMLElement): string | undefined {
  return el.getAttribute("id") ?? el.getAttribute("name") ?? undefined;
}

/**
 * Identity used when a component's `getLayoutState()` is called standalone
 * (not through `bn-context`): explicit identity, falling back to the tag name.
 */
export function resolveStandaloneId(el: HTMLElement): string {
  return resolveOwnIdentity(el) ?? el.localName;
}

/**
 * Returns the final id for each entry of a document-ordered component list:
 * the explicit id when present, otherwise `tag[index]`. The index counts all
 * instances of the tag in document order, so adding an explicit id to one
 * instance does not shift the generated ids of its siblings.
 */
export function assignIds(entries: { tag: string; explicitId?: string }[]): string[] {
  const counters = new Map<string, number>();
  return entries.map(({ tag, explicitId }) => {
    const index = counters.get(tag) ?? 0;
    counters.set(tag, index + 1);
    return explicitId ?? `${tag}[${index}]`;
  });
}
