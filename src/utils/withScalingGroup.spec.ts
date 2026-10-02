// jest.mock calls must physically precede the imports - Stencil's jest
// transform does not hoist them (same pattern as ibcs-table.spec.tsx).

type StoreCallback = (key: string, newValue: number | undefined) => void;

const storeCallbacks: StoreCallback[] = [];
const scalingGroupsState: Record<string, number | undefined> = {};

jest.mock("@stencil/core", () => ({
  ...jest.requireActual("@stencil/core"),
  forceUpdate: jest.fn(),
  getElement: jest.fn(() => ({})),
}));

jest.mock("../context/context-protocol", () => ({
  getStores: () => ({
    scalingGroups: {
      state: scalingGroupsState,
      on: (_event: string, cb: StoreCallback) => {
        storeCallbacks.push(cb);
        return () => {};
      },
    },
  }),
  clearStoresCache: jest.fn(),
}));

import withScalingGroup from "./withScalingGroup";

const emit = (key: string, value: number | undefined) => {
  if (value === undefined) {
    delete scalingGroupsState[key];
  } else {
    scalingGroupsState[key] = value;
  }
  storeCallbacks.forEach((cb) => cb(key, value));
};

const makeComponent = (extra: Record<string, any> = {}) => {
  const component: any = {
    pixelPerUnitGroupMap: new Map<string, number>(),
    ...extra,
  };
  withScalingGroup(component);
  component.connectedCallback();
  return component;
};

describe("withScalingGroup", () => {
  beforeEach(() => {
    storeCallbacks.length = 0;
    for (const key of Object.keys(scalingGroupsState)) {
      delete scalingGroupsState[key];
    }
    scalingGroupsState.existing = 5;
  });

  it("syncs existing entries into pixelPerUnitGroupMap on connect", () => {
    const component = makeComponent();
    expect(component.pixelPerUnitGroupMap.get("existing")).toBe(5);
  });

  it("updates the map and revalidates on store changes", () => {
    const validateUnitScaling = jest.fn();
    const component = makeComponent({ validateUnitScaling, unitScaling: "grp" });

    emit("grp", 12);
    expect(component.pixelPerUnitGroupMap.get("grp")).toBe(12);
    expect(validateUnitScaling).toHaveBeenCalledWith("grp");
  });

  it("probes the validateSizeScaling hook when the component provides it (bubble charts)", () => {
    const validateSizeScaling = jest.fn();
    makeComponent({ validateSizeScaling });

    // Once on connect…
    expect(validateSizeScaling).toHaveBeenCalledTimes(1);

    // …and again on every store change.
    emit("netsales-area", 12);
    expect(validateSizeScaling).toHaveBeenCalledTimes(2);
    expect(validateSizeScaling).toHaveBeenCalledWith();
  });

  it("leaves components without the hook unaffected (backward compatible)", () => {
    const component = makeComponent();
    expect(() => emit("grp", 7)).not.toThrow();
    expect(component.pixelPerUnitGroupMap.get("grp")).toBe(7);
  });

  it("removes entries when a group value is unset", () => {
    const component = makeComponent();
    emit("existing", undefined);
    expect(component.pixelPerUnitGroupMap.has("existing")).toBe(false);
  });
});
