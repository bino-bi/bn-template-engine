import { generateUUID, runIfExisits } from "./utils";
import { ComponentRegister, ComponentStatus } from "./componentRegister";

/**
 * Mixin that tracks a component's render lifecycle in the global {@link ComponentRegister}.
 *
 * Assigns a stable UUID to the component instance and reports status transitions:
 * - `RUNNING` on `connectedCallback` and `componentWillRender`
 * - `SUCCESSFUL` on `componentDidRender`
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
  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    runIfExisits(connectedCallback, component);
  };

  const componentWillRender = component["componentWillRender"];
  component["componentWillRender"] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING);
    runIfExisits(componentWillRender, component);
  };

  const componentDidRender = component["componentDidRender"];
  component["componentDidRender"] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL);
    runIfExisits(componentDidRender, component);
  };
};

export default withComponentStatus;
