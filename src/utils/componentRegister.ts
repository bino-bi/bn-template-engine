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
 *
 * Status counts are maintained incrementally - `updateStatus` adjusts running
 * counters instead of iterating all entries, making it O(1) per update.
 */
export namespace ComponentRegister {
  let currentTimeOutId: NodeJS.Timeout = undefined;
  const componentRegister = new Map<string, ComponentStatus>();

  const statusCounts = { running: 0, successful: 0, error: 0 };

  const countKey = (status: ComponentStatus): keyof typeof statusCounts => {
    switch (status) {
      case ComponentStatus.RUNNING:
        return "running";
      case ComponentStatus.SUCCESSFUL:
        return "successful";
      default:
        return "error";
    }
  };

  /**
   * Records a status change for the component identified by `uuid` and
   * resets the 500 ms debounce timer. When the timer fires, the aggregate
   * "all rendered" boolean is published to `window.componentRegisterIsRenderedResult`.
   */
  export const updateStatus = (uuid: string, status: ComponentStatus) => {
    if (currentTimeOutId) {
      clearTimeout(currentTimeOutId);
    }

    const prev = componentRegister.get(uuid);
    if (prev !== undefined) {
      statusCounts[countKey(prev)]--;
    }
    statusCounts[countKey(status)]++;
    componentRegister.set(uuid, status);

    currentTimeOutId = setTimeout(() => {
      // @ts-ignore
      window.componentRegisterIsRenderedResult = componentRegisterIsRendered();
      // @ts-ignore
      // eslint-disable-next-line no-console
      console.log("componentRegisterIsRendered:", window.componentRegisterIsRenderedResult);
    }, 500);
  };

  /** Returns `true` when no components are currently in `RUNNING` state. */
  export const componentRegisterIsRendered = () => {
    return statusCounts.running === 0;
  };

  /** Returns a summary count of components in each status category. */
  export const componentRegisterStatus = () => {
    return { ...statusCounts };
  };
}
