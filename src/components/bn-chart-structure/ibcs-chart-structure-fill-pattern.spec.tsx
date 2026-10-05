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
import { IbcsChartStructure } from "./ibcs-chart-structure";

describe("IBCS Chart Structure fill pattern", () => {
  beforeAll(() => {
    getStores(null).db.db.tables["fillPatternData"] = { data: [] };
  });

  // the lookup the chart elements do for an FC bar
  const fcPattern = async (fillpattern: string): Promise<unknown> => {
    const styles: any = { barStyles: { fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern } } };
    const page = await newSpecPage({
      components: [IbcsChartStructure],
      template: () => (
        <ibcs-chart-structure
          scenarios={["fc1"]}
          i18n={new Map()}
          tableName="fillPatternData"
          styles={styles}
        ></ibcs-chart-structure>
      ),
    });

    const chartStyles = page.rootInstance.chart.styles;
    return chartStyles.pattern.get(chartStyles.barStyles.fc.fillpattern)?.pattern;
  };

  it.each(["fc", "hatched"])("finds the hatch pattern for an FC style with fillpattern %s", async (fillpattern) => {
    expect(await fcPattern(fillpattern)).toBeDefined();
  });

  it.each(["solid", "outlined"])("finds no pattern for an FC style with fillpattern %s", async (fillpattern) => {
    expect(await fcPattern(fillpattern)).toBeUndefined();
  });
});
