import {runIfExisits} from "./utils";

const withComponentStatus = (component: any) => {
  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    // TODO: code
    runIfExisits(connectedCallback);
  }

  const componentDidRender = component['componentDidRender'];
  component['componentDidRender'] = () => {
    // TODO: code
    runIfExisits(componentDidRender);
  }
};

export default withComponentStatus;
