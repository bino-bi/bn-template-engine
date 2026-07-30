// bn-scaling-group lifecycle: value grammar validation, numeric-name
// rejection, duplicate-name warning, and store cleanup on disconnect.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");

  const mockStores = {
    scalingGroups: createStore({}),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { ScalingGroup } from "./bn-scaling-group";

type MockStore = { state: Record<string, number | undefined>; reset: () => void };

const groupState = (): Record<string, number | undefined> => {
  return (getStores(null as never) as unknown as { scalingGroups: MockStore }).scalingGroups.state;
};

const hasError = (el: Element, id: string): boolean => (el.getAttribute("has-error") ?? "").includes(id);

beforeEach(() => {
  (getStores(null as never) as unknown as { scalingGroups: MockStore }).scalingGroups.reset();
});

describe("bn-scaling-group value parsing", () => {
  it("parses SI-suffixed values into the store", async () => {
    await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="revenue" value="1M"></bn-scaling-group>`,
    });

    expect(groupState()["revenue"]).toBe(1e6);
  });

  it("accepts plain positive numbers", async () => {
    await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="revenue" value="2.5"></bn-scaling-group>`,
    });

    expect(groupState()["revenue"]).toBe(2.5);
  });

  it.each(["0", "-5", "banana", "auto", ""])(
    "rejects invalid value %j with ERR_invalid_value and no write",
    async (value) => {
      const page = await newSpecPage({
        components: [ScalingGroup],
        html: `<bn-scaling-group name="revenue" value="${value}"></bn-scaling-group>`,
      });

      expect(groupState()["revenue"]).toBeUndefined();
      expect(hasError(page.root!, "ERR_invalid_value")).toBe(true);
    },
  );
});

describe("bn-scaling-group name validation", () => {
  it("rejects the reserved name auto", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="auto" value="5"></bn-scaling-group>`,
    });

    expect(groupState()["auto"]).toBeUndefined();
    expect(hasError(page.root!, "ERR_reserved_name")).toBe(true);
  });

  it.each(["1M", "250"])("rejects name %j that parses as a scaling value", async (name) => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="${name}" value="5"></bn-scaling-group>`,
    });

    expect(groupState()[name]).toBeUndefined();
    expect(hasError(page.root!, "ERR_numeric_name")).toBe(true);
  });
});

describe("bn-scaling-group duplicate names", () => {
  it("warns when overwriting another element's different value (last writer wins)", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `
        <div>
          <bn-scaling-group id="first" name="shared" value="5"></bn-scaling-group>
          <bn-scaling-group id="second" name="shared" value="8"></bn-scaling-group>
        </div>
      `,
    });

    expect(groupState()["shared"]).toBe(8);
    expect(hasError(page.body.querySelector("#second")!, "WARN_duplicate_group")).toBe(true);
    expect(hasError(page.body.querySelector("#first")!, "WARN_duplicate_group")).toBe(false);
  });

  it("stays silent when the duplicate carries the same value", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `
        <div>
          <bn-scaling-group id="first" name="shared" value="5"></bn-scaling-group>
          <bn-scaling-group id="second" name="shared" value="5"></bn-scaling-group>
        </div>
      `,
    });

    expect(groupState()["shared"]).toBe(5);
    expect(hasError(page.body.querySelector("#second")!, "WARN_duplicate_group")).toBe(false);
  });
});

describe("bn-scaling-group lifecycle", () => {
  it("removes its entry from the store on disconnect", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>`,
    });

    expect(groupState()["revenue"]).toBe(250000);

    page.root!.remove();
    await page.waitForChanges();

    expect(groupState()["revenue"]).toBeUndefined();
  });

  it("leaves the entry alone on disconnect when another element overwrote it", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `
        <div>
          <bn-scaling-group id="first" name="shared" value="5"></bn-scaling-group>
          <bn-scaling-group id="second" name="shared" value="8"></bn-scaling-group>
        </div>
      `,
    });

    page.body.querySelector("#first")!.remove();
    await page.waitForChanges();

    expect(groupState()["shared"]).toBe(8);
  });

  it("moves the entry when the name changes", async () => {
    const page = await newSpecPage({
      components: [ScalingGroup],
      html: `<bn-scaling-group name="old-name" value="5"></bn-scaling-group>`,
    });

    expect(groupState()["old-name"]).toBe(5);

    (page.root as HTMLElement & { name: string }).name = "new-name";
    await page.waitForChanges();

    expect(groupState()["old-name"]).toBeUndefined();
    expect(groupState()["new-name"]).toBe(5);
  });
});
