/**
 * The page formats: the one list behind the page size, the validation of
 * `format` and the paper size of the printed document.
 *
 * A format is given in its native orientation. Screen formats are in px.
 * Paper formats are in inches with two decimals: the numbers a caller passes
 * as paper size when it prints, so page and sheet have the same size.
 */
const FORMATS: Record<string, [width: number, height: number, unit: "px" | "in"]> = {
  xga: [1024, 768, "px"],
  hd: [1280, 720, "px"],
  "full-hd": [1920, 1080, "px"],
  "4k": [3840, 2160, "px"],
  "4k2k": [4096, 2160, "px"],
  a6: [4.13, 5.83, "in"],
  a5: [5.83, 8.27, "in"],
  a4: [8.27, 11.69, "in"],
  a3: [11.69, 16.54, "in"],
  a2: [16.54, 23.39, "in"],
  a1: [23.39, 33.11, "in"],
  a0: [33.11, 46.81, "in"],
  letter: [8.5, 11, "in"],
  legal: [8.5, 14, "in"],
  tabloid: [11, 17, "in"],
  ledger: [17, 11, "in"],
};

const DEFAULT_FORMAT = "xga";

export const VALID_FORMATS = Object.keys(FORMATS);
export const VALID_ORIENTATIONS = ["landscape", "portrait"];

export type PageOrientation = "landscape" | "portrait";

export interface PageGeometry {
  /** CSS width in the resolved orientation. */
  width: string;
  /** CSS height in the resolved orientation. */
  height: string;
  orientation: PageOrientation;
}

/**
 * Size and orientation of a page.
 *
 * Without a known format the page is the default (XGA, landscape) and
 * `orientation` has no effect. Without a valid orientation the format keeps
 * its native one.
 */
export function pageGeometry(format?: string | null, orientation?: string | null): PageGeometry {
  const known = format != null && VALID_FORMATS.includes(format);
  const [width, height, unit] = FORMATS[known ? format : DEFAULT_FORMAT];
  const native: PageOrientation = width >= height ? "landscape" : "portrait";
  const used = known && VALID_ORIENTATIONS.includes(orientation ?? "") ? (orientation as PageOrientation) : native;
  const [w, h] = used === native ? [width, height] : [height, width];

  return { width: `${w}${unit}`, height: `${h}${unit}`, orientation: used };
}

export interface SheetGeometry {
  width: string;
  height: string;
  /** True when the page is rotated to fit the sheet. */
  turned: boolean;
}

/**
 * The box a page takes on the sheet.
 *
 * A document is printed in one orientation, `renderOrientation`. A layout
 * page with the other orientation keeps its own layout and is turned onto
 * the sheet, so its box has the swapped size. Without a valid
 * `renderOrientation` nothing is turned. A plain `bn-page` is never turned:
 * pass no `renderOrientation` for it.
 */
export function sheetGeometry(
  format?: string | null,
  orientation?: string | null,
  renderOrientation?: string | null,
): SheetGeometry {
  const page = pageGeometry(format, orientation);
  const turned = VALID_ORIENTATIONS.includes(renderOrientation ?? "") && renderOrientation !== page.orientation;

  return turned
    ? { width: page.height, height: page.width, turned }
    : { width: page.width, height: page.height, turned };
}

/**
 * The `@page` rule for a document whose first page is drawn like this. It
 * sets only the size: a margin here would override the margins of a caller
 * that prints with a header and a footer.
 */
export function pageRule(
  format?: string | null,
  orientation?: string | null,
  renderOrientation?: string | null,
): string {
  const { width, height } = sheetGeometry(format, orientation, renderOrientation);
  return `@page { size: ${width} ${height}; }`;
}
