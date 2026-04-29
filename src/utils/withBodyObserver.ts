import { getElement } from "@stencil/core";
import { runIfExisits } from "./utils";

/**
 * Mixin that observes changes to a component's text content.
 *
 * Installs a MutationObserver watching `childList`, `subtree`, and `characterData`
 * on the host element. Whenever the text content changes (e.g. slotted text updates),
 * the `onUpdate` callback is invoked with the element's current `textContent`.
 *
 * The callback is also fired once during `connectedCallback` with the initial content.
 *
 * @param component - The Stencil component instance
 * @param onUpdate - Callback receiving the element's `textContent` on every mutation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withBodyObserver = (component: any, onUpdate: (data: string) => void) => {
  let hostElement: HTMLElement;
  // Coalesce bursts of mutations (e.g. devtools "Edit as HTML" fires childList +
  // characterData in quick succession) and always read the *host* textContent so
  // we deliver the complete body, not the individual text node that mutated.
  const observer = new MutationObserver(() => {
    if (hostElement) onUpdate(hostElement.textContent ?? "");
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    hostElement = getElement(component);
    observer.observe(hostElement, { childList: true, subtree: true, characterData: true });
    onUpdate(hostElement.textContent ?? "");
    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(disconnectedCallback, component);
  };
};

export default withBodyObserver;
