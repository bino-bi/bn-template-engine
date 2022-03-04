export enum ComponentStatus {
  RUNNING,
  SUCCESSFUL,
  ERROR
}
export namespace ComponentRegister {
  var currentTimeOutId: NodeJS.Timeout = undefined;
  let componentRegister = new Map<string, ComponentStatus>();
  let statusIntervall = setInterval(() => {
    console.log("Component status rdy: " + componentRegisterIsRendered())
  }, 100)


  export const updateStatus = (uuid: string, status: ComponentStatus) => {
    if (currentTimeOutId) {
      clearTimeout(currentTimeOutId);
    }
    componentRegister.set(uuid, status);
    currentTimeOutId = setTimeout(() => {
      // @ts-ignore
      window.componentRegisterIsRenderedResult = componentRegisterIsRendered()
      // @ts-ignore
      console.log("componentRegisterIsRendered:", window.componentRegisterIsRenderedResult)
      clearInterval(statusIntervall);
    }, 500);
  }

  export const componentRegisterIsRendered = () => {
    return componentRegisterStatus().running == 0;
  }

  export const componentRegisterStatus = () => {

    let result = {
      successful: 0,
      running: 0,
      error: 0
    }

    componentRegister.forEach((value: ComponentStatus, key: string) => {
      switch (value) {
        case ComponentStatus.RUNNING: {
          result.running++;
          break;
        }
        case ComponentStatus.SUCCESSFUL: {
          result.successful++;
          break;
        }
        default: {
          result.error++;
          console.log("Component failed ", key)
          break;
        }
      }

    });

    return result;
  }

}

