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
import { IbcsChartBubble } from "./ibcs-chart-bubble";

describe("IBCS Chart Bubble number locale", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["localeData"] = {
      data: [
        {
          operation: "+",
          rowGroup: "SBUs",
          rowGroupIndex: 1,
          category: "Core Business",
          categoryIndex: 1,
          subCategory: "VAB",
          subCategoryIndex: 1,
          ac1: 0.3,
          ac2: 0.1,
          ac3: 32,
        },
      ],
    };
  });

  afterEach(() => {
    getStores(null).context.state.locale = "en";
  });

  const renderSvg = async (): Promise<string> => {
    const page = await newSpecPage({
      components: [IbcsChartBubble],
      template: () => (
        <ibcs-chart-bubble
          x={{ measure: "ac1" }}
          y={{ measure: "ac2" }}
          size={{ measure: "ac3" }}
          labels={{ points: "all", values: true, max: 12 }}
          legend={{ show: false, position: "right" }}
          pointLevel="subCategory"
          seriesLevel="category"
          containerWidth={1000}
          i18n={new Map()}
          tableName="localeData"
        ></ibcs-chart-bubble>
      ),
    });

    return page.root.shadowRoot.innerHTML;
  };

  it("prints the bubble value with a decimal point when the context locale is en", async () => {
    expect(await renderSvg()).toContain(">32.0</tspan>");
  });

  it("prints the bubble value with a decimal comma when the context locale is de", async () => {
    getStores(null).context.state.locale = "de";

    expect(await renderSvg()).toContain(">32,0</tspan>");
  });
});
