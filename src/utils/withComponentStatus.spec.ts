import { ComponentRegister } from "./componentRegister";
import withComponentStatus from "./withComponentStatus";

type Hooks = Record<string, (...args: unknown[]) => unknown>;

const status = () => ComponentRegister.componentRegisterStatus();
const running = () => status().running;

// The register is shared by all tests of this file: every test compares against its own baseline and leaves no entry behind.
const tracked: Hooks[] = [];
const track = (component: Hooks = {}): Hooks => {
  withComponentStatus(component);
  tracked.push(component);
  return component;
};

// Registered inside each describe: such a hook runs before the test window is torn down, so the timer it starts is cleared.
const cleanUp = () => tracked.splice(0).forEach((component) => component.disconnectedCallback());

/** One render cycle the way Stencil runs it: an exception is caught and the next hook is called. */
const cycle = (component: Hooks, first: boolean) => {
  const hooks = first
    ? ["componentWillLoad", "componentWillRender", "render", "componentDidRender", "componentDidLoad"]
    : ["componentWillUpdate", "componentWillRender", "render", "componentDidRender", "componentDidUpdate"];
  for (const hook of hooks) {
    try {
      component[hook]();
    } catch {
      // Stencil logs it and goes on
    }
  }
};

describe("withComponentStatus hold", () => {
  it("releases after the work has failed", async () => {
    const before = running();
    const hold = withComponentStatus({});

    hold(Promise.reject(new Error("x")));
    expect(running()).toBe(before + 1);

    await Promise.resolve();
    expect(running()).toBe(before);
  });
});

describe("withComponentStatus lifecycle", () => {
  afterEach(cleanUp);

  it("does not count a rendered component as rendering when it is attached again", () => {
    const before = running();
    const component = track();

    component.connectedCallback();
    expect(running()).toBe(before + 1);
    component.componentDidRender();
    expect(running()).toBe(before);

    // Stencil does not render again on a re-attach, so nothing would report SUCCESSFUL
    component.connectedCallback();
    expect(running()).toBe(before);

    component.componentWillRender();
    expect(running()).toBe(before + 1);
    component.componentDidRender();
    expect(running()).toBe(before);
  });

  it("is running from the first hook of an update, not only from componentWillRender", () => {
    const before = running();
    const component = track();
    cycle(component, true);
    expect(running()).toBe(before);

    component.componentWillUpdate();
    expect(running()).toBe(before + 1);
  });

  it("hands the return value of a hook on", async () => {
    const vnode = { tag: "div" };
    const component = track({ render: () => vnode, componentWillLoad: () => Promise.resolve("loaded") });

    expect(component.render()).toBe(vnode);
    await expect(component.componentWillLoad()).resolves.toBe("loaded");
  });

  it("forgets a component that left the document and takes it back on a re-attach", () => {
    const before = status();
    const component = track();
    cycle(component, true);
    expect(status().successful).toBe(before.successful + 1);

    component.disconnectedCallback();
    expect(status()).toEqual(before);

    component.connectedCallback();
    expect(status().successful).toBe(before.successful + 1);
  });
});

describe("withComponentStatus failures", () => {
  afterEach(cleanUp);

  const boom = () => {
    throw new Error("boom");
  };

  it("reports a component whose render throws as failed", () => {
    const before = status();
    const component = track({ render: boom });

    cycle(component, true);

    expect(status().error).toBe(before.error + 1);
    expect(status().successful).toBe(before.successful);
    expect(ComponentRegister.componentRegisterIsRendered()).toBe(false);
    expect(ComponentRegister.componentRegisterFailures()).toEqual([{ tag: "", id: "", message: "boom" }]);
  });

  it("rethrows, so Stencil still sees the exception", () => {
    const component = track({ render: boom });
    expect(() => component.render()).toThrow("boom");
  });

  it.each(["componentWillRender", "componentDidRender", "componentDidUpdate"])(
    "clears a failure of %s when the next cycle works",
    (hook) => {
      const before = status();
      let broken = true;
      const component = track({
        [hook]: () => {
          if (broken) boom();
        },
      });

      cycle(component, true);
      cycle(component, false);
      expect(status().error).toBe(before.error + 1);

      broken = false;
      cycle(component, false);
      expect(status().error).toBe(before.error);
      expect(status().successful).toBe(before.successful + 1);
    },
  );

  it.each(["componentWillLoad", "componentDidLoad"])("keeps a failure of %s, which runs only once", (hook) => {
    const before = status();
    const component = track({ [hook]: boom });

    cycle(component, true);
    cycle(component, false);

    expect(status().error).toBe(before.error + 1);
    expect(ComponentRegister.componentRegisterFailures()).toEqual([{ tag: "", id: "", message: "boom" }]);
  });

  it("records the rejection of an async hook and keeps it rejected", async () => {
    const before = status();
    const component = track({ componentWillLoad: () => Promise.reject(new Error("late")) });

    await expect(component.componentWillLoad()).rejects.toThrow("late");
    component.componentDidRender();

    expect(status().error).toBe(before.error + 1);
    expect(ComponentRegister.componentRegisterFailures()[0].message).toBe("late");
  });

  it("reports a throw in the connectedCallback of a mixin that was applied later", () => {
    const before = status();
    const component = track();
    // a later mixin wraps what it finds, the way withDataset or withBodyObserver do
    const inner = component.connectedCallback;
    let outside = true;
    component.connectedCallback = () => {
      if (outside) throw new Error("must be inside a bn-context");
      inner();
    };

    expect(() => component.connectedCallback()).toThrow("must be inside a bn-context");
    cycle(component, true);
    expect(status().error).toBe(before.error + 1);
    expect(ComponentRegister.componentRegisterFailures()[0].message).toBe("must be inside a bn-context");

    // attached again in a place where it works
    outside = false;
    component.disconnectedCallback();
    component.connectedCallback();
    expect(status().error).toBe(before.error);
    expect(status().successful).toBe(before.successful + 1);
  });

  it("is still failed after a re-attach", () => {
    const before = status();
    const component = track({ render: boom });
    cycle(component, true);

    component.disconnectedCallback();
    expect(status().error).toBe(before.error);
    expect(ComponentRegister.componentRegisterIsRendered()).toBe(true);

    component.connectedCallback();
    expect(status().error).toBe(before.error + 1);
  });

  it("lists no failure while another component is still running", () => {
    const failed = track({ render: boom });
    cycle(failed, true);
    const busy = track();

    busy.connectedCallback();
    expect(ComponentRegister.componentRegisterFailures()).toEqual([]);
    expect(ComponentRegister.componentRegisterIsRendered()).toBe(false);

    busy.componentDidRender();
    expect(ComponentRegister.componentRegisterFailures()).toHaveLength(1);
  });
});

describe("ComponentRegister publishing", () => {
  afterEach(cleanUp);

  const quietPeriod = () => new Promise((resolve) => setTimeout(resolve, 600));
  const published = () =>
    window as unknown as { componentRegisterIsRenderedResult: boolean; componentRegisterFailures: unknown[] };

  it("publishes true and no failures when every component rendered", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    cycle(track(), true);

    await quietPeriod();

    expect(published().componentRegisterIsRenderedResult).toBe(true);
    expect(published().componentRegisterFailures).toEqual([]);
    expect(log).toHaveBeenCalledWith("componentRegisterIsRendered:", true);
    log.mockRestore();
  });

  it("publishes false and the failures when a component threw", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    cycle(
      track({
        render: () => {
          throw new Error("boom");
        },
      }),
      true,
    );

    await quietPeriod();

    expect(published().componentRegisterIsRenderedResult).toBe(false);
    expect(published().componentRegisterFailures).toEqual([{ tag: "", id: "", message: "boom" }]);
    // same name and format as before: readers match on this line
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("componentRegisterIsRendered:", false);
    log.mockRestore();
  });

  it("waits for fonts that are still loading, then for a new quiet period", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    let fontsLoaded: () => void = () => {};
    const fonts = { status: "loading", ready: new Promise<void>((resolve) => (fontsLoaded = resolve)) };
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });

    cycle(track(), true);
    await quietPeriod();
    expect(log).not.toHaveBeenCalled();

    fonts.status = "loaded";
    fontsLoaded();
    await quietPeriod();
    expect(log).toHaveBeenCalledWith("componentRegisterIsRendered:", true);

    // @ts-ignore - only set for this test
    delete document.fonts;
    log.mockRestore();
  });
});
