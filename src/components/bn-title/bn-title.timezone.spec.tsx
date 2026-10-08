// bn-title reads date-start and date-end in UTC.
// Run under another zone with `npm run test:tz` (jest copies process.env, so TZ cannot be set here).
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
  };
});

import { newSpecPage } from "@stencil/core/testing";
import { Title } from "./bn-title";
import { BnTitleRenderer } from "./bn-title-renderer/bn-title-renderer";
import { TimePeriod } from "./bn-title-renderer/utils/model/TimePeriod";

describe("bn-title reads date-start and date-end in UTC", () => {
  it("shows the months of the UTC dates", async () => {
    const page = await newSpecPage({
      components: [Title, BnTitleRenderer],
      html: `<bn-title date-start="2024-01-01T00:00:00Z" date-end="2024-03-01T00:00:00Z" date-format="month" date-link="interval"></bn-title>`,
    });

    const inner = page.root.shadowRoot.querySelector("bn-title-renderer") as HTMLElement & { timeperiod: TimePeriod };
    expect(inner.timeperiod.start.toISO()).toBe("2024-01-01T00:00:00.000Z");
    expect(inner.timeperiod.end.toISO()).toBe("2024-03-01T00:00:00.000Z");
    expect(inner.shadowRoot.querySelector("div > div:last-child").textContent).toBe("Jan..Mar 2024");
  });
});
