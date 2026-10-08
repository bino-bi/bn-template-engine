// A name that a <bn-ruleset> gives a scenario labels it in every component
// that shows scenario labels. One file for the five components: they share
// the rule and the setup.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../stores/internationalization");
  const { SYSTEM_RULESET_DEFAULTS } = require("../stores/ruleSets");
  const { createScopedDb } = require("../context/scopedDb");

  const build = () => ({
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    ruleSets: createStore({ _system: SYSTEM_RULESET_DEFAULTS }),
    scalingGroups: createStore({}),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  });

  let mockStores = build();

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
    findContextElement: () => undefined,
    __resetMockStores: () => {
      mockStores = build();
    },
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { Table } from "../components/bn-table/bn-table";
import { Chart as ChartTime } from "../components/bn-chart-time/bn-chart-time";
import { Chart as ChartStructure } from "../components/bn-chart-structure/bn-chart-structure";
import { ChartBullet } from "../components/bn-chart-bullet/bn-chart-bullet";
import { Title } from "../components/bn-title/bn-title";
import { RuleSetConfig } from "../stores/ruleSets";

const { getStores, __resetMockStores } = require("../context/context-protocol");

// the inner renderers are not registered: this is about the label map of the outer element
const COMPONENTS: [tag: string, component: unknown, attrs: string][] = [
  ["bn-table", Table, `scenarios="ac1" scale="none"`],
  ["bn-chart-time", ChartTime, `scenarios="ac1" scale="none"`],
  ["bn-chart-structure", ChartStructure, `scenarios="ac1" scale="none"`],
  ["bn-chart-bullet", ChartBullet, `actual="ac1" target="pl1"`],
  ["bn-title", Title, `scenarios="ac1"`],
];

const labels = async (tag: string, component: unknown, attrs: string): Promise<Map<string, string>> => {
  const page = await newSpecPage({ components: [component as any], html: `<${tag} ${attrs}></${tag}>` });
  await page.waitForChanges();
  return page.rootInstance.prepareI18n();
};

const setRuleSet = (name: string, config: RuleSetConfig) => getStores(null).ruleSets.set(name, config);

describe.each(COMPONENTS)("%s: scenario names of a rule set", (tag, component, attrs) => {
  beforeEach(() => {
    __resetMockStores();
  });

  it("keeps the i18n labels without a rule set", async () => {
    const map = await labels(tag, component, attrs);

    // the built-in rule set calls pp "PP": that name is not a label
    expect(map.get("pp1")).toBe("PY");
    expect(map.get("pl2")).toBe("PL2");
  });

  it("uses the name of the default rule set", async () => {
    setRuleSet("_default", { scenarios: { pl: { name: "Budget" } } });
    const map = await labels(tag, component, attrs);

    expect(map.get("pl1")).toBe("Budget");
    expect(map.get("pl2")).toBe("Budget2");
    expect(map.get("ac1")).toBe("AC");
  });

  it("uses the name of the selected rule set over the default one", async () => {
    setRuleSet("_default", { scenarios: { pl: { name: "Budget" } } });
    setRuleSet("mine", { scenarios: { pl: { name: "Plan" }, pp: { name: "PP" } } });
    const map = await labels(tag, component, `${attrs} ruleset="mine"`);

    expect(map.get("pl1")).toBe("Plan");
    // a name counts when a rule set sets it, also when it equals the built-in name
    expect(map.get("pp1")).toBe("PP");
  });

  it("ignores a rule set that is not selected", async () => {
    setRuleSet("other", { scenarios: { pl: { name: "Plan" } } });

    expect((await labels(tag, component, attrs)).get("pl1")).toBe("PL");
  });
});
