import { getElement } from "@stencil/core";
import { nanoid } from "nanoid";
import { ref } from "./utils";

/**
 * A single error or warning produced by component-level prop validation.
 * Items with an explicit `id` can be replaced or removed individually.
 */
export interface ErrorItem {
  id?: string;
  type: "error" | "warning";
  message: string;
  description?: string;
}

/**
 * What a component reports. The id prefix fixes the type: `ERR_` is an error,
 * `WARN_` and `AUTO_` are warnings. A mismatch does not compile.
 */
export type ErrorReport =
  | { id: `ERR_${string}`; type: "error"; message: string; description?: string }
  | { id: `WARN_${string}` | `AUTO_${string}`; type: "warning"; message: string; description?: string };

/**
 * API returned by {@link withHasError} for managing a component's error/warning list.
 * Mutations automatically sync to the host element's `has-error` attribute as JSON.
 */
export interface ErrorDispatcher {
  clear: () => void;
  replace: (errors: ErrorItem[]) => void;
  add: (error: ErrorItem) => string;
  addOrReplace: (error: ErrorReport) => string;
  remove: (id: string) => void;
}

/**
 * Reports content that does not fit: `ERR_overflow` when the author fixed the
 * size, `WARN_overflow` otherwise. The id carries the type, so the other id is
 * cleared. `message` null clears both.
 */
export function reportOverflow(errors: ErrorDispatcher, message: string | null, fixedSize = false): void {
  errors.remove(message !== null && fixedSize ? "WARN_overflow" : "ERR_overflow");
  if (message === null) {
    errors.remove("WARN_overflow");
  } else if (fixedSize) {
    errors.addOrReplace({ id: "ERR_overflow", type: "error", message });
  } else {
    errors.addOrReplace({ id: "WARN_overflow", type: "warning", message });
  }
}

/**
 * Mixin that provides an {@link ErrorDispatcher} for managing validation
 * errors and warnings on a component.
 *
 * Errors are stored internally via a reactive {@link ref}. On every change,
 * the host element's `has-error` attribute is updated with a JSON-serialized
 * array of {@link ErrorItem}s (or removed when empty). This allows external
 * CSS selectors and parent components to detect error states declaratively.
 *
 * @param component - The Stencil component instance
 * @returns An {@link ErrorDispatcher} for adding, replacing, and removing errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withHasError = (component: any) => {
  const { set, modify } = ref<ErrorItem[]>([], (items) => {
    const elm = getElement(component);
    if (items.length === 0) {
      elm.removeAttribute("has-error");
    } else {
      elm.setAttribute("has-error", JSON.stringify(items));
    }
  });

  return {
    clear: () => {
      set([]);
    },
    replace: (errors: ErrorItem[]) => {
      set(
        errors.map((item) => {
          if (!item.id) {
            item.id = nanoid();
          }
          return item;
        }),
      );
    },
    add: (error: ErrorItem) => {
      if (!error.id) error.id = nanoid();
      modify((current) => [...current, error]);
      return error.id;
    },
    addOrReplace: (error: ErrorReport) => {
      modify((current) => [...current.filter((item) => item.id !== error.id), error]);
      return error.id;
    },
    remove: (id: string) => {
      modify((current) => current.filter((item) => item.id !== id));
    },
  } as ErrorDispatcher;
};

export default withHasError;
