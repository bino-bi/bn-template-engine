export enum ComponentStatus {
  RUNNING,
  SUCCESSFUL,
  ERROR
}
export namespace ComponentRegister {
  let componentRegister = new Map<string, ComponentStatus>();

  export const updateStatus = (uuid: string, status: ComponentStatus) => {
    componentRegister.set(uuid, status);
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
          console.log("Component failed ",key)
          break;
        }
      }

    });

    return result;
  }

}

