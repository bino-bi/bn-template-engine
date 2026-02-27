import { getElement } from "@stencil/core";
import { nanoid } from "nanoid";
import { ref } from "./utils";

export interface ErrorItem {
  id?: string;
  type: "error" | "warning";
  message: string;
  description?: string;
}

export interface ErrorDispatcher {
  clear: () => void;
  replace: (errors: ErrorItem[]) => void;
  add: (error: ErrorItem) => string;
  addOrReplace: (error: ErrorItem) => string;
  remove: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withHasError = (component: any) => {
  const { set, modify } = ref<ErrorItem[]>([], (items) => {
    const elm = getElement(component);
    if (items.length == 0) {
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
    addOrReplace: (error: ErrorItem) => {
      if (error.id === undefined) throw "missing";
      modify((current) => [...current.filter((item) => item.id !== error.id), error]);
      return error.id;
    },
    remove: (id: string) => {
      modify((current) => current.filter((item) => item.id !== id));
    },
  } as ErrorDispatcher;
};

export default withHasError;
