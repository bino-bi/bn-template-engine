// bn-chart-time prop inheritance: "inherited-closest" / "inherited-page" on
// scenarios, variances, order and orderDirection.
//
// The layout ancestors are plain elements here: the lookup only reads tag
// names and attributes.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

// Its debounced status log would outlive a small spec run.
jest.mock("../../utils/withComponentStatus", () => ({ __esModule: true, default: () => {} }));

// Installed before the component import: a module behind it creates an
// observer while it loads.
import { installMutationObserverFake, notifyAttributeChange } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { SYSTEM_RULESET_DEFAULTS } = require("../../stores/ruleSets");
  const { createScopedDb } = require("../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
    scalingGroups: createStore({}),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { OrderDirection } from "../../utils/model/Order";
import { Chart } from "./bn-chart-time";

// scale="none": mock-doc has no layout, so auto-scale would resolve to NaN.
const chart = (attrs: string) => `<bn-chart-time scale="none" ${attrs}></bn-chart-time>`;

const mount = (html: string): Promise<SpecPage> => newSpecPage({ components: [Chart], html });

/** Sets an attribute on a layout ancestor the way a browser would report it. */
const setLater = async (page: SpecPage, selector: string, attr: string, value: string) => {
  const ancestor = page.body.querySelector(selector);
  ancestor.setAttribute(attr, value);
  notifyAttributeChange(ancestor, attr);
  await page.waitForChanges();
};

describe("bn-chart-time: inherited-closest takes the nearest ancestor that sets the value", () => {
  it("takes scenarios and variances from the page when the card does not set them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1" title-variances="dpp1_ac1_pos"><bn-layout-card>${chart(`scenarios="inherited-closest" variances="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
    expect(page.rootInstance.prepareVariances()).toEqual(["dpp1_ac1_pos"]);
  });

  it("takes scenarios from the card when the card sets them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="ac1">${chart(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
  });

  it("resolves scenarios from the card and the order direction from the page in one component", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1" title-order-direction="desc"><bn-layout-card title-scenarios="ac1" title-order-direction="asc">${chart(`scenarios="inherited-closest" order-direction="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
    expect(page.rootInstance.prepareOrder().direction).toBe(OrderDirection.DESC);
  });

  it("picks up title-scenarios that the page gets after connect", async () => {
    const page = await mount(
      `<bn-layout-page><bn-layout-card>${chart(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    await setLater(page, "bn-layout-page", "title-scenarios", "ac1,pp1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
  });
});
