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

/**
 * SI suffixes accepted by the shared scaling-value grammar.
 * Case-sensitive except `k`/`K`; lowercase `m` (SI milli) is deliberately
 * rejected to avoid ambiguity with `M` (mega).
 */
const SCALING_SI_SUFFIX: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

/**
 * Positive decimal with optional whitespace and optional single SI suffix.
 * No sign, no exponent notation — keeps the grammar unambiguous against
 * scaling-group names.
 */
const SCALING_NUMBER_RE = /^(\d+(?:\.\d+)?|\.\d+)\s*([kKMGT])?$/;

/**
 * Result of parsing a scaling value (`unit-scaling`, `percentage-scaling`,
 * or a `bn-scaling-group` value) with the shared grammar.
 */
export type ParsedScalingValue =
  | { kind: "auto" }
  | { kind: "number"; value: number }
  | { kind: "invalid"; raw: string };

/**
 * Parses a raw scaling value with the shared grammar used by
 * `unit-scaling` / `percentage-scaling` and `<bn-scaling-group>`:
 *
 * - `"auto"` (trimmed, case-insensitive) -> `{ kind: "auto" }`
 * - a positive number with optional SI suffix (`"250000"`, `"2.5M"`, `"1 k"`;
 *   suffixes `k`/`K` = 1e3, `M` = 1e6, `G` = 1e9, `T` = 1e12) -> `{ kind: "number" }`
 * - anything else (blank, signs, exponent notation, lowercase `m`/`g`/`t`,
 *   zero, negatives, non-finite) -> `{ kind: "invalid" }`
 */
export function parseScalingValue(raw: string | number | null | undefined): ParsedScalingValue {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? { kind: "number", value: raw } : { kind: "invalid", raw: String(raw) };
  }
  const s = raw?.toString().trim() ?? "";
  if (s.toLowerCase() === "auto") return { kind: "auto" };
  const match = SCALING_NUMBER_RE.exec(s);
  if (match) {
    const value = Number(match[1]) * (match[2] ? SCALING_SI_SUFFIX[match[2]] : 1);
    if (Number.isFinite(value) && value > 0) return { kind: "number", value };
  }
  return { kind: "invalid", raw: s };
}

/**
 * Result of resolving a scaling value against the scaling groups in scope.
 * Group values and literal numbers carry identical units, so both resolve
 * to `{ kind: "value" }`.
 */
export type ResolvedScalingValue =
  | { kind: "value"; value: number }
  | { kind: "auto" }
  | { kind: "invalid"; raw: string };

/**
 * Resolves a raw `unit-scaling` / `percentage-scaling` value.
 * Resolution order: `auto` -> scaling-group lookup (trimmed name) ->
 * number/SI parse -> invalid. `auto` wins over a group of the same name
 * because the name is reserved.
 */
export function resolveScalingValue(
  raw: string | number | null | undefined,
  groups: ReadonlyMap<string, number>,
): ResolvedScalingValue {
  const parsed = parseScalingValue(raw);
  if (parsed.kind === "auto") return { kind: "auto" };
  if (typeof raw === "string") {
    const name = raw.trim();
    if (groups.has(name)) return { kind: "value", value: groups.get(name)! };
  }
  if (parsed.kind === "number") return { kind: "value", value: parsed.value };
  return { kind: "invalid", raw: parsed.raw };
}

const SCALING_FORMAT_STEPS: [number, string][] = [
  [1e12, "T"],
  [1e9, "G"],
  [1e6, "M"],
  [1e3, "k"],
];

/**
 * Formats a positive value with the same SI suffixes the parser accepts,
 * rounded to 3 significant digits (`250000` -> `"250k"`). Values just below
 * a suffix boundary may round up across it (`999999` -> `"1000k"`) — fine
 * for warning messages, which is all this is used for.
 */
export function formatScalingValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return String(value);
  const sig = (n: number): string => String(Number(n.toPrecision(3)));
  for (const [mult, suffix] of SCALING_FORMAT_STEPS) {
    if (value >= mult) return `${sig(value / mult)}${suffix}`;
  }
  return sig(value);
}

/**
 * Payload an inner rendering component reports to its wrapper after
 * auto-fitting a scaling value. Members are only set for the values that
 * were actually auto-resolved, in the INNER component's native units
 * (charts: px for one data unit / px per 1.0 fraction; table: em for one
 * data unit / em per percentage point).
 */
export interface AutoScalingReport {
  unit?: number;
  percentage?: number;
}
