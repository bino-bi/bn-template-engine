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

describe("IBCS Chart Bubble no-data", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["emptyData"] = { data: [] };
  });

  it("renders the message in the empty-state box instead of a canvas", async () => {
    const page = await newSpecPage({
      components: [IbcsChartBubble],
      template: () => (
        <ibcs-chart-bubble
          x={{ measure: "ac1" }}
          y={{ measure: "ac2" }}
          size={{ measure: "ac3" }}
          labels={{ points: "none", values: false, max: 0 }}
          legend={{ show: false, position: "right" }}
          i18n={new Map()}
          tableName="emptyData"
        ></ibcs-chart-bubble>
      ),
    });

    expect(page.root.classList.contains("no-data")).toBe(true);
    expect(page.root.shadowRoot.querySelector(".empty-state").textContent.trim()).toEqual("No Data");
    expect(page.root.shadowRoot.querySelector("svg#drawCanvas")).toBeNull();
  });
});
