import {runIfExisits} from "./utils";

const withComponentStatus = (component: any) => {
  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    // TODO: code
    runIfExisits(connectedCallback);
  }

  const componentWillRender = component['componentWillRender'];
  component['componentWillRender'] = () => {
    // TODO: code
    runIfExisits(componentWillRender);
  }

  const componentDidRender = component['componentDidRender'];
  component['componentDidRender'] = () => {
    // TODO: code
    runIfExisits(componentDidRender);
  }




};

export default withComponentStatus;
