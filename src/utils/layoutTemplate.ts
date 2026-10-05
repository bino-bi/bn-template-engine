/**
 * Grid templates of `bn-layout-page` and `bn-layout-card`.
 *
 * A template is a CSS `grid-template-areas` value: one quoted row per grid
 * row, one name per cell, for example `"a a" "b c"`.
 */
const TEMPLATES = new Map([
  ["split-vertical", '"a  b"'],
  ["split-horizontal", '"a" "b"'],
  ["2x2", '"a b" "c d"'],
  ["3x3", '"a b c" "d e f" "g h i"'],
  ["4x4", '"a b c d" "e f g h" "i j k l" "m n o p"'],
  ["1-over-2", '"a a" "b c"'],
  ["2-over-1", '"a b" "c c"'],
  ["1-over-3", '"a a a " "b c d"'],
  ["3-over-1", '"a b c" "d d d"'],
  ["gold3", '"a c" "b c"'],
  ["gold4", '"a b c c" "d d c c"'],
]);

export const CUSTOM_TEMPLATE = "custom-template";

const SINGLE_CELL = '"a"';
const ROW_PATTERN = /"[\w\d\s.]+"/g;

/** The rows of a template, each as the list of its cell names. Empty for text that holds no quoted row. */
export function templateRows(areas: string | null | undefined): string[][] {
  return (areas?.match(ROW_PATTERN) ?? []).map((row) =>
    row
      .slice(1, -1)
      .split(/\s+/)
      .filter((cell) => cell !== ""),
  );
}

/** True for a built-in template name and for `custom-template`. Any other layout, such as `full`, is a single cell. */
export function isTemplateLayout(layout: string): boolean {
  return layout === CUSTOM_TEMPLATE || TEMPLATES.has(layout);
}

/**
 * The `grid-template-areas` of a layout. A custom template without a quoted
 * row cannot be laid out and is drawn as a single cell.
 */
export function templateAreas(layout: string, customTemplate: string | null | undefined): string {
  if (layout === CUSTOM_TEMPLATE) {
    return templateRows(customTemplate).length > 0 ? customTemplate : SINGLE_CELL;
  }
  return TEMPLATES.get(layout) ?? SINGLE_CELL;
}

/** One equal column track per cell of the first row. */
export function templateColumns(areas: string): string {
  const columns = templateRows(areas)[0]?.length || 1;
  return Array(columns).fill("minmax(0, 1fr)").join(" ");
}

/** The area names of a template, in order of first appearance. */
export function templateSlotNames(areas: string | null | undefined): string[] {
  return Array.from(new Set(areas?.match(/\b\w+\b/g) ?? []));
}

/** Why a custom template cannot be used as it is written, or `undefined` when it is fine. */
export function templateProblem(customTemplate: string | null | undefined): string | undefined {
  const rows = templateRows(customTemplate);
  if (rows.length === 0) {
    return `no row found, the layout is drawn as a single cell. Write one quoted row per grid row, e.g. '"a a" "b c"'.`;
  }
  if (rows.some((row) => row.length !== rows[0].length)) {
    return "the rows have different numbers of cells, so the browser ignores the template.";
  }
  return undefined;
}
