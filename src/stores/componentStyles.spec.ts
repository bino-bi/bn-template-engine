import { readFileSync } from "fs";
import { join } from "path";
import { SYSTEM_STYLE_DEFAULTS, unknownStyleKeys } from "./componentStyles";

describe("unknownStyleKeys", () => {
  it("accepts the built-in style", () => {
    expect(unknownStyleKeys(SYSTEM_STYLE_DEFAULTS)).toEqual([]);
  });

  it("accepts a partial style and the optional bn-text keys", () => {
    expect(
      unknownStyleKeys({
        global: { fontSizePx: 12 },
        "bn-text": { leading: 1.2, fontColor: "#333333" },
        "bn-chart-time": { scaleFactors: { labelToColumn: 0.5 }, padding: { top: 0 } },
      }),
    ).toEqual([]);
  });

  it("names an unknown section, an unknown key of a section and a misspelled scale factor", () => {
    expect(
      unknownStyleKeys({
        "bn-table": { fontSizePx: 10 },
        global: { fontSize: 12 },
        "bn-text": { color: "#000000" },
        "bn-chart-time": { scaleFactors: { labelToColum: 0.5 }, padding: { up: 1 } },
      }),
    ).toEqual([
      "bn-table",
      "global.fontSize",
      "bn-text.color",
      "bn-chart-time.scaleFactors.labelToColum",
      "bn-chart-time.padding.up",
    ]);
  });

  it("does not look into the style groups, whose keys differ per scenario", () => {
    expect(
      unknownStyleKeys({
        "bn-chart-time": {
          axisStyles: { ac: { dasharray: "4 2" } },
          barStyles: { ac: { fillpattern: "hatched" } },
          varianceStyles: { pos: { fill: "#00ff00" } },
          stackColors: ["#111111"],
        },
      }),
    ).toEqual([]);
  });

  it("returns nothing for a body that is not an object", () => {
    expect(unknownStyleKeys(null)).toEqual([]);
    expect(unknownStyleKeys([1, 2])).toEqual([]);
    expect(unknownStyleKeys("x")).toEqual([]);
  });
});

describe("the theming guide", () => {
  const guide = readFileSync(join(__dirname, "../../doc/theming.md"), "utf8");
  const blocks = (language: string): string[] =>
    Array.from(guide.matchAll(new RegExp("```" + language + "\\n([\\s\\S]*?)```", "g")), (match) => match[1]);
  // the JSON examples, and the style bodies inside the HTML examples
  const examples = [
    ...blocks("json"),
    ...blocks("html").flatMap((html) =>
      Array.from(html.matchAll(/<bn-component-style[^>]*>([\s\S]*?)<\/bn-component-style>/g), (match) => match[1]),
    ),
  ];

  it("has examples", () => {
    expect(examples.length).toBeGreaterThan(6);
  });

  it.each(examples.map((example, index) => [index + 1, example]))(
    "example %i uses only keys that are read",
    (_i, body) => {
      expect(unknownStyleKeys(JSON.parse(body as string))).toEqual([]);
    },
  );
});
