import {getElement} from "@stencil/core";
import {runIfExisits} from "./utils";

const withBodyObserver = (component: any, onUpdate: (data: string) => void) => {

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      onUpdate(mutation.target.textContent);
    });
  });

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    const element = getElement(component);
    observer.observe(element, {childList: true, subtree: true, characterData: true});
    onUpdate(element.textContent);
    runIfExisits(connectedCallback);
  };

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(disconnectedCallback);
  };
}

export default withBodyObserver;
