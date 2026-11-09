// Mock MutationObserver for withComponentStyle mixin
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../../stores/internationalization");
  const { createScopedDb } = require("../../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { h } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../../context/context-protocol";
import { BnTableRenderer } from "./bn-table-renderer";
import { OrderDirection, TableType } from "../utils/model";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";

// The ruleSetConfig prop seeds the IBCSRuleSet used for scenario column
// ordering, so a user-adjusted sortIndex must reorder the rendered columns.
describe("IBCS Table ruleset column ordering", () => {
  const baseRow = {
    setName: "de",
    operation: "+",
    rowGroup: "Umsatz",
    rowGroupIndex: 0,
    subCategory: "",
    subCategoryIndex: 1,
  };

  const rows: any[] = [
    { ...baseRow, category: "Berlin", categoryIndex: 1, ac1: 50, pp1: 40, pl1: 45 },
    { ...baseRow, category: "Hamburg", categoryIndex: 2, ac1: 30, pp1: 25, pl1: 28 },
  ];

  beforeAll(() => {
    getStores(null).db.db.tables["rulesetData"] = { data: rows };
  });

  const renderTable = (ruleSetConfig?: RuleSetConfig): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", "pp1", "pl1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.AC1],
              direction: OrderDirection.DESC,
            } as Order
          }
          type={TableType.SUM}
          i18n={new Map([["SUM_TOTAL", "Summe"]])}
          i18n-mode={I18nMode.META}
          tableName="rulesetData"
          ruleSetConfig={ruleSetConfig}
        ></bn-table-renderer>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes(text),
    );

  it("orders scenario columns by the default IBCS sort indices (pp < pl < ac)", async () => {
    const page = await renderTable();

    const berlinRow = findRowByFirstCell(page, "Berlin");

    expect(berlinRow).toBeDefined();
    expect(cellTexts(berlinRow).slice(0, 4)).toEqual(["Berlin", "40.0", "45.0", "50.0"]);
  });

  // the last header row draws the line under each scenario column, by class
  const underlineClasses = (page: SpecPage): string[] =>
    Array.from(page.root.shadowRoot.querySelectorAll("thead tr:last-child th")).map(
      (cell) => cell.className.trim().split(" ")[0],
    );

  it("underlines each scenario column in its own look by default", async () => {
    const classes = underlineClasses(await renderTable());

    expect(classes).toEqual(expect.arrayContaining(["pp1", "pl1", "ac1"]));
  });

  it("underlines a scenario column in the look of the slot its colorIndex selects", async () => {
    const classes = underlineClasses(await renderTable({ scenarios: { pl: { colorIndex: 30 } } }));

    expect(classes).toEqual(expect.arrayContaining(["pp1", "fc1", "ac1"]));
    expect(classes).not.toContain("pl1");
  });

  it("draws the in-cell bars of a scenario in the style of its slot", async () => {
    const plain = (await renderTable()).rootInstance.prepareBarChartStyles().scenarios;
    const moved = (await renderTable({ scenarios: { pl: { colorIndex: 30 } } })).rootInstance.prepareBarChartStyles()
      .scenarios;

    expect(plain.pl.fillpattern).toBe("outlined");
    expect(moved.pl).toEqual(plain.fc);
    expect(moved.ac).toEqual(plain.ac);
  });

  it("reorders scenario columns when the ruleSetConfig overrides a sortIndex", async () => {
    const page = await renderTable({ scenarios: { ac: { sortIndex: 0 } } });

    const berlinRow = findRowByFirstCell(page, "Berlin");

    expect(berlinRow).toBeDefined();
    // ac now sorts before pp and pl
    expect(cellTexts(berlinRow).slice(0, 4)).toEqual(["Berlin", "50.0", "40.0", "45.0"]);
  });

  describe("variance columns", () => {
    const setRows: any[] = [
      { ...baseRow, setname: "de", category: "Berlin", categoryIndex: 1, ac1: 50, pp1: 40, pl1: 45 },
      { ...baseRow, setname: "at", category: "Berlin", categoryIndex: 1, ac1: 30, pp1: 20, pl1: 25 },
    ];

    beforeAll(() => {
      getStores(null).db.db.tables["rulesetSetData"] = { data: setRows };
    });

    // manifest order is shuffled on purpose: the sort indices alone must group them
    const renderVariances = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
      newSpecPage({
        components: [BnTableRenderer],
        template: () => (
          <bn-table-renderer
            scenarios={["ac1", "pp1", "pl1", "drac1_pl1_pos", "dac1_pp1_pos", "dac1_pl1_pos", "drac1_pp1_pos"]}
            measure-scale="_"
            order={
              {
                hierarchy: [OrderColumn.AC1],
                direction: OrderDirection.DESC,
              } as Order
            }
            type={TableType.SUM}
            i18n={new Map([["SUM_TOTAL", "Summe"]])}
            i18n-mode={I18nMode.META}
            tableName="rulesetData"
            {...extraProps}
          ></bn-table-renderer>
        ),
      });

    it("groups absolute and relative variances by reference (PY, PY%, PL, PL%)", async () => {
      const page = await renderVariances();

      // pp1 pl1 ac1 | dac1_pp1 drac1_pp1 | dac1_pl1 drac1_pl1
      expect(cellTexts(findRowByFirstCell(page, "Berlin"))).toEqual([
        "Berlin",
        "40.0",
        "45.0",
        "50.0",
        "10.0",
        "25.00%",
        "5.0",
        "11.11%",
      ]);
    });

    it("repeats the grouped variance order in every interval bucket", async () => {
      const page = await renderVariances({ tableName: "rulesetSetData", interval: "setname" });

      expect(cellTexts(findRowByFirstCell(page, "Berlin"))).toEqual([
        "Berlin",
        "40.0",
        "45.0",
        "50.0",
        "10.0",
        "25.00%",
        "5.0",
        "11.11%",
        "20.0",
        "25.0",
        "30.0",
        "10.0",
        "50.00%",
        "5.0",
        "20.00%",
      ]);
    });
  });
});
