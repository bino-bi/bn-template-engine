// bn-table scaling resolution: units-per-em attribute values are converted
// to the inner bn-table-renderer's em-per-unit quantities at the wrapper boundary.
//
// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

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
    scalingGroups: createStore({ "table-scale": 50, "pct-scale": 4 }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { AutoScalingReport } from "../../utils/scaling";
import { Table } from "./bn-table";
import { BnTableRenderer } from "./bn-table-renderer/bn-table-renderer";

type InnerTable = HTMLElement & {
  unitScaling: number;
  percentageScaling: number;
  reportAutoScaling?: (report: AutoScalingReport) => void;
};

const renderTable = async (attrs: string): Promise<{ page: SpecPage; inner: InnerTable }> => {
  const page = await newSpecPage({
    components: [Table, BnTableRenderer],
    html: `<bn-table ${attrs}></bn-table>`,
  });
  const inner = page.root!.shadowRoot!.querySelector("bn-table-renderer") as InnerTable;
  return { page, inner };
};

const hostErrors = (page: SpecPage): string => page.root!.getAttribute("has-error") ?? "";

describe("bn-table scaling defaults", () => {
  it("converts the defaults 100/2 to the previous inner values 0.01/0.5 exactly", async () => {
    const { inner } = await renderTable("");

    expect(inner.unitScaling).toBe(0.01);
    expect(inner.percentageScaling).toBe(0.5);
  });
});

describe("bn-table scaling resolution", () => {
  it("passes the auto sentinel through without warnings", async () => {
    const { page, inner } = await renderTable(`unit-scaling="auto" percentage-scaling="auto"`);

    expect(inner.unitScaling).toBe(0);
    expect(inner.percentageScaling).toBe(0);
    expect(hostErrors(page)).not.toContain("AUTO_unitScaling");
    expect(hostErrors(page)).not.toContain("ERR_unitScaling");
  });

  it("resolves SI-suffixed values as units per em", async () => {
    const { inner } = await renderTable(`unit-scaling="1k"`);

    expect(inner.unitScaling).toBe(1 / 1000);
  });

  it("resolves a scaling group to the same value as the equivalent number", async () => {
    const { inner: viaGroup } = await renderTable(`unit-scaling="table-scale" percentage-scaling="pct-scale"`);
    const { inner: viaNumber } = await renderTable(`unit-scaling="50" percentage-scaling="4"`);

    expect(viaGroup.unitScaling).toBe(0.02);
    expect(viaNumber.unitScaling).toBe(0.02);
    expect(viaGroup.percentageScaling).toBe(0.25);
    expect(viaNumber.percentageScaling).toBe(0.25);
  });

  it("falls back to auto with AUTO_* and ERR_* warnings on invalid values", async () => {
    const { page, inner } = await renderTable(`unit-scaling="banana"`);

    expect(inner.unitScaling).toBe(0);
    expect(hostErrors(page)).toContain("AUTO_unitScaling");
    expect(hostErrors(page)).toContain("ERR_unitScaling");
  });

  it("treats an unknown group name like an invalid value (auto + warnings)", async () => {
    const { page, inner } = await renderTable(`percentage-scaling="no-such-group"`);

    expect(inner.percentageScaling).toBe(0);
    expect(hostErrors(page)).toContain("AUTO_percentageScaling");
    expect(hostErrors(page)).toContain("ERR_percentageScaling");
  });
});

describe("bn-table auto-fit reporting", () => {
  it("surfaces the auto-fitted value in the AUTO_unitScaling warning in units per em", async () => {
    const { page, inner } = await renderTable(`unit-scaling="banana"`);

    // Inner reports em-per-unit 0.05 -> 1 em = 20 units.
    inner.reportAutoScaling!({ unit: 0.05 });

    expect(hostErrors(page)).toContain("AUTO_unitScaling");
    expect(hostErrors(page)).toContain("20");
  });

  it("does not rewrite the warning when the value was explicitly auto", async () => {
    const { page, inner } = await renderTable(`unit-scaling="auto"`);

    inner.reportAutoScaling!({ unit: 0.05 });

    expect(hostErrors(page)).not.toContain("AUTO_unitScaling");
  });
});
