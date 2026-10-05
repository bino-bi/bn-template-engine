import { ComponentRegister } from "./componentRegister";
import withComponentStatus from "./withComponentStatus";

describe("withComponentStatus hold", () => {
  const running = () => ComponentRegister.componentRegisterStatus().running;

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
  const running = () => ComponentRegister.componentRegisterStatus().running;

  it("does not count a rendered component as rendering when it is attached again", () => {
    const before = running();
    const component: Record<string, () => void> = {};
    withComponentStatus(component);

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
});
