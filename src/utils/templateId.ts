/**
 * Walks up the DOM tree from `elm` to find the nearest ancestor that carries
 * a `template-id` attribute. Returns the attribute value, or `undefined` if
 * no ancestor has one.
 *
 * Used to associate components with a named report template scope so that
 * styles and data bindings can be scoped per-template.
 */
export const templateId = (elm: HTMLElement) => {
  return elm.closest("[template-id]")?.getAttribute("template-id") ?? undefined;
};
