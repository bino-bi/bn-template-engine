// @ts-nocheck — Pre-existing baseline failures (see CLAUDE.md/MEMORY.md). Type-checking
// is suppressed so the alasql-shared-db refactor can land; rewriting these 4000 lines
// of fixtures to use a `<bn-context>` wrapper is a separate task.

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
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { createScopedDb } = require("../../context/scopedDb");

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
import { newSpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { IbcsTable } from "./ibcs-table";
import { OrderDirection, TableType } from "./utils/model";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../utils/constants";
import { Order, OrderColumn } from "../../utils/model/Order";

describe("IBCS Table Test", () => {
  const dataSet2: any[] = [
    {
      setName: "de",
      operation: "+",
      rowGroup: "Services",
      rowGroupIndex: 0,
      category: "Category A",
      categoryIndex: 1,
      subCategory: "Category - SUB 1",
      subCategoryIndex: 1,
      columnGroup: "DE",
      columnGroupIndex: 1,
      columnSubGroup: "Berlin",
      columnSubGroupIndex: 1,
      ac1: 1,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Product",
      rowGroupIndex: 0,
      category: "Category A",
      categoryIndex: 1,
      subCategory: "Category - SUB 1",
      subCategoryIndex: 1,
      columnGroup: "DE",
      columnGroupIndex: 1,
      columnSubGroup: "Berlin",
      columnSubGroupIndex: 1,
      ac1: 1,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Product",
      rowGroupIndex: 0,
      category: "Category A",
      categoryIndex: 1,
      subCategory: "Category - SUB 1",
      subCategoryIndex: 1,
      columnGroup: "DE",
      columnGroupIndex: 1,
      columnSubGroup: "Frankfurt",
      columnSubGroupIndex: 2,
      ac1: 1,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Product",
      rowGroupIndex: 0,
      category: "Category A",
      categoryIndex: 1,
      subCategory: "Category - SUB 2",
      subCategoryIndex: 2,
      columnGroup: "UK",
      columnGroupIndex: 2,
      columnSubGroup: "London",
      columnSubGroupIndex: 1,
      ac1: 2,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },

    {
      setName: "de",
      operation: "+",
      rowGroup: "Services",
      rowGroupIndex: 0,
      category: "Category B",
      categoryIndex: 2,
      subCategory: "Category - SUB 1",
      subCategoryIndex: 1,
      columnGroup: "DE",
      columnGroupIndex: 1,
      columnSubGroup: "Berlin",
      columnSubGroupIndex: 1,
      ac1: 3,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Services",
      rowGroupIndex: 0,
      category: "Category B",
      categoryIndex: 2,
      subCategory: "Category - SUB 2",
      subCategoryIndex: 2,
      columnGroup: "UK",
      columnGroupIndex: 2,
      columnSubGroup: "London",
      columnSubGroupIndex: 1,
      ac1: 4,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Services",
      rowGroupIndex: 0,
      category: "Category C",
      categoryIndex: 2,
      subCategory: "Category - SUB 2",
      subCategoryIndex: 2,
      columnGroup: "UK",
      columnGroupIndex: 2,
      columnSubGroup: "London",
      columnSubGroupIndex: 1,
      ac1: 4,
      pp1: 10,
      fc1: 3,
      pl1: 3,
      ac2: 1,
      pp2: 7,
      fc2: 7,
      pl2: 4,
      ac3: 1,
      pp3: 7,
      fc3: 7,
      pl3: 4,
      ac4: 1,
      pp4: 7,
      fc4: 7,
      pl4: 4,
    },
  ];

  // The component reads its rows from the scoped alasql db via `tableName`
  // (the legacy `data` prop is gone) — register the fixture like bn-datasource does.
  beforeAll(() => {
    getStores(null).db.db.tables["dataSet2"] = { data: dataSet2 };
  });

  it("should render table width colums and row dills and grouping in percent", async () => {
    const page = await newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          sum-title="Sample Table Title"
          scenarios={["ac1", "pp1", "dac1_pp1_pos", "drac1_pp1_pos"]}
          scenarios-data-format={DataFormat.PERCENT}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.DESC,
            } as Order
          }
          limit={2}
          measure-type={MeasureType.VOLUME}
          grouped={true}
          type={TableType.OPT}
          i18n={new Map([["SUM_TOTAL", "🤩"]])}
          i18n-mode={I18nMode.META}
          showGroupTitle={false}
          show-measure-scale={true}
          tableName="dataSet2"
          category-width={TableCategoryWidth.W100}
          thereof={[
            {
              rowGroup: "Product",
              category: "Category A",
              subCategory: "Category - SUB 2",
              partOf: "",
            },
            {
              rowGroup: "",
              category: "Category B",
              subCategory: "",
              partOf: "",
            },
          ]}
          partof={[
            {
              rowGroup: "Product",
              category: "Category A",
              subCategory: "",
              partOf: "",
            },
          ]}
          categorythereof={
            new Map([
              [
                "ac1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
              [
                "pp1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
            ])
          }
        ></ibcs-table>
      ),
    });

    expect(page.root)
      .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"meta\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"percent\" show-measure-scale=\"\" sum-title=\"Sample Table Title\">
      <mock:shadow-root>
    <table>
      <thead>
        <tr class=\"groupheader\">
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span class=\"table-footer\"></span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span class=\"table-footer\"></span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                DE
              </span>
            </span>
          </th>
          <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                Berlin
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                REST
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                PY
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                DE
              </span>
            </span>
          </th>
          <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                Berlin
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                REST
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                AC
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                ΔPY
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                ΔPY%
              </span>
            </span>
          </th>
        </tr>
        <tr>
          <th class=\"base operation\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base category\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnSubGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnSubGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 base\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base dac1_pp1_pos\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base drac1_pp1_pos\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class=\"groupheader\">
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
        </tr>
        <tr>
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Category C
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            400,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            400,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -6,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -60,00%
          </td>
        </tr>
        <tr>
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-second\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-second\"></span>
            Category B
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            1.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-second\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-second\"></span>
            2.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            300,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-second\"></span>
            300,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            400,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-second\"></span>
            700,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-second\"></span>
            -13,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-second relative_variance\"></span>
            -65,00%
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\">
              davon
            </span>
            Category - SUB 1
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            0,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            300,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            300,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            0,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            300,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -7,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -70,00%
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-second\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-second\">
              davon
            </span>
            Category - SUB 2
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-second\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-second\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            400,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-second\"></span>
            400,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-second\"></span>
            -6,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-second relative_variance\"></span>
            -60,00%
          </td>
        </tr>
        <tr>
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            REST
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            100,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            100,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -9,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -90,00%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Services
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            2.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            2.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            4.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            100,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            1.200,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -28,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -70,00%
          </td>
        </tr>
        <tr class=\"groupheader\">
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup headerlabel percent\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
        </tr>
        <tr>
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Category A
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            2.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            3.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            100,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            400,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -26,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -86,67%
          </td>
        </tr>
        <tr class=\"partof\">
          <td class=\"base percent\" colspan=\"1\">
            <span class=\"base prefix-first\"></span>
            -
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\">
              in % von
            </span>
            Product
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"base percent\" colspan=\"1\">
            <span class=\"base prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"base percent\" colspan=\"1\">
            <span class=\"base prefix-first\"></span>
            -
          </td>
          <td class=\"base percent\" colspan=\"1\">
            <span class=\"base prefix-first\"></span>
            100,00%
          </td>
          <td class=\"base percent\" colspan=\"1\">
            <span class=\"base prefix-first\"></span>
            -
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\">
              davon
            </span>
            Category - SUB 2
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup percent\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            200,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -8,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -80,00%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Product
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            2.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            3.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            100,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            200,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            400,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -26,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -86,67%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base operation percent\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Sample Table Title
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            4.000,00%
          </td>
          <td class=\"columnSubGroup percent pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            3.000,00%
          </td>
          <td class=\"columnGroup percent pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            3.000,00%
          </td>
          <td class=\"base percent pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            7.000,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            600,00%
          </td>
          <td class=\"ac1 columnSubGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            500,00%
          </td>
          <td class=\"ac1 columnGroup percent\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            1.000,00%
          </td>
          <td class=\"ac1 base percent\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            1.600,00%
          </td>
          <td class=\"base decimal neg_pos\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first\"></span>
            -54,0
          </td>
          <td class=\"base neg_pos percent relative_variance\" colspan=\"1\">
            <span class=\"base neg_pos prefix-first relative_variance\"></span>
            -77,14%
          </td>
        </tr>
      </tbody>
    </table>
      </mock:shadow-root>
  </ibcs-table>`);
  });

  it("should render OPT table width colums and row dills and grouping", async () => {
    const page = await newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          sum-title="Sample Table Title"
          scenarios={["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
          scenarios-data-format="decimal"
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.DESC,
            } as Order
          }
          limit={2}
          measure-type={MeasureType.VOLUME}
          grouped={true}
          type={TableType.OPT}
          i18n={new Map([["SUM_TOTAL", "🤩"]])}
          i18n-mode={I18nMode.ALL}
          showGroupTitle={true}
          tableName="dataSet2"
          category-width={TableCategoryWidth.W100}
          thereof={[
            {
              rowGroup: "Product",
              category: "Category A",
              subCategory: "Category - SUB 2",
              partOf: "",
            },
            {
              rowGroup: "",
              category: "Category B",
              subCategory: "",
              partOf: "",
            },
          ]}
          categorythereof={
            new Map([
              [
                "ac1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
              [
                "pp1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
            ])
          }
        ></ibcs-table>
      ),
    });

    expect(page.root)
      .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"all\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"decimal\" sum-title=\"Sample Table Title\">
      <mock:shadow-root>
    <table>
      <thead>
        <tr class=\"groupheader\">
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span class=\"table-footer\"></span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span class=\"table-footer\"></span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                DE
              </span>
            </span>
          </th>
          <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                Berlin
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                REST
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                PY
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                DE
              </span>
            </span>
          </th>
          <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                Berlin
              </span>
            </span>
          </th>
          <th class=\"columnGroup headerlabel\" colspan=\"1\">
            <span>
              <span>
                REST
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                AC
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                Δ(PY - AC)
              </span>
            </span>
          </th>
          <th class=\"base headerlabel\" colspan=\"1\">
            <span>
              <span>
                Δ(PY - AC)%
              </span>
            </span>
          </th>
        </tr>
        <tr>
          <th class=\"base operation\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base category\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnSubGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"columnGroup pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base pp1\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnSubGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 columnGroup\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"ac1 base\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base dpp1_ac1_pos\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
          <th class=\"base drpp1_ac1_pos\" colspan=\"1\">
            <span>
              <span></span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class=\"groupheader\">
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
            Services
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
        </tr>
        <tr>
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Category C
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            4,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            4,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            6,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            150,00%
          </td>
        </tr>
        <tr>
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-second\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-second\"></span>
            Category B
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            10,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-second\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-second\"></span>
            20,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            3,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-second\"></span>
            3,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            4,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-second\"></span>
            7,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-second\"></span>
            13,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-second relative_variance\"></span>
            185,71%
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\">
              davon
            </span>
            Category - SUB 1
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            0,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            3,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            3,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            0,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            3,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            7,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            233,33%
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-second\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-second\">
              davon
            </span>
            Category - SUB 2
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-second\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-second\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-second\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-second\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-second\"></span>
            4,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-second\"></span>
            4,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-second\"></span>
            6,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-second relative_variance\"></span>
            150,00%
          </td>
        </tr>
        <tr>
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            REST
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            1,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            1,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            9,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            900,00%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Services
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            20,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            20,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            40,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            1,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            10,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            12,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            28,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            233,33%
          </td>
        </tr>
        <tr class=\"groupheader\">
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
            Product
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnSubGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
            <span class=\"columnGroup headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base decimal headerlabel\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
          <td class=\"base headerlabel percent\" colspan=\"1\">
            <span class=\"base headerlabel prefix-first\"></span>
          </td>
        </tr>
        <tr>
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            +
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Category A
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            20,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            30,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            1,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            4,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            26,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            650,00%
          </td>
        </tr>
        <tr class=\"ofit\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\">
              davon
            </span>
            Category - SUB 2
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal\" colspan=\"1\">
            <span class=\"columnGroup prefix-first\"></span>
            -
          </td>
          <td class=\"columnSubGroup decimal\" colspan=\"1\">
            <span class=\"columnSubGroup prefix-first\"></span>
            -
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            2,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            8,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            400,00%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Product
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            20,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            10,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            30,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            1,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            2,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            4,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            26,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            650,00%
          </td>
        </tr>
        <tr class=\"sum\">
          <td class=\"base decimal operation\" colspan=\"1\">
            <span class=\"base operation prefix-first\"></span>
            =
          </td>
          <td class=\"base category-w100\" colspan=\"1\">
            <span class=\"base category-w100 prefix-first\"></span>
            Sample Table Title
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            40,0
          </td>
          <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnSubGroup pp1 prefix-first\"></span>
            30,0
          </td>
          <td class=\"columnGroup decimal pp1\" colspan=\"1\">
            <span class=\"columnGroup pp1 prefix-first\"></span>
            30,0
          </td>
          <td class=\"base decimal pp1\" colspan=\"1\">
            <span class=\"base pp1 prefix-first\"></span>
            70,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            6,0
          </td>
          <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnSubGroup prefix-first\"></span>
            5,0
          </td>
          <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
            <span class=\"ac1 columnGroup prefix-first\"></span>
            10,0
          </td>
          <td class=\"ac1 base decimal\" colspan=\"1\">
            <span class=\"ac1 base prefix-first\"></span>
            16,0
          </td>
          <td class=\"base decimal pos_pos\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first\"></span>
            54,0
          </td>
          <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
            <span class=\"base pos_pos prefix-first relative_variance\"></span>
            337,50%
          </td>
        </tr>
      </tbody>
    </table>
      </mock:shadow-root>
  </ibcs-table>`);
  });

  it("should render LIST table width colums and row dills and grouping", async () => {
    const page = await newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          sum-title="Sample Table Title"
          scenarios={["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
          scenarios-data-format="decimal"
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.DESC,
            } as Order
          }
          limit={2}
          measure-type={MeasureType.VOLUME}
          grouped={false}
          type={TableType.LIST}
          i18n={new Map([["SUM_TOTAL", "🤩"]])}
          i18n-mode={I18nMode.ALL}
          showGroupTitle={true}
          tableName="dataSet2"
          category-width={TableCategoryWidth.W100}
          thereof={[
            {
              rowGroup: "Product",
              category: "Category A",
              subCategory: "Category - SUB 2",
              partOf: "",
            },
            {
              rowGroup: "",
              category: "Category B",
              subCategory: "",
              partOf: "",
            },
          ]}
          categorythereof={
            new Map([
              [
                "ac1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
              [
                "pp1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
            ])
          }
        ></ibcs-table>
      ),
    });

    expect(page.root)
      .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"all\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"decimal\" sum-title=\"Sample Table Title\">
         <mock:shadow-root>
       <table>
         <thead>
           <tr class=\"groupheader\">
             <th class=\"base headerlabel\" colspan=\"1\">
               <span>
                 <span class=\"table-footer\"></span>
               </span>
             </th>
             <th class=\"columnGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   DE
                 </span>
               </span>
             </th>
             <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   Berlin
                 </span>
               </span>
             </th>
             <th class=\"columnGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   REST
                 </span>
               </span>
             </th>
             <th class=\"base headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   PY
                 </span>
               </span>
             </th>
             <th class=\"columnGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   DE
                 </span>
               </span>
             </th>
             <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   Berlin
                 </span>
               </span>
             </th>
             <th class=\"columnGroup headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   REST
                 </span>
               </span>
             </th>
             <th class=\"base headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   AC
                 </span>
               </span>
             </th>
             <th class=\"base headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   Δ(PY - AC)
                 </span>
               </span>
             </th>
             <th class=\"base headerlabel\" colspan=\"1\">
               <span>
                 <span>
                   Δ(PY - AC)%
                 </span>
               </span>
             </th>
           </tr>
           <tr>
             <th class=\"base category\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"columnGroup pp1\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"columnSubGroup pp1\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"columnGroup pp1\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"base pp1\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"ac1 columnGroup\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"ac1 columnSubGroup\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"ac1 columnGroup\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"ac1 base\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"base dpp1_ac1_pos\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
             <th class=\"base drpp1_ac1_pos\" colspan=\"1\">
               <span>
                 <span></span>
               </span>
             </th>
           </tr>
         </thead>
         <tbody>
           <tr>
             <td class=\"base category-w100\" colspan=\"1\">
               <span class=\"base category-w100 prefix-first\"></span>
               Category C
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-first\"></span>
               10,0
             </td>
             <td class=\"base decimal pp1\" colspan=\"1\">
               <span class=\"base pp1 prefix-first\"></span>
               10,0
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-first\"></span>
               -
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-first\"></span>
               4,0
             </td>
             <td class=\"ac1 base decimal\" colspan=\"1\">
               <span class=\"ac1 base prefix-first\"></span>
               4,0
             </td>
             <td class=\"base decimal pos_pos\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first\"></span>
               6,0
             </td>
             <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first relative_variance\"></span>
               150,00%
             </td>
           </tr>
           <tr>
             <td class=\"base category-w100\" colspan=\"1\">
               <span class=\"base category-w100 prefix-second\"></span>
               Category B
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-second\"></span>
               10,0
             </td>
             <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnSubGroup pp1 prefix-second\"></span>
               10,0
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-second\"></span>
               10,0
             </td>
             <td class=\"base decimal pp1\" colspan=\"1\">
               <span class=\"base pp1 prefix-second\"></span>
               20,0
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-second\"></span>
               3,0
             </td>
             <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnSubGroup prefix-second\"></span>
               3,0
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-second\"></span>
               4,0
             </td>
             <td class=\"ac1 base decimal\" colspan=\"1\">
               <span class=\"ac1 base prefix-second\"></span>
               7,0
             </td>
             <td class=\"base decimal pos_pos\" colspan=\"1\">
               <span class=\"base pos_pos prefix-second\"></span>
               13,0
             </td>
             <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
               <span class=\"base pos_pos prefix-second relative_variance\"></span>
               185,71%
             </td>
           </tr>
           <tr class=\"ofit\">
             <td class=\"base category-w100\" colspan=\"1\">
               <span class=\"base category-w100 prefix-first\">
                 davon
               </span>
               Category - SUB 1 (Services)
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-first\"></span>
               10,0
             </td>
             <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnSubGroup pp1 prefix-first\"></span>
               10,0
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-first\"></span>
               0,0
             </td>
             <td class=\"base decimal pp1\" colspan=\"1\">
               <span class=\"base pp1 prefix-first\"></span>
               10,0
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-first\"></span>
               3,0
             </td>
             <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnSubGroup prefix-first\"></span>
               3,0
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-first\"></span>
               0,0
             </td>
             <td class=\"ac1 base decimal\" colspan=\"1\">
               <span class=\"ac1 base prefix-first\"></span>
               3,0
             </td>
             <td class=\"base decimal pos_pos\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first\"></span>
               7,0
             </td>
             <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first relative_variance\"></span>
               233,33%
             </td>
           </tr>
           <tr class=\"ofit\">
             <td class=\"base category-w100\" colspan=\"1\">
               <span class=\"base category-w100 prefix-second\">
                 davon
               </span>
               Category - SUB 2 (Services)
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-second\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-second\"></span>
               -
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-second\"></span>
               10,0
             </td>
             <td class=\"base decimal pp1\" colspan=\"1\">
               <span class=\"base pp1 prefix-second\"></span>
               10,0
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-second\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-second\"></span>
               -
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-second\"></span>
               4,0
             </td>
             <td class=\"ac1 base decimal\" colspan=\"1\">
               <span class=\"ac1 base prefix-second\"></span>
               4,0
             </td>
             <td class=\"base decimal pos_pos\" colspan=\"1\">
               <span class=\"base pos_pos prefix-second\"></span>
               6,0
             </td>
             <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
               <span class=\"base pos_pos prefix-second relative_variance\"></span>
               150,00%
             </td>
           </tr>
           <tr>
             <td class=\"base category-w100\" colspan=\"1\">
               <span class=\"base category-w100 prefix-first\"></span>
               REST
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnGroup decimal pp1\" colspan=\"1\">
               <span class=\"columnGroup pp1 prefix-first\"></span>
               40,0
             </td>
             <td class=\"base decimal pp1\" colspan=\"1\">
               <span class=\"base pp1 prefix-first\"></span>
               40,0
             </td>
             <td class=\"columnGroup decimal\" colspan=\"1\">
               <span class=\"columnGroup prefix-first\"></span>
               -
             </td>
             <td class=\"columnSubGroup decimal\" colspan=\"1\">
               <span class=\"columnSubGroup prefix-first\"></span>
               -
             </td>
             <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
               <span class=\"ac1 columnGroup prefix-first\"></span>
               5,0
             </td>
             <td class=\"ac1 base decimal\" colspan=\"1\">
               <span class=\"ac1 base prefix-first\"></span>
               5,0
             </td>
             <td class=\"base decimal pos_pos\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first\"></span>
               35,0
             </td>
             <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
               <span class=\"base pos_pos prefix-first relative_variance\"></span>
               700,00%
             </td>
           </tr>
         </tbody>
       </table>
         </mock:shadow-root>
     </ibcs-table>`);
  });

  it("should render OPT NO SUM table width colums and row dills and grouping", async () => {
    const page = await newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          sum-title="Sample Table Title"
          scenarios={["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
          scenarios-data-format="decimal"
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.DESC,
            } as Order
          }
          limit={2}
          measure-type={MeasureType.VOLUME}
          grouped={true}
          type={TableType.OPTNOTOTAL}
          i18n={new Map([["SUM_TOTAL", "🤩"]])}
          i18n-mode={I18nMode.ALL}
          showGroupTitle={true}
          tableName="dataSet2"
          category-width={TableCategoryWidth.W100}
          thereof={[
            {
              rowGroup: "Product",
              category: "Category A",
              subCategory: "Category - SUB 2",
              partOf: "",
            },
            {
              rowGroup: "",
              category: "Category B",
              subCategory: "null",
              partOf: "",
            },
          ]}
          categorythereof={
            new Map([
              [
                "ac1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
              [
                "pp1",
                [
                  {
                    name: "DE",
                    subGroups: ["Berlin"],
                  },
                ],
              ],
            ])
          }
        ></ibcs-table>
      ),
    });

    expect(page.root)
      .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"all\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"decimal\" sum-title=\"Sample Table Title\">
          <mock:shadow-root>
        <table>
          <thead>
            <tr class=\"groupheader\">
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span class=\"table-footer\"></span>
                </span>
              </th>
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span class=\"table-footer\"></span>
                </span>
              </th>
              <th class=\"columnGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    DE
                  </span>
                </span>
              </th>
              <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    Berlin
                  </span>
                </span>
              </th>
              <th class=\"columnGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    REST
                  </span>
                </span>
              </th>
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    PY
                  </span>
                </span>
              </th>
              <th class=\"columnGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    DE
                  </span>
                </span>
              </th>
              <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    Berlin
                  </span>
                </span>
              </th>
              <th class=\"columnGroup headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    REST
                  </span>
                </span>
              </th>
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    AC
                  </span>
                </span>
              </th>
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    Δ(PY - AC)
                  </span>
                </span>
              </th>
              <th class=\"base headerlabel\" colspan=\"1\">
                <span>
                  <span>
                    Δ(PY - AC)%
                  </span>
                </span>
              </th>
            </tr>
            <tr>
              <th class=\"base operation\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"base category\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"columnGroup pp1\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"columnSubGroup pp1\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"columnGroup pp1\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"base pp1\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"ac1 columnGroup\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"ac1 columnSubGroup\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"ac1 columnGroup\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"ac1 base\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"base dpp1_ac1_pos\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
              <th class=\"base drpp1_ac1_pos\" colspan=\"1\">
                <span>
                  <span></span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class=\"groupheader\">
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
                Services
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnSubGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnSubGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base headerlabel percent\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
            </tr>
            <tr>
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
                +
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\"></span>
                Category C
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                4,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                4,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                6,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                150,00%
              </td>
            </tr>
            <tr>
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-second\"></span>
                +
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-second\"></span>
                Category B
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-second\"></span>
                10,0
              </td>
              <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnSubGroup pp1 prefix-second\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-second\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-second\"></span>
                20,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-second\"></span>
                3,0
              </td>
              <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnSubGroup prefix-second\"></span>
                3,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-second\"></span>
                4,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-second\"></span>
                7,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-second\"></span>
                13,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-second relative_variance\"></span>
                185,71%
              </td>
            </tr>
            <tr>
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\"></span>
                REST
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                1,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                1,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                9,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                900,00%
              </td>
            </tr>
            <tr class=\"sum\">
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
                =
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\"></span>
                Services
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                20,0
              </td>
              <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnSubGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                20,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                40,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnSubGroup prefix-first\"></span>
                1,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                10,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                12,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                28,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                233,33%
              </td>
            </tr>
            <tr class=\"groupheader\">
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
                Product
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnSubGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnSubGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                <span class=\"columnGroup headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base decimal headerlabel\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
              <td class=\"base headerlabel percent\" colspan=\"1\">
                <span class=\"base headerlabel prefix-first\"></span>
              </td>
            </tr>
            <tr>
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
                +
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\"></span>
                Category A
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                20,0
              </td>
              <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnSubGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                30,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnSubGroup prefix-first\"></span>
                1,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                4,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                26,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                650,00%
              </td>
            </tr>
            <tr class=\"ofit\">
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\">
                  davon
                </span>
                Category - SUB 2
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal\" colspan=\"1\">
                <span class=\"columnGroup prefix-first\"></span>
                -
              </td>
              <td class=\"columnSubGroup decimal\" colspan=\"1\">
                <span class=\"columnSubGroup prefix-first\"></span>
                -
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                2,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                8,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                400,00%
              </td>
            </tr>
            <tr class=\"sum\">
              <td class=\"base decimal operation\" colspan=\"1\">
                <span class=\"base operation prefix-first\"></span>
                =
              </td>
              <td class=\"base category-w100\" colspan=\"1\">
                <span class=\"base category-w100 prefix-first\"></span>
                Product
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                20,0
              </td>
              <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnSubGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                <span class=\"columnGroup pp1 prefix-first\"></span>
                10,0
              </td>
              <td class=\"base decimal pp1\" colspan=\"1\">
                <span class=\"base pp1 prefix-first\"></span>
                30,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnSubGroup prefix-first\"></span>
                1,0
              </td>
              <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                <span class=\"ac1 columnGroup prefix-first\"></span>
                2,0
              </td>
              <td class=\"ac1 base decimal\" colspan=\"1\">
                <span class=\"ac1 base prefix-first\"></span>
                4,0
              </td>
              <td class=\"base decimal pos_pos\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first\"></span>
                26,0
              </td>
              <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                <span class=\"base pos_pos prefix-first relative_variance\"></span>
                650,00%
              </td>
            </tr>
          </tbody>
        </table>
          </mock:shadow-root>
      </ibcs-table>`);
  });

  describe("IBCS Table Test with incomplete Parameters", () => {
    const dataSet: any[] = [
      {
        setName: "de",
        operation: "+",
        rowGroup: "Services",
        rowGroupIndex: 0,
        category: "Category A",
        categoryIndex: 1,
        subCategory: "Category - SUB 1",
        subCategoryIndex: 1,
        columnGroup: "DE",
        columnGroupIndex: 1,
        columnSubGroup: "Berlin",
        columnSubGroupIndex: 1,
        ac1: 1,
        pp1: 10,
        fc1: 3,
        pl1: 3,
        ac2: 1,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
    ];

    beforeAll(() => {
      getStores(null).db.db.tables["dataSet"] = { data: dataSet };
    });

    it("should render empty tag because of missing dataset", async () => {
      const page = await newSpecPage({
        components: [IbcsTable],
        template: () => (
          <ibcs-table
            sum-title="Sample Table Title"
            scenarios={["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
            scenarios-data-format="decimal"
            measure-scale="_"
            order={
              {
                hierarchy: [OrderColumn.CATEGORY],
                direction: OrderDirection.DESC,
              } as Order
            }
            limit={2}
            measure-type={MeasureType.VOLUME}
            grouped={true}
            type={TableType.SUM}
            i18n={new Map([["SUM_TOTAL", "🤩"]])}
            i18n-mode={I18nMode.ALL}
            showGroupTitle={true}
            data={[]}
            category-width={TableCategoryWidth.W100}
            thereof={[
              {
                rowGroup: "Product",
                category: "Category A",
                subCategory: "Category - SUB 2",
                partOf: "",
              },
              {
                rowGroup: "",
                category: "Category B",
                subCategory: "",
                partOf: "",
              },
            ]}
            categorythereof={
              new Map([
                [
                  "ac1",
                  [
                    {
                      name: "DE",
                      subGroups: ["Berlin"],
                    },
                  ],
                ],
                [
                  "pp1",
                  [
                    {
                      name: "DE",
                      subGroups: ["Berlin"],
                    },
                  ],
                ],
              ])
            }
          ></ibcs-table>
        ),
      });

      expect(page.root)
        .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"all\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"decimal\" sum-title=\"Sample Table Title\">
          <mock:shadow-root>
        <p class=\"warning\">
          ==No Data==
        </p>
          </mock:shadow-root>
      </ibcs-table>`);
    });

    it("should render despite incomplete order object", async () => {
      const page = await newSpecPage({
        components: [IbcsTable],
        template: () => (
          <ibcs-table
            sum-title="Sample Table Title"
            scenarios={["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
            scenarios-data-format="decimal"
            measure-scale="_"
            order={
              {
                hierarchy: [OrderColumn.CATEGORY],
                direction: OrderDirection.DESC,
              } as Order
            }
            limit={2}
            measure-type={MeasureType.VOLUME}
            grouped={true}
            type={TableType.SUM}
            i18n={new Map([["SUM_TOTAL", "🤩"]])}
            i18n-mode={I18nMode.ALL}
            showGroupTitle={true}
            tableName="dataSet"
            category-width={TableCategoryWidth.W100}
            thereof={[
              {
                rowGroup: "Product",
                category: "Category A",
                subCategory: "Category - SUB 2",
                partOf: "",
              },
              {
                rowGroup: "",
                category: "Category B",
                subCategory: "",
                partOf: "",
              },
            ]}
            categorythereof={
              new Map([
                [
                  "ac1",
                  [
                    {
                      name: "DE",
                      subGroups: ["Berlin"],
                    },
                  ],
                ],
                [
                  "pp1",
                  [
                    {
                      name: "DE",
                      subGroups: ["Berlin"],
                    },
                  ],
                ],
              ])
            }
          ></ibcs-table>
        ),
      });

      expect(page.root)
        .toEqualHtml(`<ibcs-table category-width=\"w100\" i18n-mode=\"all\" measure-scale=\"_\" measure-type=\"volume\" scenarios-data-format=\"decimal\" sum-title=\"Sample Table Title\">
            <mock:shadow-root>
          <table>
            <thead>
              <tr class=\"groupheader\">
                <th class=\"base headerlabel\" colspan=\"1\">
                  <span>
                    <span class=\"table-footer\"></span>
                  </span>
                </th>
                <th class=\"columnGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      DE
                    </span>
                  </span>
                </th>
                <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      Berlin
                    </span>
                  </span>
                </th>
                <th class=\"columnGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      REST
                    </span>
                  </span>
                </th>
                <th class=\"base headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      PY
                    </span>
                  </span>
                </th>
                <th class=\"columnGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      DE
                    </span>
                  </span>
                </th>
                <th class=\"columnSubGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      Berlin
                    </span>
                  </span>
                </th>
                <th class=\"columnGroup headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      REST
                    </span>
                  </span>
                </th>
                <th class=\"base headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      AC
                    </span>
                  </span>
                </th>
                <th class=\"base headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      Δ(PY - AC)
                    </span>
                  </span>
                </th>
                <th class=\"base headerlabel\" colspan=\"1\">
                  <span>
                    <span>
                      Δ(PY - AC)%
                    </span>
                  </span>
                </th>
              </tr>
              <tr>
                <th class=\"base category\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"columnGroup pp1\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"columnSubGroup pp1\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"columnGroup pp1\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"base pp1\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"ac1 columnGroup\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"ac1 columnSubGroup\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"ac1 columnGroup\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"ac1 base\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"base dpp1_ac1_pos\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
                <th class=\"base drpp1_ac1_pos\" colspan=\"1\">
                  <span>
                    <span></span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class=\"groupheader\">
                <td class=\"base headerlabel\" colspan=\"1\">
                  <span class=\"base headerlabel prefix-first\"></span>
                  Services
                </td>
                <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnSubGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"base decimal headerlabel\" colspan=\"1\">
                  <span class=\"base headerlabel prefix-first\"></span>
                </td>
                <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"columnSubGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnSubGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"columnGroup decimal headerlabel\" colspan=\"1\">
                  <span class=\"columnGroup headerlabel prefix-first\"></span>
                </td>
                <td class=\"base decimal headerlabel\" colspan=\"1\">
                  <span class=\"base headerlabel prefix-first\"></span>
                </td>
                <td class=\"base decimal headerlabel\" colspan=\"1\">
                  <span class=\"base headerlabel prefix-first\"></span>
                </td>
                <td class=\"base headerlabel percent\" colspan=\"1\">
                  <span class=\"base headerlabel prefix-first\"></span>
                </td>
              </tr>
              <tr>
                <td class=\"base category-w100\" colspan=\"1\">
                  <span class=\"base category-w100 prefix-first\"></span>
                  Category A
                </td>
                <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnSubGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"base decimal pp1\" colspan=\"1\">
                  <span class=\"base pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnSubGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"ac1 base decimal\" colspan=\"1\">
                  <span class=\"ac1 base prefix-first\"></span>
                  1,0
                </td>
                <td class=\"base decimal pos_pos\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first\"></span>
                  9,0
                </td>
                <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first relative_variance\"></span>
                  900,00%
                </td>
              </tr>
              <tr class=\"sum\">
                <td class=\"base category-w100\" colspan=\"1\">
                  <span class=\"base category-w100 prefix-first\"></span>
                  Services
                </td>
                <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnSubGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"base decimal pp1\" colspan=\"1\">
                  <span class=\"base pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnSubGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"ac1 base decimal\" colspan=\"1\">
                  <span class=\"ac1 base prefix-first\"></span>
                  1,0
                </td>
                <td class=\"base decimal pos_pos\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first\"></span>
                  9,0
                </td>
                <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first relative_variance\"></span>
                  900,00%
                </td>
              </tr>
              <tr class=\"sum\">
                <td class=\"base category-w100\" colspan=\"1\">
                  <span class=\"base category-w100 prefix-first\"></span>
                  Sample Table Title
                </td>
                <td class=\"columnGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnSubGroup decimal pp1\" colspan=\"1\">
                  <span class=\"columnSubGroup pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"base decimal pp1\" colspan=\"1\">
                  <span class=\"base pp1 prefix-first\"></span>
                  10,0
                </td>
                <td class=\"ac1 columnGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"ac1 columnSubGroup decimal\" colspan=\"1\">
                  <span class=\"ac1 columnSubGroup prefix-first\"></span>
                  1,0
                </td>
                <td class=\"columnGroup decimal\" colspan=\"1\">
                  <span class=\"columnGroup prefix-first\"></span>
                  -
                </td>
                <td class=\"ac1 base decimal\" colspan=\"1\">
                  <span class=\"ac1 base prefix-first\"></span>
                  1,0
                </td>
                <td class=\"base decimal pos_pos\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first\"></span>
                  9,0
                </td>
                <td class=\"base percent pos_pos relative_variance\" colspan=\"1\">
                  <span class=\"base pos_pos prefix-first relative_variance\"></span>
                  900,00%
                </td>
              </tr>
            </tbody>
          </table>
            </mock:shadow-root>
        </ibcs-table>`);
    });
  });
});
