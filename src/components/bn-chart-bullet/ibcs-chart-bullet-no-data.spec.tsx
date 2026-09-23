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
import { IbcsChartBullet } from "./ibcs-chart-bullet";
import { OrderDirection } from "../../utils/model/Order";

describe("IBCS Chart Bullet no-data", () => {
  // Without a tableName the model has no source, so the chart has no rows.
  it("renders the message in the empty-state box instead of a canvas", async () => {
    const page = await newSpecPage({
      components: [IbcsChartBullet],
      template: () => (
        <ibcs-chart-bullet
          actual={{ measure: "ac1" }}
          labels={{ show: "none", decimals: 0 }}
          order={{ hierarchy: [], direction: OrderDirection.ASC }}
          i18n={new Map()}
        ></ibcs-chart-bullet>
      ),
    });

    expect(page.root.classList.contains("no-data")).toBe(true);
    expect(page.root.shadowRoot.querySelector(".empty-state").textContent.trim()).toEqual("No Data");
    expect(page.root.shadowRoot.querySelector("svg#drawCanvas")).toBeNull();
  });
});
