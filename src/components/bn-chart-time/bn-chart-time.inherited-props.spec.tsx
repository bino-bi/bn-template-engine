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

interface Diagnostic {
  id?: string;
  type: string;
  message: string;
}

/** Diagnostics from the host's `has-error` attribute (removed when empty). */
const diagnostics = (page: SpecPage): Diagnostic[] => JSON.parse(page.root.getAttribute("has-error") ?? "[]");
const diagnosticIds = (page: SpecPage): string[] => diagnostics(page).map((item) => item.id);

/** Gives the chart a dataset to auto-detect scenarios and order from. */
const withDatasetMeta = async (page: SpecPage): Promise<SpecPage> => {
  page.rootInstance.datasetMeta = {
    availableScenarios: ["ac1", "pp1"],
    suggestedLevel: "category",
    suggestedOrder: "category",
  };
  await page.waitForChanges();
  return page;
};

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

describe("bn-chart-time: an inherited keyword that cannot be resolved", () => {
  const KEYWORDS = `scenarios="inherited-page" variances="inherited-page" order="inherited-page" order-direction="inherited-page"`;

  describe.each([
    ["without a layout ancestor", (inner: string) => inner],
    ["in a page that does not set the field", (inner: string) => `<bn-layout-page>${inner}</bn-layout-page>`],
  ])("%s", (_name, wrap) => {
    it("auto-detects scenarios, shows no variances and warns once per prop", async () => {
      const page = await withDatasetMeta(await mount(wrap(chart(KEYWORDS))));

      expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
      expect(page.rootInstance.prepareVariances()).toEqual([]);
      expect(diagnostics(page)).toContainEqual({
        id: "WARN_inherited_scenarios",
        type: "warning",
        message: "scenarios: 'inherited-page' could not be resolved, no surrounding page sets titleScenarios",
      });
      expect(diagnosticIds(page)).toEqual(
        expect.arrayContaining(["WARN_inherited_variances", "WARN_inherited_order", "WARN_inherited_orderDirection"]),
      );
      expect(diagnosticIds(page)).not.toContain("AUTO_scenarios");
      expect(diagnosticIds(page)).not.toContain("AUTO_order");
    });

    it("renders like a chart without these attributes", async () => {
      const keywords = await withDatasetMeta(await mount(wrap(chart(KEYWORDS))));
      const scenarios = keywords.rootInstance.prepareScenarios();
      const variances = keywords.rootInstance.prepareVariances();
      const order = keywords.rootInstance.prepareOrder();

      const blank = await withDatasetMeta(await mount(wrap(chart(""))));

      expect(scenarios).toEqual(blank.rootInstance.prepareScenarios());
      expect(variances).toEqual(blank.rootInstance.prepareVariances());
      expect(order).toEqual(blank.rootInstance.prepareOrder());
      expect(diagnosticIds(blank)).toEqual(expect.arrayContaining(["AUTO_scenarios", "AUTO_order"]));
    });
  });

  it("never uses the literal keyword of a card as a scenario", async () => {
    const page = await withDatasetMeta(
      await mount(
        `<bn-layout-page><bn-layout-card title-scenarios="inherited-page">${chart(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
      ),
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
    expect(diagnostics(page)).toContainEqual({
      id: "WARN_inherited_scenarios",
      type: "warning",
      message: "scenarios: 'inherited-closest' could not be resolved, no surrounding card or page sets titleScenarios",
    });
  });

  it("does not warn when the keyword resolves", async () => {
    const page = await withDatasetMeta(
      await mount(
        `<bn-layout-page title-scenarios="fc1" title-variances="dfc1_ac1_pos" title-order="fc1" title-order-direction="desc">${chart(KEYWORDS)}</bn-layout-page>`,
      ),
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(page.rootInstance.prepareVariances()).toEqual(["dfc1_ac1_pos"]);
    expect(page.rootInstance.prepareOrder().direction).toBe(OrderDirection.DESC);
    expect(diagnosticIds(page).filter((id) => id.startsWith("WARN_inherited_"))).toEqual([]);
    expect(diagnosticIds(page)).not.toContain("AUTO_scenarios");
    expect(diagnosticIds(page)).not.toContain("AUTO_order");
  });

  it("drops the warning once the page sets the field", async () => {
    const page = await withDatasetMeta(
      await mount(`<bn-layout-page>${chart(`scenarios="inherited-page"`)}</bn-layout-page>`),
    );
    expect(diagnosticIds(page)).toContain("WARN_inherited_scenarios");

    await setLater(page, "bn-layout-page", "title-scenarios", "fc1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(diagnosticIds(page)).not.toContain("WARN_inherited_scenarios");
  });
});
