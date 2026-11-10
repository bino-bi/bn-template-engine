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
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { TableAttribute } from "../utils/model/TableAttribute";
import { ErrorDispatcher, ErrorReport } from "../../../utils/withHasError";

describe("IBCS Table categoryIntervalPosition", () => {
  const setRow = (rowGroup: string, category: string, setname: string, setnameIndex: number, ac1: number) => ({
    operation: rowGroup === "Kosten" ? "-" : "+",
    rowGroup,
    rowGroupIndex: rowGroup === "Kosten" ? 1 : 0,
    category,
    categoryIndex: category === "Hamburg" ? 1 : 2,
    subCategory: category === "Hamburg" ? "Nord" : "Ost",
    _leiter: "Huber",
    setname,
    setnameIndex,
    ac1,
    pl1: ac1 + 1,
  });

  // the YTD rows come first in the data, setnameIndex puts them last
  const setRows: any[] = [
    setRow("Umsatz", "Hamburg", "YTD", 3, 60),
    setRow("Umsatz", "Hamburg", "Jan", 0, 10),
    setRow("Umsatz", "Hamburg", "Feb", 1, 20),
    setRow("Umsatz", "Hamburg", "Mar", 2, 30),
    setRow("Kosten", "Personal", "YTD", 3, 6),
    setRow("Kosten", "Personal", "Jan", 0, 1),
    setRow("Kosten", "Personal", "Feb", 1, 2),
    setRow("Kosten", "Personal", "Mar", 2, 3),
  ];

  const yearRows: any[] = [
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2023-03-10", ac1: 10 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2024-05-20", ac1: 20 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2025-05-20", ac1: 30 },
  ];

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["thereof", "davon"],
  ]);

  let reports: Map<string, ErrorReport>;
  const errors = {
    addOrReplace: (report: ErrorReport) => reports.set(report.id, report),
    remove: (id: string) => reports.delete(id),
  } as unknown as ErrorDispatcher;

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["positionSets"] = { data: setRows };
    tables["positionYears"] = { data: yearRows };
  });

  beforeEach(() => {
    reports = new Map();
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          measure-scale="_"
          order={{ hierarchy: [OrderColumn.CATEGORY], direction: OrderDirection.ASC } as Order}
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="positionSets"
          interval="setname"
          errors={errors}
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const headerRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("thead tr"));
  const bodyRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));
  const texts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent.trim());
  const classes = (row: Element): string[] =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => cell.getAttribute("class"));
  const colSpans = (row: Element): string[] =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => cell.getAttribute("colspan"));
  const findRow = (page: SpecPage, text: string): Element => bodyRows(page).find((row) => texts(row).includes(text));
  const warningIds = (): string[] => [...reports.keys()].filter((id) => id.startsWith("WARN_categoryInterval"));

  it("keeps the category column first with position 0", async () => {
    const page = await renderTable();

    expect(texts(headerRows(page)[0])).toEqual(["", "Jan", "Feb", "Mar", "YTD"]);
    expect(texts(findRow(page, "Hamburg"))).toEqual(["Hamburg", "10.0", "20.0", "30.0", "60.0"]);
    expect(warningIds()).toEqual([]);
  });

  it("puts the interval groups left of the category column", async () => {
    const page = await renderTable({ categoryIntervalPosition: 3, scenarios: ["ac1", "pl1"] });
    const [band, labels, separator] = headerRows(page);

    expect(texts(band)).toEqual(["Jan", "Feb", "Mar", "", "YTD"]);
    expect(colSpans(band)).toEqual(["2", "2", "2", "1", "2"]);
    expect(classes(band)[3]).toContain("filler");
    // the rule set puts PL before AC
    expect(texts(labels)).toEqual(["PL", "AC", "PL", "AC", "PL", "AC", "", "PL", "AC"]);
    expect(classes(separator).map((name) => name.split(" ")[0])).toEqual([
      ...["pl1", "ac1", "pl1", "ac1", "pl1", "ac1"],
      "category",
      ...["pl1", "ac1"],
    ]);
    expect(texts(findRow(page, "Hamburg"))).toEqual([
      ...["11.0", "10.0", "21.0", "20.0", "31.0", "30.0"],
      "Hamburg",
      ...["61.0", "60.0"],
    ]);
    expect(texts(findRow(page, "Summe"))).toEqual([
      ...["9.0", "9.0", "18.0", "18.0", "27.0", "27.0"],
      "Summe",
      ...["54.0", "54.0"],
    ]);
    expect(warningIds()).toEqual([]);
  });

  it("puts the category column last when the position is the number of groups", async () => {
    const page = await renderTable({ categoryIntervalPosition: 4 });

    expect(texts(headerRows(page)[0])).toEqual(["Jan", "Feb", "Mar", "YTD", ""]);
    expect(texts(findRow(page, "Hamburg"))).toEqual(["10.0", "20.0", "30.0", "60.0", "Hamburg"]);
    expect(warningIds()).toEqual([]);
  });

  it("warns and uses the number of groups when the position is greater", async () => {
    const page = await renderTable({ categoryIntervalPosition: 7 });

    expect(texts(findRow(page, "Hamburg"))).toEqual(["10.0", "20.0", "30.0", "60.0", "Hamburg"]);
    expect(warningIds()).toEqual(["WARN_categoryIntervalPositionRange"]);
    expect(reports.get("WARN_categoryIntervalPositionRange")).toEqual({
      id: "WARN_categoryIntervalPositionRange",
      type: "warning",
      message: "categoryIntervalPosition: '7' is greater than the number of interval groups, 4 is used.",
    });
  });

  it("warns and ignores the position without an interval", async () => {
    const page = await renderTable({ categoryIntervalPosition: 1, interval: "none" });

    expect(texts(findRow(page, "Hamburg"))).toEqual(["Hamburg", "120.0"]);
    expect(warningIds()).toEqual(["WARN_categoryIntervalPositionNoInterval"]);
    expect(reports.get("WARN_categoryIntervalPositionNoInterval").message).toBe(
      "categoryIntervalPosition: needs an active interval, the value is ignored.",
    );
  });

  it("warns and ignores the position when columnthereof switches the interval off", async () => {
    const page = await renderTable({
      categoryIntervalPosition: 1,
      categorythereof: new Map([["ac1", [{ scenario: "ac1", name: "DE", subGroups: [] }]]]),
    });

    expect(headerRows(page).length).toBe(2);
    expect(texts(findRow(page, "Hamburg"))[0]).toBe("Hamburg");
    expect(warningIds()).toEqual(["WARN_categoryIntervalPositionNoInterval"]);
  });

  it("removes the warning when the position fits again", async () => {
    const page = await renderTable({ categoryIntervalPosition: 7 });
    expect(warningIds()).toEqual(["WARN_categoryIntervalPositionRange"]);

    (page.root as any).categoryIntervalPosition = 2;
    await page.waitForChanges();

    expect(warningIds()).toEqual([]);
  });

  it("moves the category cell of group head, group sum and total rows", async () => {
    const page = await renderTable({ categoryIntervalPosition: 2, grouped: true, showGroupTitle: true });

    expect(bodyRows(page).map((row) => texts(row))).toEqual([
      ["", "", "Umsatz", "", ""],
      ["10.0", "20.0", "Hamburg", "30.0", "60.0"],
      ["10.0", "20.0", "Umsatz", "30.0", "60.0"],
      ["", "", "Kosten", "", ""],
      ["-1.0", "-2.0", "Personal", "-3.0", "-6.0"],
      ["-1.0", "-2.0", "Kosten", "-3.0", "-6.0"],
      ["9.0", "18.0", "Summe", "27.0", "54.0"],
    ]);
  });

  it("moves the category cell of thereof rows", async () => {
    const page = await renderTable({
      categoryIntervalPosition: 2,
      thereof: [{ rowGroup: "", category: "Hamburg", subCategory: "", partOf: "" }],
    });
    const nord = bodyRows(page).find((row) => row.getAttribute("class")?.includes("ofit"));

    expect(texts(nord)).toEqual(["10.0", "20.0", "davon Nord", "30.0", "60.0"]);
  });

  it("moves the operation column and the attribute columns with the category column", async () => {
    const page = await renderTable({
      categoryIntervalPosition: 1,
      type: TableType.OPT,
      attributeColumns: [new TableAttribute("Leiter", "attr_0", "set", "_leiter")],
    });
    const [band, labels] = headerRows(page);

    expect(texts(band)).toEqual(["Jan", "", "", "", "Feb", "Mar", "YTD"]);
    expect(texts(labels)).toEqual(["AC", "", "", "Leiter", "AC", "AC", "AC"]);
    expect(texts(findRow(page, "Hamburg"))).toEqual(["10.0", "+", "Hamburg", "Huber", "20.0", "30.0", "60.0"]);
    expect(texts(findRow(page, "Personal"))).toEqual(["1.0", "-", "Personal", "Huber", "2.0", "3.0", "6.0"]);
  });

  it("keeps the category width class on the moved cell", async () => {
    const page = await renderTable({ categoryIntervalPosition: 2, categoryWidth: "w15" });

    expect(classes(findRow(page, "Hamburg")).map((name) => name.includes("category-w15"))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("draws the bars of the groups on both sides of the category column", async () => {
    const page = await renderTable({
      categoryIntervalPosition: 2,
      scenarios: ["dac1_pl1_pos"],
      barColumns: ["dac1_pl1_pos"],
    });
    const cells = Array.from(findRow(page, "Hamburg").querySelectorAll("td"));

    expect(cells.map((cell) => cell.querySelector("svg") !== null)).toEqual([true, true, false, true, true]);
  });

  it("works with a date interval", async () => {
    const page = await renderTable({ categoryIntervalPosition: 1, tableName: "positionYears", interval: "year" });

    expect(texts(headerRows(page)[0])).toEqual(["2023", "", "2024", "2025"]);
    expect(texts(findRow(page, "Hamburg"))).toEqual(["10.0", "Hamburg", "20.0", "30.0"]);
    expect(warningIds()).toEqual([]);
  });

  it("lists the columns of the layout state in render order", async () => {
    const page = await renderTable({ categoryIntervalPosition: 1 });
    const detail = await (page.root as any).getLayoutDetail(
      { context: { x: 0, y: 0 }, component: { x: 0, y: 0 } },
      "full",
    );

    expect(detail.table.columns.map((column: any) => column.bucket ?? column.key)).toEqual([
      "Jan",
      "category",
      "Feb",
      "Mar",
      "YTD",
    ]);
  });
});
