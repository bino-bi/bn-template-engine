/**
 * Type definitions for the global application context store.
 *
 * Currently holds the active locale, which drives the `withTranslation` mixin
 * and the internationalization store to resolve the correct language bundle.
 *
 * @module stores/context
 */

/** Global context properties available to every component. */
export interface ContextStore {
  locale: string;
}
