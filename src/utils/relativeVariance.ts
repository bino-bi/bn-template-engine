/** Text shown for a relative variance whose reference is 0. */
export const NOT_AVAILABLE = "n/a";

/**
 * Relative variance (a - b) / |b|, from the difference a - b and the reference b.
 * undefined: the reference is 0, callers show NOT_AVAILABLE and no bar.
 * The reference counts as 0 also when it is 0 up to float rounding: a ratio above 1e9.
 * NaN: an input is NaN, missing data stays missing.
 */
export function relativeVariance(difference: number, reference: number): number | undefined {
  // a reference of 0, or 0 up to the float rounding of its sum, has no meaningful ratio
  if (Math.abs(reference) <= Math.abs(difference) * 1e-9) return undefined;
  return difference / Math.abs(reference);
}
