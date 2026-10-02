import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { SpecResult } from "../../../../utils/xy/model/AxisConfig";

/**
 * Parsed shapes of the bullet graph's structured object props (spec: the
 * JSON attribute forms of `actual`, `target`, `labels`, and the JSON array
 * form of `ranges`). The facade parses and validates the raw attributes once
 * and passes these typed objects to the inner element, following the
 * `AxisConfig` precedent of the XY charts.
 */

/** Parsed `actual` / `target` prop. */
export interface BulletMeasureConfig {
  /** Scenario-column token (`ac1`…`pl4`). Variance tokens are not allowed. */
  measure: string;
  label?: string;
  unit?: string;
}

/** Parsed `labels` prop. */
export interface BulletLabelConfig {
  show: "auto" | "none";
  /** Decimal places of the value labels. */
  decimals: number;
}

/** Result of parsing the raw `ranges` attribute. */
export interface ParsedRanges {
  /** Ascending fractions of the target, at most two entries. */
  ranges: number[];
  parseError: boolean;
  /** Human-readable problems that were repaired (unsorted, too many entries). */
  issues: string[];
}

const MEASURE_KEYS = ["measure", "label", "unit"];

export function toBulletMeasureConfig(data: Record<string, unknown>): SpecResult<BulletMeasureConfig> {
  const invalidFields: string[] = [];
  const measure = readString(data, "measure", invalidFields);

  if (measure === undefined || measure.trim() === "") {
    invalidFields.push("measure");
    return { config: null, unknownKeys: collectUnknownKeys(data, MEASURE_KEYS), invalidFields };
  }

  const config: BulletMeasureConfig = { measure: measure.trim() };
  config.label = readString(data, "label", invalidFields);
  config.unit = readString(data, "unit", invalidFields);

  return { config, unknownKeys: collectUnknownKeys(data, MEASURE_KEYS), invalidFields };
}

const LABEL_KEYS = ["show", "decimals"];

export function toBulletLabelConfig(
  data: Record<string, unknown>,
  defaults: { show: BulletLabelConfig["show"]; decimals: number },
): SpecResult<BulletLabelConfig> {
  const invalidFields: string[] = [];
  const config: BulletLabelConfig = { show: defaults.show, decimals: defaults.decimals };

  if (CompareUtil.isExisting(data.show)) {
    if (data.show === "auto" || data.show === "none") {
      config.show = data.show;
    } else {
      invalidFields.push("show");
    }
  }

  if (CompareUtil.isExisting(data.decimals)) {
    if (CompareUtil.isNumber(data.decimals) && data.decimals >= 0 && data.decimals <= 4) {
      config.decimals = Math.floor(data.decimals as number);
    } else {
      invalidFields.push("decimals");
    }
  }

  return { config, unknownKeys: collectUnknownKeys(data, LABEL_KEYS), invalidFields };
}

/**
 * Parses the raw `ranges` attribute value. A blank value yields no ranges
 * without error. Anything else must be a JSON array of positive numbers -
 * ascending fractions of the target, e.g. `[0.6, 0.9]`. `parseSpec` cannot
 * be used here because it rejects top-level JSON arrays. Unsorted input is
 * sorted and more than two entries are truncated; both repairs are reported
 * as issues.
 */
export function parseRanges(raw: string | undefined | null): ParsedRanges {
  const trimmed = raw?.trim() ?? "";

  if (trimmed === "" || trimmed === "null") {
    return { ranges: [], parseError: false, issues: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ranges: [], parseError: true, issues: [] };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ranges: [], parseError: true, issues: [] };
  }

  if (!parsed.every((entry) => CompareUtil.isNumber(entry) && isFinite(entry as number) && (entry as number) > 0)) {
    return { ranges: [], parseError: true, issues: [] };
  }

  const issues: string[] = [];
  let ranges = parsed as number[];

  const sorted = [...ranges].sort((a, b) => a - b);
  if (sorted.some((value, index) => value !== ranges[index])) {
    issues.push("not ascending, sorted");
  }
  ranges = sorted;

  if (ranges.length > 2) {
    issues.push(`${ranges.length} entries, first 2 kept`);
    ranges = ranges.slice(0, 2);
  }

  return { ranges, parseError: false, issues };
}

function collectUnknownKeys(data: Record<string, unknown>, knownKeys: string[]): string[] {
  return Object.keys(data).filter((key) => !knownKeys.includes(key));
}

function readString(data: Record<string, unknown>, key: string, invalid: string[]): string | undefined {
  if (!CompareUtil.isExisting(data[key])) {
    return undefined;
  }
  if (CompareUtil.isString(data[key])) {
    return data[key] as string;
  }
  invalid.push(key);
  return undefined;
}
