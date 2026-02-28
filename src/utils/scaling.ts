/**
 * The four scaling modes a component's `scale` attribute can resolve to:
 * - `"empty"`: attribute absent or blank -- component decides (typically auto)
 * - `"none"`: scaling explicitly disabled (show raw values)
 * - `"auto"`: auto-detect SI prefix from data magnitude
 * - `"factor"`: explicit numeric divisor (e.g. `"1000"` to show values in thousands)
 */
export type ScalingMode = "empty" | "none" | "auto" | "factor";

/**
 * Parsed result of a component's `scale` attribute.
 * `factor` is only set when `mode === "factor"`.
 */
export interface ScalingConfig {
  mode: ScalingMode;
  factor?: number;
}

/**
 * Parses the raw `scale` attribute string into a typed {@link ScalingConfig}.
 * Handles null/empty (-> empty), literal `"none"` / `"auto"`, or a positive
 * numeric string (-> factor mode). Invalid non-numeric strings fall back to empty.
 */
export function parseScaling(scale: string | undefined): ScalingConfig {
  if (scale == null || scale === "") return { mode: "empty" };
  if (scale === "none") return { mode: "none" };
  if (scale === "auto") return { mode: "auto" };
  const num = Number(scale);
  if (!isNaN(num) && num > 0) return { mode: "factor", factor: num };
  return { mode: "empty" };
}
