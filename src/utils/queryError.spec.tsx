// A query that fails on a registered dataset must end as an ERR_sql item on
// the chart, not as "No Data". One file for the five chart types: they share
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

import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../context/context-protocol";
import { ChartBubble } from "../components/bn-chart-bubble/bn-chart-bubble";
import { IbcsChartBubble } from "../components/bn-chart-bubble/ibcs-chart-bubble";
import { ChartBullet } from "../components/bn-chart-bullet/bn-chart-bullet";
import { IbcsChartBullet } from "../components/bn-chart-bullet/ibcs-chart-bullet";
import { ChartScatter } from "../components/bn-chart-scatter/bn-chart-scatter";
import { IbcsChartScatter } from "../components/bn-chart-scatter/ibcs-chart-scatter";
import { Chart as ChartStructure } from "../components/bn-chart-structure/bn-chart-structure";
import { IbcsChartStructure } from "../components/bn-chart-structure/ibcs-chart-structure";
import { Chart as ChartTime } from "../components/bn-chart-time/bn-chart-time";
import { IbcsChartTime } from "../components/bn-chart-time/ibcs-chart-time";
import { DataAnalyzer } from "./dataAnalyzer";
import { SiPrefix } from "./model/SiPrefix";
import { ErrorDispatcher, ErrorItem } from "./withHasError";
import { errorText, reportQueryError } from "./queryError";

// Fixed scaling: the auto-fit of the time and the structure chart draws the SVG and needs getBBox, which mock-doc lacks.
const FIXED_SCALE = `scale="none" unit-scaling="100" percentage-scaling="2"`;

const CHARTS: [tag: string, inner: string, components: unknown[], attrs: string][] = [
  ["bn-chart-time", "ibcs-chart-time", [ChartTime, IbcsChartTime], `scenarios="ac1" ${FIXED_SCALE}`],
  [
    "bn-chart-structure",
    "ibcs-chart-structure",
    [ChartStructure, IbcsChartStructure],
    `scenarios="ac1" ${FIXED_SCALE}`,
  ],
  ["bn-chart-bullet", "ibcs-chart-bullet", [ChartBullet, IbcsChartBullet], `actual="ac1" target="pl1"`],
  ["bn-chart-scatter", "ibcs-chart-scatter", [ChartScatter, IbcsChartScatter], `x="ac1" y="ac2"`],
  ["bn-chart-bubble", "ibcs-chart-bubble", [ChartBubble, IbcsChartBubble], `x="ac1" y="ac2" size="ac3"`],
];

const render = async (tag: string, components: unknown[], attrs: string) => {
  const page = await newSpecPage({ components: components as any[], html: `<${tag} ${attrs}></${tag}>` });
  await page.waitForChanges();
  return page;
};

const sqlError = (host: Element): ErrorItem | undefined =>
  (JSON.parse(host.getAttribute("has-error") ?? "[]") as ErrorItem[]).find((item) => item.id === "ERR_sql");

const inners = (host: Element, inner: string): Element[] => Array.from(host.shadowRoot!.querySelectorAll(inner));

describe.each(CHARTS)("%s with a failing query", (tag, inner, components, attrs) => {
  beforeAll(() => {
    getStores(null).db.db.tables["sales"] = {
      data: [
        {
          operation: "+",
          date: "2024-01-01",
          rowGroup: "g",
          rowGroupIndex: 1,
          category: "a",
          categoryIndex: 1,
          subCategory: "",
          subCategoryIndex: 1,
          ac1: 1,
          ac2: 2,
          ac3: 3,
          pl1: 4,
        },
      ],
    };
  });

  it("reports ERR_sql and shows no 'No Data' box for a filter AlaSQL cannot read", async () => {
    const page = await render(tag, components, `${attrs} datasets="sales" filter="category ="`);

    expect(sqlError(page.root!)?.type).toBe("error");
    expect(sqlError(page.root!)?.message).toContain("Parse error");
    expect(inners(page.root!, inner).length).toBeGreaterThan(0);
    for (const element of inners(page.root!, inner)) {
      expect(element.shadowRoot!.querySelector(".empty-state")).toBeNull();
    }
  });

  it("shows 'No Data' and no error for a filter that matches no row", async () => {
    const page = await render(tag, components, `${attrs} datasets="sales" filter="category = 'none'"`);

    expect(sqlError(page.root!)).toBeUndefined();
    for (const element of inners(page.root!, inner)) {
      expect(element.shadowRoot!.querySelector(".empty-state")).not.toBeNull();
    }
  });

  it("reports nothing for a dataset that is not registered yet", async () => {
    const page = await render(tag, components, `${attrs} datasets="notLoadedYet" filter="category ="`);

    expect(sqlError(page.root!)).toBeUndefined();
  });

  it("removes the item when the filter is fixed", async () => {
    const page = await render(tag, components, `${attrs} datasets="sales" filter="category ="`);
    expect(sqlError(page.root!)).toBeDefined();

    page.root!.setAttribute("filter", "category = 'none'");
    await page.waitForChanges();

    expect(sqlError(page.root!)).toBeUndefined();
  });
});

describe.each(CHARTS.slice(0, 2))("%s with a failing measure-scale query", (tag, inner, components, attrs) => {
  it("reports ERR_sql when only the measure-scale query fails", async () => {
    // the other queries of the chart work: the item can only come from the measure scale
    const measureScale = jest
      .spyOn(DataAnalyzer, "calculateMeasureScale")
      .mockImplementation((_db, _fromExpr, _scenarios, _mode, onError) => {
        onError?.(new Error("measure scale query failed"));
        return new SiPrefix();
      });
    const page = await render(tag, components, `${attrs} datasets="sales" measure-scale="GREATEST"`);
    measureScale.mockRestore();

    expect(sqlError(page.root!)?.message).toContain("measure scale query failed");
    for (const element of inners(page.root!, inner)) {
      expect(element.shadowRoot!.querySelector(".empty-state")).toBeNull();
    }
  });
});

describe("reportQueryError", () => {
  const dispatcher = () => {
    const items: ErrorItem[] = [];
    const errors = {
      addOrReplace: (item: ErrorItem) => items.push(item),
      remove: (id: string) => items.splice(0, items.length, ...items.filter((item) => item.id !== id)),
    } as unknown as ErrorDispatcher;
    return { items, errors };
  };

  it("writes an error item with the query text and removes it again", () => {
    const { items, errors } = dispatcher();

    reportQueryError(errors, "Parse error on line 1");
    expect(items).toEqual([{ id: "ERR_sql", type: "error", message: "Query failed: Parse error on line 1" }]);

    reportQueryError(errors, undefined);
    expect(items).toEqual([]);
  });

  it("does nothing without a dispatcher", () => {
    expect(() => reportQueryError(undefined, "x")).not.toThrow();
  });

  it("reads the text of an Error and of a thrown string", () => {
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText("plain")).toBe("plain");
  });
});
