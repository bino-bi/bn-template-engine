import { getElement } from "@stencil/core";
import { generateUUID, runIfExisits } from "./utils";
import { ComponentFailure, ComponentRegister, ComponentStatus } from "./componentRegister";

// Stencil calls these once per instance, so a failure in them is never repaired by a later render.
const LOAD_HOOKS = ["componentWillLoad", "componentDidLoad"];
// The hooks of every render cycle. componentWillUpdate is the first one of an update.
const CYCLE_HOOKS = [
  "componentWillUpdate",
  "componentWillRender",
  "render",
  "componentDidRender",
  "componentDidUpdate",
];
// The hooks a cycle starts with: the component is rendering from here on.
const START_HOOKS = ["componentWillLoad", "componentWillUpdate", "componentWillRender"];

const describeFailure = (element: HTMLElement | undefined, message: string): ComponentFailure => ({
  tag: element?.localName ?? "",
  // an inner renderer has no id of its own: name the component it is drawn for
  id: element?.id || (element?.getRootNode?.() as ShadowRoot | undefined)?.host?.id || "",
  message,
});

/**
 * Mixin that tracks a component's render lifecycle in the global {@link ComponentRegister}.
 *
 * Assigns a stable UUID to the component instance and reports status transitions:
 * - `RUNNING` from `connectedCallback` (only before the first render: a re-attach does not render again)
 *   or from the first hook of a render cycle, until `componentDidRender`
 * - `ERROR` when `render` or a lifecycle hook threw. Stencil catches such an exception and
 *   goes on, so without this the component would count as rendered.
 * - `SUCCESSFUL` otherwise
 *
 * A component that leaves the document is removed from the register.
 *
 * Returns a hold function: the component stays `RUNNING` until the promise
 * passed to it has settled, whatever the outcome.
 *
 * External tools (e.g. screenshot/PDF renderers) poll
 * `window.componentRegisterIsRenderedResult` to determine when all components
 * have finished rendering.
 *
 * @param component - The Stencil component instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withComponentStatus = (component: any) => {
  const uuid: string = generateUUID();
  let pending = 0;
  let rendered = false;
  let rendering = false;
  let loadFailure: string | undefined;
  let cycleFailure: string | undefined;

  const publish = () => {
    // read here, not tracked in connectedCallback: not every build calls that wrapper
    const element: HTMLElement | undefined = getElement(component);
    if (element && !element.isConnected) return;

    const message = loadFailure ?? cycleFailure;
    if (rendering || pending > 0) {
      ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    } else if (message !== undefined) {
      ComponentRegister.updateStatus(uuid, ComponentStatus.ERROR, describeFailure(element, message));
    } else {
      ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL);
    }
  };

  const fail = (hook: string, e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    if (LOAD_HOOKS.includes(hook)) {
      loadFailure = message;
    } else {
      cycleFailure = message;
    }
    publish();
  };

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    if (!rendered) rendering = true;
    publish();
    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    ComponentRegister.remove(uuid);
    runIfExisits(disconnectedCallback, component);
  };

  for (const hook of [...LOAD_HOOKS, ...CYCLE_HOOKS]) {
    const original = component[hook];
    component[hook] = (...args: unknown[]) => {
      if (hook === "componentWillUpdate") cycleFailure = undefined;
      if (START_HOOKS.includes(hook)) {
        rendering = true;
        publish();
      }
      try {
        const result = typeof original === "function" ? original.apply(component, args) : undefined;
        if (typeof result?.then === "function") {
          // an async hook: Stencil waits for the returned promise, so the failure must stay in it
          return result.then(
            (value: unknown) => value,
            (e: unknown) => {
              fail(hook, e);
              throw e;
            },
          );
        }
        return result;
      } catch (e) {
        fail(hook, e);
        // Stencil logs it and goes on with the next hook
        throw e;
      } finally {
        if (hook === "componentDidRender") {
          rendered = true;
          rendering = false;
          publish();
        }
      }
    };
  }

  return (work: Promise<unknown>) => {
    pending++;
    publish();
    const done = () => {
      pending--;
      publish();
    };
    work.then(done, done);
  };
};

export default withComponentStatus;
