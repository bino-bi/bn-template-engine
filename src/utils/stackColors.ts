/** Default fill colors cycled through for stacked chart segments. */
export const STACK_FILLS = ["#000000", "#c0c0c0", "#808080"];
/** Default stroke colors cycled through for stacked chart segments. */
export const STACK_STROKES = ["#000000", "#c0c0c0", "#808080"];

/**
 * IBCS rendering order: back-to-front (PL behind FC behind PP behind AC).
 * Used to ensure correct visual layering when scenarios overlap.
 */
export const IBCS_LAYER_ORDER = ["pl", "fc", "pp", "ac"];

/** Strips the trailing numeric suffix from a scenario key (e.g. "ac1" -> "ac"). */
export function getScenarioPrefix(scenario: string): string {
  return scenario.replace(/\d+$/, "");
}

/** Returns a fill color for the given stack index, cycling through `STACK_FILLS`. */
export function getStackFill(index: number): string {
  return STACK_FILLS[index % STACK_FILLS.length];
}

/** Returns a stroke color for the given stack index, cycling through `STACK_STROKES`. */
export function getStackStroke(index: number): string {
  return STACK_STROKES[index % STACK_STROKES.length];
}

/** Red, green and blue (0 to 255) of a hex colour with 3, 4, 6 or 8 digits or of an rgb() / rgba() colour. */
function parseRgb(color: string): number[] | null {
  const hex = /^#([0-9a-f]+)$/i.exec(color.trim());
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      return [0, 1, 2].map((index) => parseInt(digits[index] + digits[index], 16));
    }
    if (digits.length === 6 || digits.length === 8) {
      return [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16));
    }
    return null;
  }

  const rgb = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i.exec(color.trim());
  if (rgb) {
    return rgb.slice(1, 4).map((part) => (part.endsWith("%") ? parseFloat(part) * 2.55 : parseFloat(part)));
  }

  return null;
}

/**
 * Returns black or white text color for readable contrast against the given
 * background, using the W3C relative luminance formula. A color that cannot
 * be read (a name, a pattern) gets black text.
 */
export function getContrastTextColor(fill: string): string {
  const rgb = parseRgb(fill);
  if (rgb === null) {
    return "#000000";
  }
  const [r, g, b] = rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? "#000000" : "#ffffff";
}
