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
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { IbcsTable } from "./ibcs-table";
import { OrderDirection, TableType } from "./utils/model";
import { I18nMode } from "../../utils/constants";
import { Order, OrderColumn } from "../../utils/model/Order";
import { TableAttribute } from "./utils/model/TableAttribute";

describe("IBCS Table attribute columns", () => {
  const attrRows: any[] = [
    {
      setName: "de",
      operation: "+",
      rowGroup: "Umsatz",
      rowGroupIndex: 0,
      category: "Hamburg",
      categoryIndex: 1,
      subCategory: "Nord",
      subCategoryIndex: 1,
      ac1: 10,
      _leiter: "Meier",
    },
    {
      setName: "de",
      operation: "-",
      rowGroup: "Umsatz",
      rowGroupIndex: 0,
      category: "Hamburg",
      categoryIndex: 1,
      subCategory: "Nord",
      subCategoryIndex: 1,
      ac1: 4,
      _leiter: "Schulz",
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Umsatz",
      rowGroupIndex: 0,
      category: "Hamburg",
      categoryIndex: 1,
      subCategory: "Süd",
      subCategoryIndex: 2,
      ac1: 2,
      _leiter: "Meier",
    },
    {
      setName: "de",
      operation: "+",
      rowGroup: "Umsatz",
      rowGroupIndex: 0,
      category: "München",
      categoryIndex: 2,
      subCategory: "Ost",
      subCategoryIndex: 1,
      ac1: 5,
      _leiter: "Huber",
    },
  ];

  const attributeColumns = [
    new TableAttribute("Verkaufsleiter", "attr_0", "set", "_leiter"),
    new TableAttribute("Umsatz gesamt", "attr_1", "sum", "ac1"),
    new TableAttribute("Konstante", "attr_2", "lit", "Fix"),
  ];

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["there_of", "davon"],
    ["part_of", "anteil an"],
  ]);

  beforeAll(() => {
    getStores(null).db.db.tables["attrData"] = { data: attrRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
          scenarios={["ac1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.ASC,
            } as Order
          }
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="attrData"
          attributeColumns={attributeColumns}
          {...extraProps}
        ></ibcs-table>
      ),
    });

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes(text),
    );

  it("renders attribute header columns between category and scenarios", async () => {
    const page = await renderTable();

    const headerCells = Array.from(page.root.shadowRoot.querySelector("thead tr").querySelectorAll("th")).map((cell) =>
      cell.textContent.trim(),
    );

    expect(headerCells[1]).toBe("Verkaufsleiter");
    expect(headerCells[2]).toBe("Umsatz gesamt");
    expect(headerCells[3]).toBe("Konstante");
  });

  it("renders set/sum/lit values per data row", async () => {
    const page = await renderTable();

    // sum(ac1) respects the operation sign: 10 - 4 + 2 = 8, formatted like a scenario cell
    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "Meier, Schulz", "8.0", "Fix", "8.0"]);
    expect(cellTexts(findRowByFirstCell(page, "München"))).toEqual(["München", "Huber", "5.0", "Fix", "5.0"]);
  });

  it("leaves attribute cells blank on the total sum row", async () => {
    const page = await renderTable();

    expect(cellTexts(findRowByFirstCell(page, "Summe"))).toEqual(["Summe", "", "", "", "13.0"]);
  });

  it("leaves attribute cells blank on group head and group sum rows", async () => {
    const page = await renderTable({ grouped: true, showGroupTitle: true });

    const rows = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));
    const groupHead = rows.find((row) => row.getAttribute("class")?.includes("groupheader"));
    const sumRows = rows.filter((row) => row.getAttribute("class")?.includes("sum"));

    expect(cellTexts(groupHead).slice(1, 4)).toEqual(["", "", ""]);
    expect(sumRows.length).toBeGreaterThan(0);
    sumRows.forEach((row) => {
      expect(cellTexts(row).slice(1, 4)).toEqual(["", "", ""]);
    });
  });

  it("computes attribute values on thereof drill rows", async () => {
    const page = await renderTable({
      thereof: [{ rowGroup: "", category: "Hamburg", subCategory: "", partOf: "" }],
    });

    const nord = findRowByFirstCell(page, "Nord");
    const sued = findRowByFirstCell(page, "Süd");

    expect(cellTexts(nord).slice(1, 4)).toEqual(["Meier, Schulz", "6.0", "Fix"]);
    expect(cellTexts(sued).slice(1, 4)).toEqual(["Meier", "2.0", "Fix"]);
  });

  it("leaves attribute cells blank on partof percentage rows", async () => {
    const page = await renderTable({
      partof: [{ rowGroup: "Umsatz", category: "Hamburg", subCategory: "", partOf: "" }],
    });

    const partRow = findRowByFirstCell(page, "anteil an");

    expect(partRow).toBeDefined();
    expect(cellTexts(partRow).slice(1, 4)).toEqual(["", "", ""]);
  });

  it("leaves attribute cells blank on REST rows when a limit applies", async () => {
    const page = await renderTable({ limit: 1 });

    const restRow = findRowByFirstCell(page, "REST");

    expect(restRow).toBeDefined();
    expect(cellTexts(restRow).slice(1, 4)).toEqual(["", "", ""]);
  });

  it("renders attributes after category in opt tables, with plain sums", async () => {
    const page = await renderTable({ type: TableType.OPT });

    const headerCells = Array.from(page.root.shadowRoot.querySelector("thead tr").querySelectorAll("th")).map((cell) =>
      cell.textContent.trim(),
    );
    // opt tables prepend the operation column; attributes follow the category column
    expect(headerCells[2]).toBe("Verkaufsleiter");
    expect(headerCells[3]).toBe("Umsatz gesamt");
    expect(headerCells[4]).toBe("Konstante");

    // opt groups by operation: Hamburg splits into a "+" row (10 + 2) and a "-" row (4),
    // and sum(ac1) does NOT multiply by the operation sign (it is baked into the rows)
    const rows = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));
    const hamburgRows = rows.filter((row) => cellTexts(row)[1] === "Hamburg");
    const plus = hamburgRows.find((row) => cellTexts(row)[0] === "+");
    const minus = hamburgRows.find((row) => cellTexts(row)[0] === "-");

    expect(cellTexts(plus).slice(2, 5)).toEqual(["Meier", "12.0", "Fix"]);
    expect(cellTexts(minus).slice(2, 5)).toEqual(["Schulz", "4.0", "Fix"]);
  });
});
