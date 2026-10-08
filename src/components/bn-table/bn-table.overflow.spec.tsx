// A bn-table whose rendered height exceeds its constrained parent must publish
// WARN_overflow, as the charts do (bn-chart-structure.checkOverflow). The
// table only fits and measures width, so without this check the host stays
// silent and the layout-page slot wrapper (overflow: hidden) clips the
// bottom rows.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../../utils/withTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

// A 2x2 cell on an xga landscape page: 512 px wide, ~326 px tall.
jest.mock("../../utils/parentDimensions", () => ({
  getParentDimensions: () => ({ width: 512, height: 326 }),
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

import { forceUpdate } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { ErrorItem } from "../../utils/withHasError";
import { Table } from "./bn-table";
import { BnTableRenderer } from "./bn-table-renderer/bn-table-renderer";

// mock-doc has no layout: pretend the host rendered 400 px wide (fits the
// 512 px cell) but `height` px tall.
const stubSize = (page: SpecPage, height: number): void => {
  Object.defineProperty(page.root!, "scrollWidth", { get: () => 400, configurable: true });
  Object.defineProperty(page.root!, "scrollHeight", { get: () => height, configurable: true });
};

// 672 px is the measured height of the clipped table in the reported page.
const renderTable = async (attrs: string, height = 672): Promise<SpecPage> => {
  const page = await newSpecPage({
    components: [Table, BnTableRenderer],
    html: `<bn-table ${attrs}></bn-table>`,
  });
  stubSize(page, height);
  // The stubs are only visible to the next measurement, and a table with a
  // fixed scale would otherwise never render again in this harness.
  forceUpdate(page.root!);
  await page.waitForChanges();
  await page.waitForChanges();
  return page;
};

const hostErrors = (page: SpecPage): string => page.root!.getAttribute("has-error") ?? "";

const overflowItem = (page: SpecPage): ErrorItem | undefined => {
  const raw = hostErrors(page);
  if (raw === "") return undefined;
  return (JSON.parse(raw) as ErrorItem[]).find((item) => item.id === "WARN_overflow");
};

describe("bn-table height overflow", () => {
  it("publishes WARN_overflow when the table is taller than its constrained parent (default scale)", async () => {
    const page = await renderTable("");
    expect(hostErrors(page)).toContain("WARN_overflow");
  });

  it("publishes WARN_overflow with scale=none", async () => {
    const page = await renderTable(`scale="none"`);
    expect(hostErrors(page)).toContain("WARN_overflow");
  });

  it("publishes WARN_overflow with a fixed scale factor", async () => {
    const page = await renderTable(`scale="0.7"`);
    expect(hostErrors(page)).toContain("WARN_overflow");
  });

  it("reports the measured magnitude", async () => {
    const page = await renderTable("");
    expect(overflowItem(page)?.message).toContain("Table exceeds available height (672px > 326px).");
  });

  it("stays silent when the table fits", async () => {
    const page = await renderTable("", 200);
    expect(hostErrors(page)).not.toContain("WARN_overflow");
  });

  it("removes the entry once the table fits again", async () => {
    const page = await renderTable("");
    expect(hostErrors(page)).toContain("WARN_overflow");

    stubSize(page, 200);
    forceUpdate(page.root!);
    await page.waitForChanges();

    expect(hostErrors(page)).not.toContain("WARN_overflow");
  });

  describe("severity", () => {
    it("is a warning in auto mode - the author did not pin the size", async () => {
      const page = await renderTable("");
      expect(overflowItem(page)?.type).toBe("warning");
    });

    it("is an error with scale=none", async () => {
      const page = await renderTable(`scale="none"`);
      expect(overflowItem(page)?.type).toBe("error");
    });

    it("is an error with a fixed scale factor", async () => {
      const page = await renderTable(`scale="0.7"`);
      expect(overflowItem(page)?.type).toBe("error");
    });
  });
});
