/**
 * Scoped store resolution for `<bn-context>`.
 *
 * Each `<bn-context>` element owns its own set of `@stencil/store` instances.
 * Because Stencil does NOT guarantee parent-before-child initialization order,
 * stores are created lazily: the first component that calls `getStores()` walks
 * the DOM to find the nearest `<bn-context>` element and creates (or retrieves)
 * the stores for it. When `<bn-context>` itself initializes, it picks up the
 * already-created stores from the registry.
 *
 * @module context/context-protocol
 */

import { createScopedStores } from "../stores/createScopedStores";
import { Style } from "../stores/componentStyles";
import { ContextStore } from "../stores/context";
import { DatasetMeta } from "../utils/model/DatasetMeta";
import { ScopedDb } from "./scopedDb";

/** Return type of `createStore()` from `@stencil/store`. */
export interface StoreInstance<T extends object> {
  state: T;
  on: (
    event: "set" | "get" | "reset",
    callback: (key: keyof T, newValue?: unknown, oldValue?: unknown) => void,
  ) => () => void;
  get: (key: keyof T) => T[keyof T];
  set: (key: keyof T, value: T[keyof T]) => void;
}

/** Typed bag of all stores + the shared alasql database owned by a single `<bn-context>`. */
export interface ScopedStores {
  /** Shared isolated alasql database. Datasources/datasets register tables/views here. */
  db: ScopedDb;
  datasetsMeta: StoreInstance<Record<string, DatasetMeta>>;
  componentStyles: StoreInstance<Record<string, Style>>;
  internationalization: StoreInstance<Record<string, unknown>>;
  assets: StoreInstance<Record<string, string>>;
  context: StoreInstance<ContextStore>;
  scalingGroups: StoreInstance<Record<string, number>>;
}

/**
 * Module-level registry mapping `<bn-context>` DOM elements to their stores.
 * Stores are created lazily by `getOrCreateStores()` — whichever component
 * initializes first triggers creation for its ancestor `<bn-context>`.
 */
const contextRegistry = new WeakMap<HTMLElement, ScopedStores>();

/**
 * Returns the stores for a `<bn-context>` element, creating them if needed.
 * Called both by descendant components (via `getStores()`) and by the
 * `<bn-context>` component itself during its initialization.
 */
export function getOrCreateStores(contextElement: HTMLElement): ScopedStores {
  let stores = contextRegistry.get(contextElement);
  if (!stores) {
    stores = createScopedStores();
    contextRegistry.set(contextElement, stores);
  }
  return stores;
}

const storesCache = new WeakMap<HTMLElement, ScopedStores>();

/**
 * Walks up the DOM tree (crossing shadow boundaries) to find the nearest
 * `<bn-context>` ancestor element.
 */
function findContextElement(element: HTMLElement): HTMLElement | undefined {
  let current: Node | null = element.parentNode;
  while (current) {
    if (current instanceof HTMLElement && (current as HTMLElement).nodeName?.toLowerCase() === "bn-context") {
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
 * Resolves scoped stores from the nearest `<bn-context>` ancestor.
 *
 * Walks the DOM tree to find the nearest `<bn-context>` element, then
 * returns (or lazily creates) the stores for it. This works regardless
 * of Stencil component initialization order because it only depends on
 * the native DOM tree being in place.
 *
 * Results are cached per element in a WeakMap.
 *
 * @throws Error if no `<bn-context>` ancestor is found in the DOM
 */
export function getStores(element: HTMLElement): ScopedStores {
  const cached = storesCache.get(element);
  if (cached) return cached;

  const contextEl = findContextElement(element);

  if (!contextEl) {
    throw new Error(`[bn] <${element.localName}> must be inside a <bn-context>. No ancestor <bn-context> found.`);
  }

  const stores = getOrCreateStores(contextEl);
  storesCache.set(element, stores);
  return stores;
}

/** Removes the cached stores entry for an element (call in `disconnectedCallback`). */
export function clearStoresCache(element: HTMLElement): void {
  storesCache.delete(element);
}
