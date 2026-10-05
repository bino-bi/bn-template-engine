import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "./utils";
import { isBlankInput } from "./validate";
import { ErrorDispatcher } from "./withHasError";

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

/** What a prop resolves to. */
export interface InheritedProp {
  /** The ancestor's value, the prop's own value, or the fallback of an unresolved keyword. */
  value: string;
  /** `value` was taken from an ancestor. */
  inherited: boolean;
  /** The prop is an inheritance keyword and no ancestor sets the field. */
  unresolved: boolean;
}

/**
 * Resolver function returned by the mixin.
 * `fallback` is what an unresolved keyword stands for. Without it the value is
 * `undefined`, as if the prop was not set.
 */
export type InheritedResolver = (propName: string, currentValue: string, fallback?: string) => InheritedProp;

/**
 * Returns `true` when `value` is one of the recognised inheritance keywords.
 */
export function isInheritedValue(value: string): boolean {
  return value === INHERITED_CLOSEST || value === INHERITED_PAGE;
}

/**
 * Walks up the DOM tree (crossing shadow boundaries) and collects the layout
 * ancestors an inheritance keyword can take its value from, nearest first.
 *
 * - `"inherited-closest"`: every `bn-layout-card` up to and including the
 *   first `bn-layout-page`.
 * - `"inherited-page"`: that `bn-layout-page` only.
 *
 * Uses the same traversal pattern as `findContextElement` in
 * `context-protocol.ts`.
 */
export function findLayoutAncestors(element: HTMLElement, mode: string): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let current: Node | null = element.parentNode;
  while (current) {
    const tag = current.nodeName.toLowerCase();
    if (tag === ANCESTOR_PAGE) {
      ancestors.push(current as HTMLElement);
      break;
    }
    if (tag === ANCESTOR_CARD && mode !== INHERITED_PAGE) {
      ancestors.push(current as HTMLElement);
    }
    if (current.parentNode) {
      current = current.parentNode;
    } else if (current instanceof ShadowRoot) {
      current = current.host;
    } else {
      break;
    }
  }
  return ancestors;
}

/**
 * Reads `attr` from the nearest of `ancestors` that sets it.
 *
 * An ancestor whose attribute is missing, blank or itself an inheritance
 * keyword (a card that could not resolve its own value) does not set it and
 * is skipped, so a keyword is never handed down as a value.
 */
export function readInherited(ancestors: HTMLElement[], attr: string): string | undefined {
  for (const ancestor of ancestors) {
    const value = ancestor.getAttribute(attr);
    const trimmed = value?.trim();
    if (!isBlankInput(trimmed) && !isInheritedValue(trimmed)) return value;
  }
  return undefined;
}

/**
 * Walks up the DOM tree (crossing shadow boundaries) to find the nearest
 * ancestor element that carries the given attribute, whatever its tag.
 * Used for attributes that inherit by default (e.g. `i18n-namespace`), where
 * any container - layout card, layout page, tree, grid, or the `bn-context`
 * itself - can act as the provider.
 */
export function findAncestorWithAttr(element: HTMLElement, attr: string): HTMLElement | undefined {
  let current: Node | null = element.parentNode;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(attr)) {
      return current;
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
 * this mixin resolves the actual value by walking up the DOM and reading the
 * corresponding HTML attribute from the nearest `bn-layout-card` /
 * `bn-layout-page` that sets it. A `MutationObserver` watches every ancestor
 * on that path for attribute changes, triggering a re-render when inherited
 * values update.
 *
 * Follows the same decorator-style pattern as `withComponentStyle`.
 *
 * A keyword that no ancestor satisfies is never used as a value: the resolver
 * returns the fallback instead and, when `errors` is given, keeps a
 * `WARN_inherited_<prop>` warning in it for as long as the keyword is
 * unresolved.
 *
 * @param component  The Stencil component instance
 * @param mappings   Array of prop-to-attribute mappings
 * @param errors     The component's error list, to report unresolved keywords
 * @returns A resolver function used inside `prepare*()` methods
 */
const withInheritedProps = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any,
  mappings: PropMapping[],
  errors?: ErrorDispatcher,
): InheritedResolver => {
  /** Resolved values keyed by propName. */
  const resolved = new Map<string, string>();

  /** The keyword each prop held at the last lookup, keyed by propName. */
  const lookedUp = new Map<string, string>();

  /** Observer watching the layout ancestors' attributes. */
  let observer: MutationObserver | null = null;

  /**
   * Resolves each mapping whose prop is an inheritance keyword and watches
   * every ancestor that can change the outcome, so a value that appears later
   * on a card or the page is picked up.
   */
  const resolveAll = () => {
    const element = getElement(component);
    resolved.clear();
    lookedUp.clear();
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    const attrsToWatch = new Map<HTMLElement, string[]>();

    for (const mapping of mappings) {
      const value = component[mapping.propName];
      if (typeof value !== "string" || !isInheritedValue(value)) continue;
      lookedUp.set(mapping.propName, value);

      // Looked up per prop: scenarios may come from a card and order from the page.
      const ancestors = findLayoutAncestors(element, value);
      const inherited = readInherited(ancestors, mapping.ancestorAttr);
      if (inherited !== undefined) {
        resolved.set(mapping.propName, inherited);
      }
      for (const ancestor of ancestors) {
        attrsToWatch.set(ancestor, [...(attrsToWatch.get(ancestor) ?? []), mapping.ancestorAttr]);
      }
    }

    if (attrsToWatch.size > 0) {
      observer = new MutationObserver(() => {
        resolveAll();
        forceUpdate(component);
      });
      for (const [ancestor, attributeFilter] of attrsToWatch) {
        observer.observe(ancestor, { attributes: true, attributeFilter });
      }
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
    resolved.clear();
    lookedUp.clear();
    runIfExisits(disconnectedCallback, component);
  };

  /** The layout field behind a mapped attribute, e.g. `title-scenarios` -> `titleScenarios`. */
  const fieldName = (propName: string): string =>
    mappings
      .find((mapping) => mapping.propName === propName)
      ?.ancestorAttr.replace(/-(\w)/g, (_match, char: string) => char.toUpperCase());

  /**
   * Resolver: the one place that decides which value a mapped prop stands
   * for, and that reports a keyword no ancestor satisfies.
   */
  const resolve: InheritedResolver = (propName: string, currentValue: string, fallback?: string): InheritedProp => {
    const warningId = `WARN_inherited_${propName}`;
    const isKeyword = isInheritedValue(currentValue);

    // The prop became a keyword, or a different one, after the last lookup.
    if (isKeyword && lookedUp.get(propName) !== currentValue) {
      resolveAll();
    }
    const inherited = isKeyword ? resolved.get(propName) : undefined;

    if (isKeyword && inherited === undefined) {
      const scope = currentValue === INHERITED_PAGE ? "page" : "card or page";
      errors?.addOrReplace({
        id: warningId,
        type: "warning",
        message: `${propName}: '${currentValue}' could not be resolved, no surrounding ${scope} sets ${fieldName(propName)}`,
      });
      return { value: fallback, inherited: false, unresolved: true };
    }

    errors?.remove(warningId);
    return { value: inherited ?? currentValue, inherited: inherited !== undefined, unresolved: false };
  };

  return resolve;
};

export default withInheritedProps;
