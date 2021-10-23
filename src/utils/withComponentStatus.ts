import {generateUUID, runIfExisits} from "./utils";
import {ComponentRegister, ComponentStatus} from "./componentRegister";

const withComponentStatus = (component: any) => {
  let uuid: string = generateUUID();

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING)
    runIfExisits(connectedCallback);
  }

  const componentWillRender = component['componentWillRender'];
  component['componentWillRender'] = () => {
    ComponentRegister.updateStatus(uuid, ComponentStatus.RUNNING)
    runIfExisits(componentWillRender);
  }

  const componentDidRender = component['componentDidRender'];
  component['componentDidRender'] = () => {

    ComponentRegister.updateStatus(uuid, ComponentStatus.SUCCESSFUL)
    runIfExisits(componentDidRender);

  }

};

export default withComponentStatus;
