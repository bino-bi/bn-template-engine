// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it) - same pattern as bn-table.layout-state.spec.tsx.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

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
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../context/context-protocol";
import { ErrorItem } from "../../utils/withHasError";
import { Table } from "./bn-table";
import { BnTableRenderer } from "./bn-table-renderer/bn-table-renderer";

const row = (setname: string, setnameIndex: number | undefined, ac1: number) => ({
  operation: "+",
  category: "Hamburg",
  categoryIndex: 1,
  setname,
  setnameIndex,
  ac1,
});

describe("bn-table: categoryIntervalPosition and setnameIndex", () => {
  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["positionDs"] = { data: [row("YTD", 2, 30), row("Jan", 0, 10), row("Feb", 1, 20)] };
    tables["orphanIndexDs"] = { data: [row("Jan", 0, 10), row("", 1, 20)] };
    tables["noIndexDs"] = { data: [row("Jan", undefined, 10), row("", undefined, 20)] };
  });

  const renderTable = async (props: Record<string, unknown> = {}): Promise<SpecPage> => {
    const attrs: Record<string, unknown> = {
      datasets: "positionDs",
      scenarios: "ac1",
      interval: "setname",
      "measure-scale": "_",
      scale: "none",
      ...props,
    };
    const page = await newSpecPage({
      components: [Table, BnTableRenderer],
      template: () => <bn-table {...attrs}></bn-table>,
    });
    await page.waitForChanges();
    return page;
  };

  const inner = (page: SpecPage): Element => page.root.shadowRoot.querySelector("bn-table-renderer");
  const firstBodyRow = (page: SpecPage): string[] =>
    Array.from(inner(page).shadowRoot.querySelectorAll("tbody tr:first-child td")).map((cell) =>
      cell.textContent.trim(),
    );
  const warnings = (page: SpecPage): string[] =>
    (JSON.parse(page.root.getAttribute("has-error") ?? "[]") as ErrorItem[])
      .map((e) => e.id)
      .filter((id) => id.startsWith("WARN_categoryInterval") || id.startsWith("WARN_interval"));

  it("reads the attribute category-interval-position", async () => {
    const page = await renderTable({ "category-interval-position": "2" });

    expect(firstBodyRow(page)).toEqual(["10.0", "20.0", "Hamburg", "30.0"]);
    expect(warnings(page)).toEqual([]);
  });

  it.each(["-1", "1.5", "abc"])("warns for the value %s and treats it as 0", async (value) => {
    const page = await renderTable({ "category-interval-position": value });

    expect(firstBodyRow(page)).toEqual(["Hamburg", "10.0", "20.0", "30.0"]);
    expect(warnings(page)).toEqual(["WARN_categoryIntervalPosition"]);
  });

  it("warns when the position is greater than the number of groups", async () => {
    const page = await renderTable({ "category-interval-position": "4" });

    expect(firstBodyRow(page)).toEqual(["10.0", "20.0", "30.0", "Hamburg"]);
    expect(warnings(page)).toEqual(["WARN_categoryIntervalPositionRange"]);
  });

  it("warns when the interval is ignored because of columnthereof", async () => {
    const page = await renderTable({
      "category-interval-position": "1",
      columnthereof: '[{"scenario": "ac1", "name": "DE", "subGroups": []}]',
    });

    expect(firstBodyRow(page)[0]).toBe("Hamburg");
    expect(warnings(page).sort()).toEqual(["WARN_categoryIntervalPositionNoInterval", "WARN_intervalConflict"]);
  });

  it("warns for rows with a setnameIndex but no setname", async () => {
    const page = await renderTable({ datasets: "orphanIndexDs" });

    expect(warnings(page).sort()).toEqual(["WARN_intervalSetname", "WARN_intervalSetnameIndex"]);
  });

  it("does not check the setnameIndex without interval setname", async () => {
    const page = await renderTable({ datasets: "orphanIndexDs", interval: "none" });

    expect(warnings(page)).toEqual([]);
  });

  it("does not ask for a setnameIndex", async () => {
    const page = await renderTable({ datasets: "noIndexDs" });

    expect(warnings(page)).toEqual(["WARN_intervalSetname"]);
  });
});
