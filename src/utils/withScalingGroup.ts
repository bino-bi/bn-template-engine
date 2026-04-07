import { forceUpdate, getElement } from "@stencil/core";
import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { runIfExisits } from "./utils";

/**
 * Mixin that syncs the scoped `scalingGroups` store into a component's
 * `pixelPerUnitGroupMap` and triggers re-renders on changes.
 *
 * When a scaling group value is added or updated in the store (by a
 * `<bn-scaling-group>` element), this mixin updates the local map,
 * re-runs the component's scaling validators to clear/set error states,
 * and forces a re-render so `preparePixelPerUnit` / `preparePixelPerPercentage`
 * pick up the new value.
 *
 * @param component - Stencil component instance that has a `pixelPerUnitGroupMap` field
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withScalingGroup = (component: any) => {
  let subscription: () => void;
  let stores: ScopedStores;

  const syncAllEntries = () => {
    const state = stores.scalingGroups.state;
    for (const key of Object.keys(state)) {
      if (state[key] !== undefined) {
        component.pixelPerUnitGroupMap.set(key, state[key]);
      } else {
        component.pixelPerUnitGroupMap.delete(key);
      }
    }
  };

  const revalidate = () => {
    if (typeof component.validateUnitScaling === "function") {
      component.validateUnitScaling(component.unitScaling);
    }
    if (typeof component.validatePercentageScaling === "function") {
      component.validatePercentageScaling(component.percentageScaling);
    }
  };

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    // Initial sync of all existing scaling group entries
    syncAllEntries();
    revalidate();

    // Subscribe to future changes
    subscription = stores.scalingGroups.on("set", (key, newValue) => {
      if (newValue !== undefined) {
        component.pixelPerUnitGroupMap.set(key as string, newValue as number);
      } else {
        component.pixelPerUnitGroupMap.delete(key as string);
      }
      revalidate();
      forceUpdate(getElement(component));
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };
};

export default withScalingGroup;
