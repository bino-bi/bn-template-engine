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
import { IbcsChartTime } from "./ibcs-chart-time";

describe("IBCS Chart Time no-data label", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["emptyData"] = { data: [] };
  });

  it("falls back to plain 'No Data' when the i18n map has no no-data entry", async () => {
    const page = await newSpecPage({
      components: [IbcsChartTime],
      template: () => <ibcs-chart-time scenarios={["ac1"]} i18n={new Map()} tableName="emptyData"></ibcs-chart-time>,
    });

    expect(page.root.shadowRoot.textContent.trim()).toEqual("No Data");
  });
});
