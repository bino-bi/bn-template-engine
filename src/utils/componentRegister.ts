/** Lifecycle state of a tracked component instance. */
export enum ComponentStatus {
  RUNNING,
  SUCCESSFUL,
  ERROR,
}

/**
 * Singleton registry that tracks the render status of all bn-* component instances.
 *
 * Each component registers itself via {@link withComponentStatus} and reports
 * `RUNNING` / `SUCCESSFUL` / `ERROR` transitions. After 500 ms of inactivity
 * (no status updates), the aggregate result is written to
 * `window.componentRegisterIsRenderedResult` as a boolean. External tools
 * (e.g. headless screenshot renderers) poll this value to detect when
 * the entire page has finished rendering.
 *
 * The 500 ms debounce prevents premature "rendered" signals during rapid
 * successive re-renders.
 */
export namespace ComponentRegister {
  var currentTimeOutId: NodeJS.Timeout = undefined;
  const componentRegister = new Map<string, ComponentStatus>();
  const statusIntervall = setInterval(() => {
    console.log("Component status rdy: " + componentRegisterIsRendered());
  }, 100);

  /**
   * Records a status change for the component identified by `uuid` and
   * resets the 500 ms debounce timer. When the timer fires, the aggregate
   * "all rendered" boolean is published to `window.componentRegisterIsRenderedResult`.
   */
  // TODO: improve that make it faster Sven
  export const updateStatus = (uuid: string, status: ComponentStatus) => {
    if (currentTimeOutId) {
      clearTimeout(currentTimeOutId);
    }
    componentRegister.set(uuid, status);
    currentTimeOutId = setTimeout(() => {
      // @ts-ignore
      window.componentRegisterIsRenderedResult = componentRegisterIsRendered();
      // @ts-ignore
      console.log("componentRegisterIsRendered:", window.componentRegisterIsRenderedResult);
      clearInterval(statusIntervall);
    }, 500);
  };

  /** Returns `true` when no components are currently in `RUNNING` state. */
  export const componentRegisterIsRendered = () => {
    return componentRegisterStatus().running == 0;
  };

  /** Returns a summary count of components in each status category. */
  export const componentRegisterStatus = () => {
    const result = {
      successful: 0,
      running: 0,
      error: 0,
    };

    componentRegister.forEach((value: ComponentStatus) => {
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
          break;
        }
      }
    });

    return result;
  };
}
