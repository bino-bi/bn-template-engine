import { SYSTEM_I18N_DEFAULTS, globalLabelKeys } from "./internationalization";

/**
 * Keys each component requests from its own namespace at render time.
 *
 * `withTranslation` returns the *key itself* when a lookup misses, and that
 * string is truthy — so a requested key with no bundle entry silently defeats
 * every downstream `|| "fallback"` and prints the raw key into the report.
 * Keeping this list next to the bundles is what makes that failure loud.
 *
 * Sources (keep in sync):
 * - bn-table.tsx            `i18nMetaLabelsLocal`
 * - bn-title.tsx            `i18nMetaLabelsLocal`
 * - bn-chart-time.tsx       `i18nMetaLabelsLocal`
 * - bn-chart-structure.tsx  `i18nMetaLabelsLocal`
 * - bn-chart-scatter.tsx    `i18nLocalKeys()`
 * - bn-chart-bubble.tsx     `i18nLocalKeys()`
 * - bn-chart-bullet.tsx     `i18nLocalKeys()`
 */
const localLabelKeys: Record<string, string[]> = {
  "bn-table": ["in", "category", "operation", "there_of", "part_of", "SUM_TOTAL", "no-data"],
  // The engine key really is spelled SEPERATOR_WS.
  "bn-title": ["SEPERATOR_WS", "in", "CONNECTOR_WS"],
  "bn-chart-time": ["no-data"],
  "bn-chart-structure": ["no-data"],
  "bn-chart-scatter": ["no-data", "axis.in", "legend.title"],
  "bn-chart-bubble": ["no-data", "axis.in", "legend.title", "legend.size", "legend.compare"],
  "bn-chart-bullet": ["no-data", "target", "axis.in"],
};

const bundles = SYSTEM_I18N_DEFAULTS["_system"] as Record<string, Record<string, string>>;

describe("_system i18n defaults", () => {
  it("ships the same key set for every locale", () => {
    const locales = Object.keys(bundles);
    expect(locales.length).toBeGreaterThan(1);

    const [reference, ...rest] = locales;
    for (const locale of rest) {
      expect({ locale, keys: Object.keys(bundles[locale]).sort() }).toEqual({
        locale,
        keys: Object.keys(bundles[reference]).sort(),
      });
    }
  });

  describe.each(Object.keys(bundles))("locale %s", (locale) => {
    const bundle = bundles[locale];

    it.each(globalLabelKeys)("defines global.%s", (key) => {
      expect(bundle[`global.${key}`]).toBeDefined();
    });

    it.each(Object.entries(localLabelKeys))("defines every key %s requests", (namespace, keys) => {
      const missing = keys.filter((key) => bundle[`${namespace}.${key}`] === undefined);
      expect(missing).toEqual([]);
    });
  });
});
