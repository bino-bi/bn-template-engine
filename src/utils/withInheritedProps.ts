import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "./utils";

/**
 * Reserved prop values that activate inheritance from ancestor layout
 * components (`bn-layout-card` or `bn-layout-page`).
 */
export const INHERITED_CLOSEST = "inherited-closest";
export const INHERITED_PAGE = "inherited-page";

/** Tags that qualify as inheritance ancestors. */
const ANCESTOR_CARD = "bn-layout-card";
const ANCESTOR_PAGE = "bn-layout-page";

/** Maps a descendant prop name to the HTML attribute on the ancestor. */
export interface PropMapping {
  propName: string;
  ancestorAttr: string;
}

/**
 * Resolver function returned by the mixin.
 * Returns the resolved ancestor value, or `undefined` when the prop is not
 * an inheritance keyword (meaning the caller should use its normal logic).
 */
export type InheritedResolver = (propName: string, currentValue: string) => string | undefined;

/**
 * Returns `true` when `value` is one of the recognised inheritance keywords.
 */
export function isInheritedValue(value: string): boolean {
  return value === INHERITED_CLOSEST || value === INHERITED_PAGE;
}

/**
 * Walks up the DOM tree (crossing shadow boundaries) to find the nearest
 * ancestor layout component.
 *
 * - `"inherited-closest"` matches the first `bn-layout-card` or `bn-layout-page`.
 * - `"inherited-page"` skips cards and matches only `bn-layout-page`.
 *
 * Uses the same traversal pattern as `findContextElement` in
 * `context-protocol.ts`.
 */
export function findAncestor(element: HTMLElement, mode: string): HTMLElement | undefined {
  let current: Node | null = element.parentNode;
  while (current) {
    if (current instanceof HTMLElement) {
      const tag = current.nodeName.toLowerCase();
      if (mode === INHERITED_PAGE) {
        if (tag === ANCESTOR_PAGE) return current;
      } else {
        if (tag === ANCESTOR_CARD || tag === ANCESTOR_PAGE) return current;
      }
    }
    if (current.parentNode) {
      current = current.parentNode;
    } else if (current instanceof ShadowRoot) {
      current = current.host;
    } else {
      break;
    }
  }
  return undefined;
}

/**
 * Mixin that enables property inheritance from ancestor layout components.
 *
 * When a component sets a prop to `"inherited-closest"` or `"inherited-page"`,
 * this mixin resolves the actual value by walking up the DOM to find the
 * nearest `bn-layout-card` / `bn-layout-page` and reading the corresponding
 * HTML attribute. A `MutationObserver` watches the ancestor for attribute
 * changes, triggering a re-render when inherited values update.
 *
 * Follows the same decorator-style pattern as `withComponentStyle`.
 *
 * @param component  The Stencil component instance
 * @param mappings   Array of prop-to-attribute mappings
 * @returns A resolver function used inside `prepare*()` methods
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withInheritedProps = (component: any, mappings: PropMapping[]): InheritedResolver => {
  /** Resolved values keyed by propName. */
  const resolved = new Map<string, string>();

  /** Observer watching the ancestor element's attributes. */
  let observer: MutationObserver | null = null;

  /** The ancestor element currently being observed. */
  let ancestorEl: HTMLElement | undefined;

  /**
   * For each mapping whose prop is an inheritance keyword, walk the DOM once
   * and read the corresponding attribute from the ancestor.
   */
  const resolveAll = () => {
    const element = getElement(component);
    resolved.clear();

    // Determine which attrs to watch on which ancestor
    const attrsToWatch: string[] = [];

    for (const mapping of mappings) {
      const value = component[mapping.propName];
      if (typeof value !== "string" || !isInheritedValue(value)) continue;

      // Find ancestor (re-use the first one found for the same mode)
      if (!ancestorEl) {
        ancestorEl = findAncestor(element, value);
      }
      if (!ancestorEl) continue;

      const attrValue = ancestorEl.getAttribute(mapping.ancestorAttr);
      if (attrValue != null) {
        resolved.set(mapping.propName, attrValue);
      }
      attrsToWatch.push(mapping.ancestorAttr);
    }

    // Set up MutationObserver on the ancestor
    if (ancestorEl && attrsToWatch.length > 0) {
      observer = new MutationObserver(() => {
        // Re-read all inherited attributes from the ancestor
        for (const mapping of mappings) {
          if (!isInheritedValue(component[mapping.propName])) continue;
          const attrValue = ancestorEl.getAttribute(mapping.ancestorAttr);
          if (attrValue != null) {
            resolved.set(mapping.propName, attrValue);
          } else {
            resolved.delete(mapping.propName);
          }
        }
        forceUpdate(component);
      });
      observer.observe(ancestorEl, {
        attributes: true,
        attributeFilter: attrsToWatch,
      });
    }
  };

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    resolveAll();
    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    ancestorEl = undefined;
    resolved.clear();
    runIfExisits(disconnectedCallback, component);
  };

  /**
   * Resolver: returns the inherited value for the given prop, or `undefined`
   * when the prop is not using inheritance (so the caller falls through to
   * its normal logic).
   */
  const resolve: InheritedResolver = (propName: string, currentValue: string): string | undefined => {
    if (!isInheritedValue(currentValue)) return undefined;
    return resolved.get(propName);
  };

  return resolve;
};

export default withInheritedProps;
