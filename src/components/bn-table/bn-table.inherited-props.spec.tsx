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
import { OrderColumn, OrderDirection } from "../../utils/model/Order";
import { Table } from "./bn-table";

const table = (attrs: string) => `<bn-table dataset="ds" ${attrs}></bn-table>`;

const mount = (html: string): Promise<SpecPage> => newSpecPage({ components: [Table], html });

interface Diagnostic {
  id?: string;
  type: string;
  message: string;
}

/** Diagnostics from the host's `has-error` attribute (removed when empty). */
const diagnostics = (page: SpecPage): Diagnostic[] => JSON.parse(page.root.getAttribute("has-error") ?? "[]");
const diagnosticIds = (page: SpecPage): string[] => diagnostics(page).map((item) => item.id);

/** Ids of the "keyword could not be resolved" warnings on the host. */
const unresolvedWarnings = (page: SpecPage): string[] =>
  diagnosticIds(page).filter((id) => id.startsWith("WARN_inherited_"));

/** Gives the table a dataset to auto-detect scenarios from. */
const withDatasetMeta = async (page: SpecPage): Promise<SpecPage> => {
  page.rootInstance.datasetMeta = { availableScenarios: ["ac1", "pp1"] };
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

describe("bn-table: inherited-closest takes the nearest ancestor that sets the value", () => {
  it("takes scenarios from the page when the card does not set them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
    expect(unresolvedWarnings(page)).toEqual([]);
  });

  it("takes scenarios from the card when the card sets them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="ac1">${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
    expect(unresolvedWarnings(page)).toEqual([]);
  });

  it("takes scenarios from the outer of two nested cards when only that one sets them", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="fc1"><bn-layout-card>${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(unresolvedWarnings(page)).toEqual([]);
  });

  it("resolves scenarios from the card and order from the page in one component", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1" title-order="ac1"><bn-layout-card title-scenarios="ac1" title-order="pp1">${table(`scenarios="inherited-closest" order="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
    expect(page.rootInstance.prepareOrder().hierarchy).toEqual([OrderColumn.AC1]);
    expect(unresolvedWarnings(page)).toEqual([]);
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

describe("bn-table: an inherited keyword that cannot be resolved", () => {
  describe.each([
    ["without a layout ancestor", (inner: string) => inner],
    ["in a page that does not set the field", (inner: string) => `<bn-layout-page>${inner}</bn-layout-page>`],
  ])("%s", (_name, wrap) => {
    it("auto-detects scenarios and warns once", async () => {
      const page = await withDatasetMeta(await mount(wrap(table(`scenarios="inherited-page"`))));

      expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
      expect(diagnostics(page)).toContainEqual({
        id: "WARN_inherited_scenarios",
        type: "warning",
        message: "scenarios: 'inherited-page' could not be resolved, no surrounding page sets titleScenarios",
      });
      expect(diagnosticIds(page)).not.toContain("AUTO_scenarios");
    });

    it("uses the default order and direction", async () => {
      const page = await mount(wrap(table(`order="inherited-closest" order-direction="inherited-closest"`)));

      expect(page.rootInstance.prepareOrder()).toEqual({
        hierarchy: [OrderColumn.CATEGORY],
        direction: OrderDirection.ASC,
      });
      expect(diagnostics(page)).toContainEqual({
        id: "WARN_inherited_order",
        type: "warning",
        message: "order: 'inherited-closest' could not be resolved, no surrounding card or page sets titleOrder",
      });
      expect(diagnosticIds(page)).toContain("WARN_inherited_orderDirection");
    });

    it("shows no variances", async () => {
      const page = await mount(wrap(table(`scenarios="ac1" variances="inherited-page"`)));

      expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
      expect(diagnosticIds(page)).toContain("WARN_inherited_variances");
    });

    it("renders like a table without these attributes", async () => {
      const keywords = await withDatasetMeta(
        await mount(
          wrap(
            table(
              `scenarios="inherited-page" variances="inherited-page" order="inherited-page" order-direction="inherited-page"`,
            ),
          ),
        ),
      );
      const scenarios = keywords.rootInstance.prepareScenarios();
      const order = keywords.rootInstance.prepareOrder();

      const blank = await withDatasetMeta(await mount(wrap(table(""))));

      expect(scenarios).toEqual(blank.rootInstance.prepareScenarios());
      expect(order).toEqual(blank.rootInstance.prepareOrder());
    });
  });

  it("never uses the literal keyword of a card as a scenario", async () => {
    const page = await withDatasetMeta(
      await mount(
        `<bn-layout-page><bn-layout-card title-scenarios="inherited-page">${table(`scenarios="inherited-closest"`)}</bn-layout-card></bn-layout-page>`,
      ),
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);
    expect(diagnostics(page)).toContainEqual({
      id: "WARN_inherited_scenarios",
      type: "warning",
      message: "scenarios: 'inherited-closest' could not be resolved, no surrounding card or page sets titleScenarios",
    });
  });

  it("auto-detects unresolved scenarios next to variances that do resolve", async () => {
    const page = await withDatasetMeta(
      await mount(
        `<bn-layout-page title-variances="dpp1_ac1_pos">${table(`scenarios="inherited-page" variances="inherited-page"`)}</bn-layout-page>`,
      ),
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1", "dpp1_ac1_pos"]);
    expect(unresolvedWarnings(page)).toEqual(["WARN_inherited_scenarios"]);
    expect(diagnosticIds(page)).not.toContain("AUTO_scenarios");
  });

  it("does not warn when the keyword resolves", async () => {
    const page = await withDatasetMeta(
      await mount(
        `<bn-layout-page title-scenarios="fc1" title-variances="dfc1_ac1_pos" title-order="fc1" title-order-direction="desc">${table(`scenarios="inherited-page" variances="inherited-page" order="inherited-page" order-direction="inherited-page"`)}</bn-layout-page>`,
      ),
    );

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1", "dfc1_ac1_pos"]);
    expect(page.rootInstance.prepareOrder()).toEqual({ hierarchy: [OrderColumn.FC1], direction: OrderDirection.DESC });
    expect(diagnosticIds(page).filter((id) => id.startsWith("WARN_inherited_"))).toEqual([]);
    expect(diagnosticIds(page)).not.toContain("AUTO_scenarios");
  });

  it("drops the warning once the page sets the field", async () => {
    const page = await withDatasetMeta(
      await mount(`<bn-layout-page>${table(`scenarios="inherited-page"`)}</bn-layout-page>`),
    );
    expect(diagnosticIds(page)).toContain("WARN_inherited_scenarios");

    await setLater(page, "bn-layout-page", "title-scenarios", "fc1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(diagnosticIds(page)).not.toContain("WARN_inherited_scenarios");
  });

  it("drops the warning once the prop is no keyword any more", async () => {
    const page = await withDatasetMeta(await mount(table(`scenarios="inherited-page"`)));
    expect(diagnosticIds(page)).toContain("WARN_inherited_scenarios");

    page.root.setAttribute("scenarios", "ac1");
    await page.waitForChanges();

    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1"]);
    expect(diagnosticIds(page)).not.toContain("WARN_inherited_scenarios");
  });

  it("looks up a prop that becomes a keyword after connect", async () => {
    const page = await mount(`<bn-layout-page title-scenarios="fc1">${table(`scenarios="ac1"`)}</bn-layout-page>`);

    page.root.setAttribute("scenarios", "inherited-page");
    await page.waitForChanges();

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(unresolvedWarnings(page)).toEqual([]);
  });

  it("watches the ancestors of a prop that becomes a keyword after connect", async () => {
    const page = await mount(`<bn-layout-page>${table(`scenarios="ac1"`)}</bn-layout-page>`);

    page.root.setAttribute("scenarios", "inherited-page");
    await page.waitForChanges();
    expect(unresolvedWarnings(page)).toEqual(["WARN_inherited_scenarios"]);

    await setLater(page, "bn-layout-page", "title-scenarios", "fc1");

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
    expect(unresolvedWarnings(page)).toEqual([]);
  });

  it("looks up again when the prop changes to the other keyword", async () => {
    const page = await mount(
      `<bn-layout-page title-scenarios="ac1,pp1"><bn-layout-card title-scenarios="fc1">${table(`scenarios="inherited-page"`)}</bn-layout-card></bn-layout-page>`,
    );
    expect(page.rootInstance.prepareScenarios()).toEqual(["ac1", "pp1"]);

    page.root.setAttribute("scenarios", "inherited-closest");
    await page.waitForChanges();

    expect(page.rootInstance.prepareScenarios()).toEqual(["fc1"]);
  });
});
