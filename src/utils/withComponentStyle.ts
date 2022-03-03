
import { forceUpdate, getElement } from "@stencil/core";
import state, { Style, on } from "../stores/componentStyles";
import { runIfExisits } from "./utils";
import { merge } from '@corex/deepmerge'

const withComponentStyle = (component: any) => {
  let subscription: () => void;

  let styles: string[] = [];
  let style: Style = state["_system"]

  const updateStyle = () => {
    style = merge([state["_system"], state["_default"], ...styles.map(key => state[key] || ({} as Style))]);
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'styles') {
        const elm = getElement(component);
        styles = (elm.getAttribute('styles') || "").split(",");
        updateStyle();
        forceUpdate(elm);
      }
    });
  });

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    const elm = getElement(component);
    observer.observe(elm, { attributes: true, attributeFilter: ['styles'] });
    styles = (elm.getAttribute('styles') || "").split(",");
    updateStyle();
    runIfExisits(connectedCallback);
  }

  subscription = on("set", key => {
    if (styles.includes(key as string) || key === "_default") {
      updateStyle();
      forceUpdate(getElement(component));
    }
  });

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    runIfExisits(disconnectedCallback);
  };

  const componentStyle = <T,>(q: ($style: Style) => T): T => {
    return q(style);
  }

  return componentStyle
}

export default withComponentStyle;
