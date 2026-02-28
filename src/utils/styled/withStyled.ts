import { styleSheet } from "./style-sheet";
import { apply, attributesNames } from "./attributes";
import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "../utils";

/**
 * Shared MutationObserver that watches for style-attribute changes on all
 * subscribed elements. When a monitored attribute changes, it re-applies the
 * Styletron CSS-in-JS stylesheet and updates the element's className,
 * preserving any non-`bn-c-` classes.
 */
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const el = mutation.target as Element;
    const map = apply(el);
    styleSheet.apply(map);
    const classes = Array.from(map.values()).map((value) => value.className);
    el.className = el.className
      .split(" ")
      .filter((value) => !value.startsWith("bn-c-"))
      .concat(...classes)
      .join(" ");

    forceUpdate(el);
  }
});

/**
 * Registers an element with the Styletron observer: applies the initial
 * stylesheet, assigns generated `bn-c-*` class names, and begins watching
 * for attribute mutations that affect styling.
 */
const subscribe = (el: HTMLElement) => {
  const map = apply(el);
  styleSheet.apply(map);
  const classes = Array.from(map.values()).map((value) => value.className);
  el.className = el.className
    .split(" ")
    .filter((value) => !value.startsWith("bn-c-"))
    .concat(...classes)
    .join(" ");

  observer.observe(el, { attributes: true, attributeFilter: attributesNames, childList: false, subtree: false });
};

/**
 * Mixin that integrates Styletron CSS-in-JS styling into a Stencil component.
 *
 * On `connectedCallback`, it subscribes the host element to a shared
 * MutationObserver that watches for style-related attribute changes. When
 * attributes change, the Styletron stylesheet is re-applied and the element's
 * class list is updated with generated `bn-c-*` class names, followed by a
 * forced re-render.
 *
 * @param component - The Stencil component instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withStyled = (component: any) => {
  const cstrConnectedCallback = component["connectedCallback"];
  const cstrDisconnectedCallback = component["disconnectedCallback"];

  component["connectedCallback"] = () => {
    const elm = getElement(component);
    if (elm) {
      subscribe(elm);
    } else {
      throw new Error(`Can't find element field in component ${this}`);
    }

    runIfExisits(cstrConnectedCallback, component);
  };

  component["disconnectedCallback"] = () => {
    //TODO do we to clear su subscription ? (sven)
    runIfExisits(cstrDisconnectedCallback, component);
  };
};
