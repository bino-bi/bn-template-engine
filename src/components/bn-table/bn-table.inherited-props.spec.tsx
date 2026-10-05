// bn-table prop inheritance: "inherited-closest" / "inherited-page" on
// scenarios, variances, order, orderDirection and ruleset.
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
    findContextElement: () => undefined,
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { SYSTEM_RULESET_DEFAULTS } from "../../stores/ruleSets";
import { OrderColumn } from "../../utils/model/Order";
import { Table } from "./bn-table";

const table = (attrs: string) => `<bn-table dataset="ds" ${attrs}></bn-table>`;

const mount = (html: string): Promise<SpecPage> => newSpecPage({ components: [Table], html });

/** Sets an attribute on a layout ancestor the way a browser would report it. */
const setLater = async (page: SpecPage, selector: string, attr: string, value: string) => {
  const ancestor = page.body.querySelector(selector);
  ancestor.setAttribute(attr, value);
  notifyAttributeChange(ancestor, attr);
  await page.waitForChanges();
};

describe("bn-table: inherited-closest takes the nearest ancestor that sets the value", () => {
  it("takes scenarios from the page when the card does not set them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
  });

  it("takes scenarios from the card when the card sets them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="ac1">${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
  });

  it("takes scenarios from the outer of two nested cards when only that one sets them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="fc1"><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
  });

  it("resolves scenarios from the card and order from the page in one component", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1" title-order="ac1"><bn-layout-card title-scenarios="ac1" title-order="pp1">${table(`scenarios="inherited-closest" order="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
    expect(page.rootInstance.prepareOrder().hierarchy).toEqual([OrderColumn.AC1]);
  });

  it("still takes scenarios from the page for inherited-page", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="ac1">${table(`scenarios="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
  });

  it("picks up title-scenarios that the page gets after connect", async () => {
    const page = await mount(
      `<bn-layout-page><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    await setLater(page, "bn-layout-page", "title-scenarios", "ac1,pp1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
  });

  it("prefers title-scenarios that a nearer card gets after connect", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    await setLater(page, "bn-layout-card", "title-scenarios", "fc1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
  });
});

describe("bn-table: ruleset inheritance", () => {
  const SYSTEM_AC = SYSTEM_RULESET_DEFAULTS.scenarios.ac.sortIndex;

  const sortIndex = (page: SpecPage, scenario: string): number =>
    page.rootInstance.ruleSetConfig().scenarios[scenario].sortIndex;

  beforeAll(() => {
    const ruleSets = getStores(null).ruleSets.state;
    ruleSets["_default"] = { scenarios: { pp: { sortIndex: 5 } } };
    ruleSets["page-rules"] = { scenarios: { ac: { sortIndex: 1 } } };
    ruleSets["card-rules"] = { scenarios: { ac: { sortIndex: 2 } } };
    // The keywords are not rule set names: these two must never be applied.
    ruleSets["inherited-page"] = { scenarios: { ac: { sortIndex: 8 } } };
    ruleSets["inherited-closest"] = { scenarios: { ac: { sortIndex: 9 } } };
  });

  it("applies the page's rule set when the card has none", async () => {
    const page = await mount(
      `<bn-layout-page ruleset="page-rules"><bn-layout-card>${table(`ruleset="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(sortIndex(page, "ac")).toBe(1);
  });

  it("applies the card's rule set when the card has one", async () => {
    const page = await mount(
      `<bn-layout-page ruleset="page-rules"><bn-layout-card ruleset="card-rules">${table(`ruleset="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(sortIndex(page, "ac")).toBe(2);
  });

  it("still applies the page's rule set for inherited-page", async () => {
    const page = await mount(
      `<bn-layout-page ruleset="page-rules"><bn-layout-card ruleset="card-rules">${table(`ruleset="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(sortIndex(page, "ac")).toBe(1);
  });

  it("applies only _system and _default when the card's own keyword is unresolved", async () => {
    const page = await mount(
      `<bn-layout-page><bn-layout-card ruleset="inherited-page">${table(`ruleset="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(sortIndex(page, "ac")).toBe(SYSTEM_AC);
    expect(sortIndex(page, "pp")).toBe(5);
  });

  it("picks up a ruleset that the page gets after connect", async () => {
    const page = await mount(
      `<bn-layout-page><bn-layout-card>${table(`ruleset="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );
    expect(sortIndex(page, "ac")).toBe(SYSTEM_AC);

    await setLater(page, "bn-layout-page", "ruleset", "page-rules");

    expect(sortIndex(page, "ac")).toBe(1);
  });
});
