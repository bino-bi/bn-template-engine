import { CompareUtil } from "../../helper/CompareUtil";

/**
 * Parsed shapes of the XY charts' structured object props (spec: the JSON
 * attribute forms of `x`, `y`, `size`, `share`, `iso`, `labels`, `facet`,
 * `legend`). Facades parse and validate the raw attribute once and pass
 * these typed objects to the inner elements, following the `stackConfig`
 * precedent of bn-chart-time.
 */

/** Shaded band on one axis; open ends run to the domain edge. */
export interface HighlightRange {
  from?: number;
  to?: number;
}

/** Parsed `x` / `y` prop. */
export interface AxisConfig {
  /** Scenario-column token (`ac1`…`pl4`) or variance token (`d…`/`dr…`). */
  measure: string;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  refLine?: number;
  highlight?: HighlightRange;
}

/** Parsed `size` prop (bubble). */
export interface SizeConfig {
  measure: string;
  label?: string;
  unit?: string;
  /** `bn-scaling-group` name for cross-chart value→area sync. */
  group?: string;
}

/** Parsed `share` prop (bubble). */
export interface ShareConfig {
  measure: string;
}

/** Parsed `iso` prop (scatter). */
export interface IsoConfig {
  values: "auto" | number[];
  label?: string;
  unit?: string;
  /** Shade the region `x·y >= from`. */
  highlight?: { from: number };
}

/** Parsed `labels` prop. */
export interface LabelConfig {
  points: "auto" | "none" | "all" | string[];
  /** Bubble only: render the value inside the bubble. */
  values: boolean;
  /** Candidate cap for `points: "auto"`. */
  max: number;
}

/** Parsed `facet` prop. */
export interface FacetConfig {
  level: "rowgroup" | "category";
  /** Wrap width; default: all panels in one row. */
  columns?: number;
}

/** Parsed `legend` prop. */
export interface LegendConfig {
  show: boolean;
  position: "right" | "bottom";
}

/** Result of parsing a raw attribute string into an untyped record. */
export interface ParsedSpec {
  data: Record<string, unknown> | null;
  parseError: boolean;
}

/** Result of converting an untyped record into a typed config. */
export interface SpecResult<T> {
  config: T | null;
  /** Sub-fields present but not part of the spec (forward compat — warning, never error). */
  unknownKeys: string[];
  /** Sub-fields present with an unusable type/value. */
  invalidFields: string[];
}

/**
 * Parses a raw object-prop attribute value. A blank value yields `data: null`
 * without error. A value starting with `{` must be valid JSON describing an
 * object. Any other bare string is treated as shorthand for
 * `{ [shorthandKey]: value }` when a shorthand key is allowed, otherwise it
 * is a parse error.
 */
export function parseSpec(raw: string | undefined | null, shorthandKey: string | null): ParsedSpec {
  const trimmed = raw?.trim() ?? "";

  if (trimmed === "" || trimmed === "null") {
    return { data: null, parseError: false };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { data: null, parseError: true };
      }
      return { data: parsed as Record<string, unknown>, parseError: false };
    } catch {
      return { data: null, parseError: true };
    }
  }

  if (shorthandKey !== null) {
    return { data: { [shorthandKey]: trimmed }, parseError: false };
  }

  return { data: null, parseError: true };
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

function readNumber(data: Record<string, unknown>, key: string, invalid: string[]): number | undefined {
  if (!CompareUtil.isExisting(data[key])) {
    return undefined;
  }
  if (CompareUtil.isNumber(data[key])) {
    return data[key] as number;
  }
  invalid.push(key);
  return undefined;
}

function readHighlight(data: Record<string, unknown>, invalid: string[]): HighlightRange | undefined {
  if (!CompareUtil.isExisting(data.highlight)) {
    return undefined;
  }
  if (!CompareUtil.isObject(data.highlight) || Array.isArray(data.highlight)) {
    invalid.push("highlight");
    return undefined;
  }
  const range = data.highlight as Record<string, unknown>;
  const result: HighlightRange = {};
  const from = readNumber(range, "from", invalid);
  const to = readNumber(range, "to", invalid);
  if (from !== undefined) {
    result.from = from;
  }
  if (to !== undefined) {
    result.to = to;
  }
  return result;
}

const AXIS_KEYS = ["measure", "label", "unit", "min", "max", "refLine", "highlight"];

export function toAxisConfig(data: Record<string, unknown>): SpecResult<AxisConfig> {
  const invalidFields: string[] = [];
  const measure = readString(data, "measure", invalidFields);

  if (measure === undefined || measure.trim() === "") {
    invalidFields.push("measure");
    return { config: null, unknownKeys: collectUnknownKeys(data, AXIS_KEYS), invalidFields };
  }

  const config: AxisConfig = { measure: measure.trim() };
  config.label = readString(data, "label", invalidFields);
  config.unit = readString(data, "unit", invalidFields);
  config.min = readNumber(data, "min", invalidFields);
  config.max = readNumber(data, "max", invalidFields);
  config.refLine = readNumber(data, "refLine", invalidFields);
  config.highlight = readHighlight(data, invalidFields);

  return { config, unknownKeys: collectUnknownKeys(data, AXIS_KEYS), invalidFields };
}

const SIZE_KEYS = ["measure", "label", "unit", "group"];

export function toSizeConfig(data: Record<string, unknown>): SpecResult<SizeConfig> {
  const invalidFields: string[] = [];
  const measure = readString(data, "measure", invalidFields);

  if (measure === undefined || measure.trim() === "") {
    invalidFields.push("measure");
    return { config: null, unknownKeys: collectUnknownKeys(data, SIZE_KEYS), invalidFields };
  }

  const config: SizeConfig = { measure: measure.trim() };
  config.label = readString(data, "label", invalidFields);
  config.unit = readString(data, "unit", invalidFields);
  config.group = readString(data, "group", invalidFields);

  return { config, unknownKeys: collectUnknownKeys(data, SIZE_KEYS), invalidFields };
}

const SHARE_KEYS = ["measure"];

export function toShareConfig(data: Record<string, unknown>): SpecResult<ShareConfig> {
  const invalidFields: string[] = [];
  const measure = readString(data, "measure", invalidFields);

  if (measure === undefined || measure.trim() === "") {
    invalidFields.push("measure");
    return { config: null, unknownKeys: collectUnknownKeys(data, SHARE_KEYS), invalidFields };
  }

  return { config: { measure: measure.trim() }, unknownKeys: collectUnknownKeys(data, SHARE_KEYS), invalidFields };
}

const ISO_KEYS = ["values", "label", "unit", "highlight"];

export function toIsoConfig(data: Record<string, unknown>): SpecResult<IsoConfig> {
  const invalidFields: string[] = [];
  let values: "auto" | number[] | null = null;

  if (data.values === "auto") {
    values = "auto";
  } else if (CompareUtil.isArray(data.values) && (data.values as unknown[]).every((v) => CompareUtil.isNumber(v))) {
    values = data.values as number[];
  } else {
    invalidFields.push("values");
  }

  if (values === null) {
    return { config: null, unknownKeys: collectUnknownKeys(data, ISO_KEYS), invalidFields };
  }

  const config: IsoConfig = { values };
  config.label = readString(data, "label", invalidFields);
  config.unit = readString(data, "unit", invalidFields);

  if (CompareUtil.isExisting(data.highlight)) {
    if (CompareUtil.isObject(data.highlight) && !Array.isArray(data.highlight)) {
      const from = readNumber(data.highlight as Record<string, unknown>, "from", invalidFields);
      if (from !== undefined) {
        config.highlight = { from };
      }
    } else {
      invalidFields.push("highlight");
    }
  }

  return { config, unknownKeys: collectUnknownKeys(data, ISO_KEYS), invalidFields };
}

const LABEL_KEYS = ["points", "values", "max"];

export function toLabelConfig(
  data: Record<string, unknown>,
  defaults: { points: LabelConfig["points"]; values: boolean; max: number },
): SpecResult<LabelConfig> {
  const invalidFields: string[] = [];
  const config: LabelConfig = { points: defaults.points, values: defaults.values, max: defaults.max };

  if (CompareUtil.isExisting(data.points)) {
    if (data.points === "auto" || data.points === "none" || data.points === "all") {
      config.points = data.points;
    } else if (CompareUtil.isArray(data.points) && (data.points as unknown[]).every((p) => CompareUtil.isString(p))) {
      config.points = data.points as string[];
    } else {
      invalidFields.push("points");
    }
  }

  if (CompareUtil.isExisting(data.values)) {
    if (CompareUtil.isBoolean(data.values)) {
      config.values = data.values;
    } else {
      invalidFields.push("values");
    }
  }

  if (CompareUtil.isExisting(data.max)) {
    if (CompareUtil.isNumber(data.max) && data.max > 0) {
      config.max = Math.floor(data.max as number);
    } else {
      invalidFields.push("max");
    }
  }

  return { config, unknownKeys: collectUnknownKeys(data, LABEL_KEYS), invalidFields };
}

const FACET_KEYS = ["level", "columns"];

export function toFacetConfig(data: Record<string, unknown>): SpecResult<FacetConfig> {
  const invalidFields: string[] = [];
  const level = CompareUtil.isString(data.level) ? data.level.toLowerCase() : null;

  if (level !== "rowgroup" && level !== "category") {
    invalidFields.push("level");
    return { config: null, unknownKeys: collectUnknownKeys(data, FACET_KEYS), invalidFields };
  }

  const config: FacetConfig = { level };

  if (CompareUtil.isExisting(data.columns)) {
    if (CompareUtil.isNumber(data.columns) && data.columns >= 1) {
      config.columns = Math.floor(data.columns as number);
    } else {
      invalidFields.push("columns");
    }
  }

  return { config, unknownKeys: collectUnknownKeys(data, FACET_KEYS), invalidFields };
}

const LEGEND_KEYS = ["show", "position"];

export function toLegendConfig(data: Record<string, unknown>): SpecResult<LegendConfig> {
  const invalidFields: string[] = [];
  const config: LegendConfig = { show: true, position: "right" };

  if (CompareUtil.isExisting(data.show)) {
    if (CompareUtil.isBoolean(data.show)) {
      config.show = data.show;
    } else {
      invalidFields.push("show");
    }
  }

  if (CompareUtil.isExisting(data.position)) {
    if (data.position === "right" || data.position === "bottom") {
      config.position = data.position;
    } else {
      invalidFields.push("position");
    }
  }

  return { config, unknownKeys: collectUnknownKeys(data, LEGEND_KEYS), invalidFields };
}
