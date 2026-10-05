// The status mixin on real components: Stencil catches an exception of render()
// and still calls componentDidRender, so the mixin has to notice the throw itself.

import { Component, h, setErrorHandler } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { ComponentRegister } from "./componentRegister";
import withComponentStatus from "./withComponentStatus";

@Component({ tag: "test-throws" })
class Throws {
  constructor() {
    withComponentStatus(this);
  }

  render() {
    throw new Error("boom");
  }
}

@Component({ tag: "test-facade", shadow: true })
class Facade {
  constructor() {
    withComponentStatus(this);
  }

  render() {
    return <test-throws></test-throws>;
  }
}

const quietPeriod = () => new Promise((resolve) => setTimeout(resolve, 600));

describe("a component whose render throws", () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    // In a spec Stencil rethrows what a component threw. A browser only logs it.
    setErrorHandler(() => {});
    log = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
  });

  it("is published as a failure, and the flag is false", async () => {
    const before = ComponentRegister.componentRegisterStatus();

    await newSpecPage({ components: [Throws], html: `<test-throws id="t1"></test-throws>` });

    expect(ComponentRegister.componentRegisterStatus().error).toBe(before.error + 1);
    expect(ComponentRegister.componentRegisterStatus().successful).toBe(before.successful);

    await quietPeriod();
    const published = window as unknown as {
      componentRegisterIsRenderedResult: boolean;
      componentRegisterFailures: unknown;
    };
    expect(published.componentRegisterIsRenderedResult).toBe(false);
    expect(published.componentRegisterFailures).toEqual([{ tag: "test-throws", id: "t1", message: "boom" }]);
    expect(log).toHaveBeenCalledWith("componentRegisterIsRendered:", false);
  });

  it("names the component an inner renderer is drawn for", async () => {
    const page = await newSpecPage({ components: [Facade, Throws], html: `<test-facade id="chart-1"></test-facade>` });
    await page.waitForChanges();

    expect(ComponentRegister.componentRegisterFailures()).toContainEqual({
      tag: "test-throws",
      id: "chart-1",
      message: "boom",
    });
  });

  it("is forgotten when the element is removed", async () => {
    const page = await newSpecPage({ components: [Throws], html: `<test-throws></test-throws>` });
    const withFailure = ComponentRegister.componentRegisterStatus().error;

    page.root.remove();

    expect(ComponentRegister.componentRegisterStatus().error).toBe(withFailure - 1);
  });
});
