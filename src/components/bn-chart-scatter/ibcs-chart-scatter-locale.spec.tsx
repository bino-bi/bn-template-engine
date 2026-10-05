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

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { IbcsChartScatter } from "./ibcs-chart-scatter";

describe("IBCS Chart Scatter number locale", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["localeData"] = { data: [] };
  });

  afterEach(() => {
    getStores(null).context.state.locale = "en";
  });

  // the locale the chart hands to the number formatter
  const chartLocale = async (): Promise<string> => {
    const page = await newSpecPage({
      components: [IbcsChartScatter],
      template: () => (
        <ibcs-chart-scatter
          x={{ measure: "ac1" }}
          y={{ measure: "ac2" }}
          labels={{ points: "none", values: false, max: 0 }}
          legend={{ show: false, position: "right" }}
          i18n={new Map()}
          tableName="localeData"
        ></ibcs-chart-scatter>
      ),
    });

    return page.rootInstance.chart.styles.locale;
  };

  it("formats numbers for en when the context locale is en", async () => {
    expect(await chartLocale()).toBe("en");
  });

  it("formats numbers for de when the context locale is de", async () => {
    getStores(null).context.state.locale = "de";

    expect(await chartLocale()).toBe("de");
  });
});
