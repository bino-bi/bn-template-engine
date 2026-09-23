import { SYSTEM_I18N_DEFAULTS } from "./internationalization";

const bundles = SYSTEM_I18N_DEFAULTS["_system"] as Record<string, Record<string, string>>;

describe("no-data default label", () => {
  it.each(Object.keys(bundles))("locale %s has no '==' markers in any *.no-data key", (locale) => {
    const leaking = Object.entries(bundles[locale])
      .filter(([key, value]) => key.endsWith(".no-data") && value.includes("=="))
      .map(([key, value]) => `${key} = ${value}`);
    expect(leaking).toEqual([]);
  });
});
