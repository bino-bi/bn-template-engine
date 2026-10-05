/** Lifecycle state of a tracked component instance. */
export enum ComponentStatus {
  RUNNING,
  SUCCESSFUL,
  ERROR,
}

/** A component that threw in `render` or in a lifecycle hook. */
export interface ComponentFailure {
  tag: string;
  id: string;
  message: string;
}

/**
 * Singleton registry that tracks the render status of all bn-* component instances.
 *
 * Each component registers itself via {@link withComponentStatus} and reports
 * `RUNNING` / `SUCCESSFUL` / `ERROR` transitions. After 500 ms of inactivity
 * (no status updates), the aggregate result is written to
 * `window.componentRegisterIsRenderedResult` as a boolean, and the failed
 * components to `window.componentRegisterFailures`. External tools
 * (e.g. headless screenshot renderers) poll these values to detect when
 * the entire page has finished rendering.
 *
 * A reader sees one of three states: the flag is `true` (all rendered), the
 * failures list is not empty (settled, but a component failed), or neither
 * (still working).
 *
 * The 500 ms debounce prevents premature "rendered" signals during rapid
 * successive re-renders.
 *
 * Status counts are maintained incrementally - `updateStatus` adjusts running
 * counters instead of iterating all entries, making it O(1) per update.
 */
export namespace ComponentRegister {
  let currentTimeOutId: number | undefined = undefined;
  const componentRegister = new Map<string, ComponentStatus>();
  const failures = new Map<string, ComponentFailure>();

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

  const publish = () => {
    // @ts-ignore
    window.componentRegisterFailures = componentRegisterFailures();
    // @ts-ignore
    window.componentRegisterIsRenderedResult = componentRegisterIsRendered();
    // @ts-ignore
    // eslint-disable-next-line no-console
    console.log("componentRegisterIsRendered:", window.componentRegisterIsRenderedResult);
  };

  /** Restarts the 500 ms quiet period that ends with the published result. */
  const schedule = () => {
    if (currentTimeOutId) {
      window.clearTimeout(currentTimeOutId);
    }

    // window.setTimeout, not the bare global: in spec tests this is the timer the test window clears when a test ends
    currentTimeOutId = window.setTimeout(() => {
      const fonts = document.fonts;
      if (fonts?.status === "loading") {
        // text is measured again once the fonts are there: wait for them, then for a new quiet period
        fonts.ready.then(schedule);
        return;
      }
      publish();
    }, 500);
  };

  /**
   * Records a status change for the component identified by `uuid` and
   * resets the 500 ms debounce timer. When the timer fires, the aggregate
   * "all rendered" boolean is published to `window.componentRegisterIsRenderedResult`.
   * `failure` describes an `ERROR` status.
   */
  export const updateStatus = (uuid: string, status: ComponentStatus, failure?: ComponentFailure) => {
    const prev = componentRegister.get(uuid);
    if (prev !== undefined) {
      statusCounts[countKey(prev)]--;
    }
    statusCounts[countKey(status)]++;
    componentRegister.set(uuid, status);
    if (status === ComponentStatus.ERROR && failure) {
      failures.set(uuid, failure);
    } else {
      failures.delete(uuid);
    }

    schedule();
  };

  /** Forgets a component that left the document. */
  export const remove = (uuid: string) => {
    const prev = componentRegister.get(uuid);
    if (prev === undefined) {
      return;
    }
    statusCounts[countKey(prev)]--;
    componentRegister.delete(uuid);
    failures.delete(uuid);

    schedule();
  };

  /** Returns `true` when no component is in `RUNNING` or `ERROR` state. */
  export const componentRegisterIsRendered = () => {
    return statusCounts.running === 0 && statusCounts.error === 0;
  };

  /** The failed components. Empty while a component is still running: only a settled page has a final list. */
  export const componentRegisterFailures = (): ComponentFailure[] => {
    return statusCounts.running === 0 ? [...failures.values()] : [];
  };

  /** Returns a summary count of components in each status category. */
  export const componentRegisterStatus = () => {
    return { ...statusCounts };
  };
}
