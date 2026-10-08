// The JSON Schemas that ship in the package are generated from the types in
// schemas.ts. This spec checks them against what the engine itself uses and
// documents: its built-in style, rule set and texts, and the examples.
import Ajv, { ValidateFunction } from "ajv";
import { SYSTEM_STYLE_DEFAULTS } from "./stores/componentStyles";
import { SYSTEM_I18N_DEFAULTS } from "./stores/internationalization";
import { SYSTEM_RULESET_DEFAULTS } from "./stores/ruleSets";

const { generateSchemas } = require("../scripts/generate-schemas");

describe("JSON Schemas", () => {
  const validators: Record<string, ValidateFunction> = {};

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    for (const [name, schema] of Object.entries(generateSchemas() as Record<string, object>)) {
      validators[name] = ajv.compile(schema);
    }
    // the generator runs the TypeScript compiler once
  }, 120000);

  const errors = (name: string, value: unknown): string[] => {
    const validate = validators[name];
    // the built-in objects hold class instances and undefined values: check what JSON would carry
    return validate(JSON.parse(JSON.stringify(value)))
      ? []
      : validate.errors.map((error) => `${error.instancePath} ${error.message}`);
  };

  it("generates the seven schemas", () => {
    expect(Object.keys(validators).sort()).toEqual(["axis", "i18n", "partof", "ruleset", "stack", "theme", "thereof"]);
  });

  describe("accept what the engine uses itself", () => {
    it("the built-in style", () => {
      expect(errors("theme", SYSTEM_STYLE_DEFAULTS)).toEqual([]);
    });

    it("the built-in rule set", () => {
      expect(errors("ruleset", SYSTEM_RULESET_DEFAULTS)).toEqual([]);
    });

    it("the built-in texts", () => {
      const system = SYSTEM_I18N_DEFAULTS._system as Record<string, unknown>;

      expect(errors("i18n", system.en)).toEqual([]);
      expect(errors("i18n", system.de)).toEqual([]);
    });
  });

  describe("accept the documented examples", () => {
    it.each<[string, unknown]>([
      ["theme", { global: { fontSizePx: 12 } }],
      ["theme", { "bn-chart-time": { barStyles: { fc: { fillpattern: "fc" } }, scaleFactors: { columnWidth: 2 } } }],
      ["ruleset", { scenarios: { pl: { name: "Budget", colorIndex: 30 } } }],
      ["i18n", { global: { ac1: "Actual" }, "bn-table": { thereof: "of which", SUM_TOTAL: "Total" } }],
      ["thereof", [{ rowGroup: "Umsatz", category: "Applications", subCategory: "Applications-A" }]],
      ["partof", [{ rowGroup: "Umsatz", category: "Applications" }]],
      ["partof", [{ rowGroup: "Umsatz", category: "Hamburg", subCategory: "" }]],
      ["stack", { by: "scenarios" }],
      ["stack", { by: "dimensions", mode: "relative", order: "asc" }],
      ["axis", { measure: "ac1", label: "Revenue", unit: "EUR", min: 0, highlight: { from: 10 } }],
    ])("%s: %j", (name, value) => {
      expect(errors(name, value)).toEqual([]);
    });
  });

  describe("reject what the engine does not read", () => {
    it.each<[string, unknown, string]>([
      ["theme", { "bn-chart-time": { scaleFactors: { labelToColum: 1 } } }, "an unknown key"],
      ["theme", { "bn-chart-time": { barStyles: { fc: { fillpattern: "dotted" } } } }, "an unknown fillpattern"],
      ["theme", { global: { fontSizePx: "12px" } }, "a length with a unit"],
      ["ruleset", { scenarios: { pl: { colorIndex: "30" } } }, "a colorIndex that is text"],
      ["i18n", { global: { ac1: 1 } }, "a text that is a number"],
      ["thereof", [{ rowGroup: "Umsatz", category: "Applications" }], "an entry without subCategory"],
      ["partof", [{ rowGroups: "Umsatz", category: "Applications" }], "a misspelled key"],
      ["stack", { by: "category" }, "a value of by that is not accepted"],
      ["stack", { mode: "relative" }, "a stack without by"],
      ["axis", { label: "Revenue" }, "an axis without measure"],
    ])("%s: %j (%s)", (name, value) => {
      expect(errors(name, value)).not.toEqual([]);
    });
  });
});
