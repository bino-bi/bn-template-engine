import { generateUUID, runIfExisits } from "./utils";
import { ComponentRegister } from "./componentRegister";
import { ComponentStatus } from "@bino-bi/ibcs-component-interface";

const withComponentStatus = (component: any) => {
  let uuid: string = generateUUID();
  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING)
    runIfExisits(connectedCallback, component);
  }

  const componentWillRender = component['componentWillRender'];
  component['componentWillRender'] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING)
    runIfExisits(componentWillRender, component);
  }

  const componentDidRender = component['componentDidRender'];
  component['componentDidRender'] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL)
    runIfExisits(componentDidRender, component);
  }
};

export default withComponentStatus;
