import { getElement } from "@stencil/core";
import { runIfExisits } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withBodyObserver = (component: any, onUpdate: (data: string) => void) => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      onUpdate(mutation.target.textContent);
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    onUpdate(element.textContent);
    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(disconnectedCallback, component);
  };
};

export default withBodyObserver;
