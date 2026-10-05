import {
  isTemplateLayout,
  templateAreas,
  templateColumns,
  templateProblem,
  templateRows,
  templateSlotNames,
} from "./layoutTemplate";

const TRACK = "minmax(0, 1fr)";

describe("layout templates", () => {
  it.each([
    ["split-vertical", 2, 1],
    ["split-horizontal", 1, 2],
    ["2x2", 2, 2],
    ["3x3", 3, 3],
    ["4x4", 4, 4],
    ["1-over-2", 2, 2],
    ["2-over-1", 2, 2],
    ["1-over-3", 3, 2],
    ["3-over-1", 3, 2],
  ])("gives %s %i columns and %i rows", (layout, columns, rows) => {
    const areas = templateAreas(layout, undefined);

    expect(templateColumns(areas)).toBe(Array(columns).fill(TRACK).join(" "));
    expect(templateRows(areas)).toHaveLength(rows);
  });

  it("counts the cells of a row, not the pieces between its quotes", () => {
    // the trailing blank of this row used to count as a fourth column
    expect(templateRows('"a a a " "b c d"')).toEqual([
      ["a", "a", "a"],
      ["b", "c", "d"],
    ]);
  });

  it("draws a layout that is no template as a single cell", () => {
    expect(isTemplateLayout("full")).toBe(false);
    expect(templateAreas("full", '"a b"')).toBe('"a"');
    expect(templateAreas("no-such-layout", undefined)).toBe('"a"');
  });

  it("uses the custom template for custom-template", () => {
    expect(isTemplateLayout("custom-template")).toBe(true);
    expect(templateAreas("custom-template", '"a a" "b c"')).toBe('"a a" "b c"');
    expect(templateColumns('"a a" "b c"')).toBe(`${TRACK} ${TRACK}`);
    expect(templateSlotNames('"a a" "b c"')).toEqual(["a", "b", "c"]);
  });

  it("keeps a free cell out of the slots", () => {
    expect(templateSlotNames('"a ." ". b"')).toEqual(["a", "b"]);
    expect(templateRows('"a ." ". b"')).toEqual([
      ["a", "."],
      [".", "b"],
    ]);
  });

  it("reads rows in single quotes, which fit into a double-quoted attribute", () => {
    const template = "'a a' 'b c'";

    expect(templateAreas("custom-template", template)).toBe(template);
    expect(templateRows(template)).toEqual([
      ["a", "a"],
      ["b", "c"],
    ]);
    expect(templateColumns(template)).toBe(`${TRACK} ${TRACK}`);
    expect(templateSlotNames(template)).toEqual(["a", "b", "c"]);
    expect(templateProblem(template)).toBeUndefined();
  });

  it.each([undefined, null, "", "a b", "'a b\"", '""'])("draws the custom template %p as a single cell", (custom) => {
    // the page read the first row of the match without a check and threw in render()
    expect(templateAreas("custom-template", custom)).toBe('"a"');
    expect(templateRows(custom)).toEqual([]);
    expect(templateColumns(templateAreas("custom-template", custom))).toBe(TRACK);
    expect(templateSlotNames(templateAreas("custom-template", custom))).toEqual(["a"]);
    expect(templateProblem(custom)).toContain("no row found");
  });

  it("does not take the gap between two rows with unpaired quotes for a row", () => {
    // opens with a double quote and closes with a single one: only the blank between the rows sits in quotes
    const template = `"a b' 'c d"`;

    expect(templateRows(template)).toEqual([]);
    expect(templateAreas("custom-template", template)).toBe('"a"');
    expect(templateProblem(template)).toContain("no row found");
  });

  it.each([
    ["a row of blanks", `"a b" " " "c d"`],
    ["an empty pair of quotes", `"a b" ""`],
    ["an empty pair of single quotes", `"a b" '' "c d"`],
  ])("reports %s: the browser ignores such a template", (_name, template) => {
    // the good rows alone look fine, but a pair of quotes without a cell makes the whole value invalid
    expect(templateProblem(template)).toContain("holds no cell");
  });

  it.each([
    ["unpaired quotes next to a good row", `"a b" "c d' 'e f"`],
    ["a cell name with a hyphen", `"a b" "c-x d" "e f"`],
    ["a cell name with an umlaut", `"a b" "ü d" "e f"`],
  ])("reports %s as a row that cannot be read", (_name, template) => {
    // the browser may take such a value, but row count and slots would not match it
    expect(templateProblem(template)).toContain("cannot be read");
  });

  it.each([`"a b" "c d"`, `'a a' 'b c'`, `"a  b"`, `"a a a " "b c d"`, `"a ." ". b"`])(
    "has nothing to report for %s",
    (template) => {
      expect(templateProblem(template)).toBeUndefined();
    },
  );

  it("reports rows of different length", () => {
    expect(templateProblem('"a b" "c"')).toContain("different numbers of cells");
    expect(templateProblem('"a b" "c d"')).toBeUndefined();
  });
});
