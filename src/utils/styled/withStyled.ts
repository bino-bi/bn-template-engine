import {styleSheet} from './style-sheet';
import {apply, attributesNames} from './attributes';
import {getElement} from "@stencil/core";
import {runIfExisits} from "../utils";

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

export const withStyled = (component: any) => {
  const cstrConnectedCallback = component['connectedCallback'];
  const cstrDisconnectedCallback = component['disconnectedCallback'];

  component['connectedCallback'] = () => {
    const elm = getElement(component);
    if (elm) {
      subscribe(elm);
    } else {
      throw new Error(`Can't find element field in component ${this}`);
    }

    runIfExisits(cstrConnectedCallback, component)
  };

  component['disconnectedCallback'] = () => {
    //TODO do we to clear su subscription ? (sven)
    runIfExisits(cstrDisconnectedCallback, component)
  };
};
