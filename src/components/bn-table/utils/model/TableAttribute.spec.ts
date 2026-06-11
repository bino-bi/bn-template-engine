import { isValidAttributeExpression, parseTableAttributeExpression } from "./TableAttribute";
import { validateAttributesJsonStr } from "../../../../utils/validate";

describe("isValidAttributeExpression", () => {
  it.each(["set(_leiter)", "first(_leiter)", "last(date)", "min(ac1)", "max(ac1)", "avg(ac1)", "sum(ac1)", "lit(Fix)"])(
    "accepts %s",
    (expression) => {
      expect(isValidAttributeExpression(expression)).toBe(true);
    },
  );

  it("accepts surrounding whitespace", () => {
    expect(isValidAttributeExpression("  sum( ac1 )  ")).toBe(true);
  });

  it.each([
    "set(a-b)",
    "set(ac1')",
    "set([ac1])",
    "sum(ac1); DROP TABLE x",
    "unknown(_leiter)",
    "set()",
    "lit()",
    "set",
    "",
  ])("rejects %s", (expression) => {
    expect(isValidAttributeExpression(expression)).toBe(false);
  });
});

describe("parseTableAttributeExpression", () => {
  it("parses a set expression", () => {
    const attribute = parseTableAttributeExpression("Verkaufsleiter", "attr_0", "set(_leiter)");
    expect(attribute).toEqual(
      expect.objectContaining({ label: "Verkaufsleiter", alias: "attr_0", fn: "set", arg: "_leiter" }),
    );
    expect(attribute.isNumeric).toBe(false);
  });

  it("marks numeric aggregates", () => {
    expect(parseTableAttributeExpression("a", "attr_0", "sum(ac1)").isNumeric).toBe(true);
    expect(parseTableAttributeExpression("a", "attr_0", "min(ac1)").isNumeric).toBe(true);
    expect(parseTableAttributeExpression("a", "attr_0", "max(ac1)").isNumeric).toBe(true);
    expect(parseTableAttributeExpression("a", "attr_0", "avg(ac1)").isNumeric).toBe(true);
    expect(parseTableAttributeExpression("a", "attr_0", "first(_leiter)").isNumeric).toBe(false);
    expect(parseTableAttributeExpression("a", "attr_0", "lit(42)").isNumeric).toBe(false);
  });

  it("keeps the raw lit argument", () => {
    expect(parseTableAttributeExpression("Konstante", "attr_1", "lit(Hello World)").arg).toBe("Hello World");
  });

  it("returns null for invalid expressions", () => {
    expect(parseTableAttributeExpression("x", "attr_0", "set(a-b)")).toBeNull();
    expect(parseTableAttributeExpression("x", "attr_0", "nope(ac1)")).toBeNull();
  });
});

describe("validateAttributesJsonStr", () => {
  it("accepts blank input", () => {
    expect(validateAttributesJsonStr("")).toEqual([]);
    expect(validateAttributesJsonStr(null as unknown as string)).toEqual([]);
  });

  it("accepts a valid attributes object", () => {
    expect(validateAttributesJsonStr('{"Verkaufsleiter": "set(_leiter)", "Gesamt": "sum(ac1)"}')).toEqual([]);
  });

  it("returns invalid expressions", () => {
    expect(validateAttributesJsonStr('{"Verkaufsleiter": "set(a-b)", "Gesamt": "sum(ac1)"}')).toEqual([
      "Verkaufsleiter: set(a-b)",
    ]);
  });

  it("returns non-string values", () => {
    expect(validateAttributesJsonStr('{"Verkaufsleiter": 42}')).toEqual(["Verkaufsleiter: 42"]);
  });

  it("rejects non-object JSON", () => {
    expect(validateAttributesJsonStr('["set(_leiter)"]')).toEqual(["Invalid JSON structure"]);
    expect(validateAttributesJsonStr('"set(_leiter)"')).toEqual(["Invalid JSON structure"]);
  });

  it("rejects malformed JSON", () => {
    expect(validateAttributesJsonStr("{not json")).toEqual(["Invalid JSON structure"]);
  });
});
