// Writes the JSON Schemas of the JSON attributes and element contents to
// dist/schemas. The schemas are generated from the types that src/schemas.ts
// exports, so they cannot drift from the code.
//
// Usage: node scripts/generate-schemas.js   (after "stencil build", which empties dist)
const fs = require("fs");
const path = require("path");
const { createGenerator } = require("ts-json-schema-generator");

const ROOT = path.join(__dirname, "..");

/** File name (without ".schema.json") and the exported type it is generated from. */
const TYPES = {
  theme: "Theme",
  ruleset: "RuleSet",
  i18n: "I18n",
  thereof: "Thereof",
  partof: "Partof",
  stack: "Stack",
  axis: "Axis",
};

/**
 * The style types describe the complete, merged style. A theme is a partial
 * override, so no key is required. It may also still say "fc" for "hatched".
 */
function asThemeInput(node) {
  if (Array.isArray(node)) {
    return node.map(asThemeInput);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "required") continue;
    result[key] = asThemeInput(value);
  }
  if (Array.isArray(result.enum) && result.enum.includes("hatched")) {
    result.enum = [...result.enum, "fc"];
    result.description = "solid, hatched or outlined. fc is the deprecated name of hatched.";
  }
  return result;
}

/** All schemas by file name. */
function generateSchemas() {
  const generator = createGenerator({
    path: path.join(ROOT, "src/schemas.ts"),
    tsconfig: path.join(ROOT, "tsconfig.json"),
    expose: "export",
    topRef: false,
    additionalProperties: false,
    skipTypeCheck: true,
    functions: "hide",
  });
  const schemas = {};
  for (const [name, type] of Object.entries(TYPES)) {
    const schema = generator.createSchema(type);
    schemas[name] = name === "theme" ? asThemeInput(schema) : schema;
  }
  return schemas;
}

if (require.main === module) {
  const target = path.join(ROOT, "dist", "schemas");
  fs.mkdirSync(target, { recursive: true });
  for (const [name, schema] of Object.entries(generateSchemas())) {
    fs.writeFileSync(path.join(target, `${name}.schema.json`), JSON.stringify(schema, null, 2) + "\n");
  }
}

module.exports = { generateSchemas };
