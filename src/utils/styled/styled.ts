import {styleSheet} from './style-sheet';
import {apply, attributesNames} from './attributes';
import {getElement} from "@stencil/core";

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const el = mutation.target as Element;
    const map = apply(el);
    styleSheet.apply(map);
    const classes = Array.from(map.values()).map(value => value.className);
    el.className = el.className.split(" ").filter(value => !value.startsWith("bn-c-")).concat(...classes).join(" ");
  }
});

const subscribe = (el: HTMLElement) => {
  const map = apply(el);
  styleSheet.apply(map);
  const classes = Array.from(map.values()).map(value => value.className);
  el.className = el.className.split(" ").filter(value => !value.startsWith("bn-c-")).concat(...classes).join(" ");

  observer.observe(
    el,
    {attributes: true, attributeFilter: attributesNames, childList: false, subtree: false}
  );
};

export const styled = (Cstr: any) => {
  const CstrPrototype = Cstr.prototype;
  const cstrConnectedCallback = CstrPrototype.connectedCallback;
  const cstrDisconnectedCallback = CstrPrototype.disconnectedCallback;

  CstrPrototype.connectedCallback = function () {
    const elm = getElement(this);
    if (elm) {
      subscribe(elm);
    } else {
      throw new Error(`Can't find element field in component ${this}`);
    }

    if (cstrConnectedCallback) {
      return cstrConnectedCallback.call(this);
    }
  };

  CstrPrototype.disconnectedCallback = function () {
    if (cstrDisconnectedCallback) {
      cstrDisconnectedCallback.call(this);
    }
  };
};
