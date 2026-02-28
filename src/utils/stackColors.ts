/** Default fill colors cycled through for stacked chart segments. */
export const STACK_FILLS = ["#808080", "#c0c0c0", "#000000"];
/** Default stroke colors cycled through for stacked chart segments. */
export const STACK_STROKES = ["#808080", "#c0c0c0", "#000000"];

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

/**
 * Returns black or white text color for readable contrast against the given
 * hex background, using the W3C relative luminance formula.
 */
export function getContrastTextColor(hexFill: string): string {
  const r = parseInt(hexFill.slice(1, 3), 16);
  const g = parseInt(hexFill.slice(3, 5), 16);
  const b = parseInt(hexFill.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? "#000000" : "#ffffff";
}
