import { generateUUID, runIfExisits } from "./utils";
import { ComponentRegister, ComponentStatus } from "./componentRegister";

/**
 * Mixin that tracks a component's render lifecycle in the global {@link ComponentRegister}.
 *
 * Assigns a stable UUID to the component instance and reports status transitions:
 * - `RUNNING` on `connectedCallback` (only before the first render: a re-attach does not render again) and `componentWillRender`
 * - `SUCCESSFUL` on `componentDidRender`
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
  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    if (!rendered) ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    runIfExisits(connectedCallback, component);
  };

  const componentWillRender = component["componentWillRender"];
  component["componentWillRender"] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    runIfExisits(componentWillRender, component);
  };

  const componentDidRender = component["componentDidRender"];
  component["componentDidRender"] = () => {
    rendered = true;
    if (pending === 0) ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL);
    runIfExisits(componentDidRender, component);
  };

  return (work: Promise<unknown>) => {
    pending++;
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    const done = () => {
      if (--pending === 0) ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL);
    };
    work.then(done, done);
  };
};

export default withComponentStatus;
