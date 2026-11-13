/**
 * Prop validators for Stencil @Watch handlers.
 *
 * Each validator returns an array of invalid items; an empty array means the input is valid.
 * These are used in component @Watch methods to warn about malformed attribute values
 * without crashing the component.
 */
import {
  AggregationLevel,
  AxisLabelsMode,
  DataFormat,
  I18nMode,
  MeasureType,
  Scenarios,
  Sentiments,
  TableBarColumnWidth,
  TableCategoryWidth,
  TableType,
} from "./constants";
import { ThereofPosition } from "../components/bn-table/utils/model";
import { isValidAttributeExpression } from "../components/bn-table/utils/model/TableAttribute";
import { DateDistance, DateLink } from "./DateStringFactory";
import { OrderColumn, OrderDirection, parseOrderToken } from "./model/Order";
import { resolveMeasure } from "./xy/VarianceMeasure";

/**
 * Checks whether a value is blank, null, undefined, or the string `"null"`.
 * The string `"null"` check handles serialized null values from HTML attributes,
 * which arrive as the literal string "null" rather than a JS null.
 */
export function isBlankInput(value: unknown): boolean {
  return value === null || value === undefined || value === "" || value === "null";
}

/**
 * Validates a comma-separated list of scenario identifiers.
 * The special value `"auto"` is always valid. Base scenarios are validated against
 * the Scenarios enum; remaining invalid entries are passed to `validateVariancesList`
 * for variance format checking (e.g. `d_ac1_pl1_pos`).
 */
/** `none` as the scenario list of a chart: draw no scenario, only the variances. */
export function isNoScenarios(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "none";
}

export function validateScenarioList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  if (value.trim().toLowerCase() === "auto") {
    return [];
  }

  const invalidScenarios: string[] = value
    ?.split(",")
    .filter((element) => !(element.toUpperCase().trim() in Scenarios));

  return validateVariancesList(invalidScenarios.toString());
}

/**
 * Validates variance identifiers in the format `d_<base>_<delta>_<sentiment>` or
 * `dr_<base>_<delta>_<sentiment>`. Each component is checked against the Scenarios
 * and Sentiments enums. Returns items that fail validation.
 */
export function validateVariancesList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  const invalidScenarios: string[] = value
    .replace(";", ",")
    .split(",")
    .filter((element) => {
      const splittedElement = element.split("_");

      const scenarioSubtrahend = splittedElement[0]
        ?.replace(/^dr|^d/, "")
        .toUpperCase()
        .trim();
      const scenarioMinuend = splittedElement[1]?.toUpperCase().trim();
      const scenarioSentiment = splittedElement[2]?.toUpperCase().trim();

      return (
        splittedElement.length !== 3 ||
        !(scenarioSubtrahend in Scenarios) ||
        !(scenarioMinuend in Scenarios) ||
        !(scenarioSentiment in Sentiments)
      );
    });

  return invalidScenarios;
}

/**
 * Validates a comma-separated list of bar column identifiers. Both base scenarios
 * (e.g. `ac1`) and variances (e.g. `dac1_pp1_pos`) are valid entries.
 * Returns items that fail validation.
 */
export function validateBarColumnsList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  const invalidScenarios: string[] = value.split(",").filter((element) => !(element.toUpperCase().trim() in Scenarios));

  return validateVariancesList(invalidScenarios.toString());
}

export function validateOrderList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  if (value.trim().toLowerCase() === "auto") {
    return [];
  }

  const invalidScenarios: string[] = value.split(",").filter((element) => !(element.toUpperCase() in OrderColumn));

  return validateVariancesList(invalidScenarios.toString());
}

/** bn-table order: dims, scenarios and variances, the last two optionally with `@<setname>`. */
export function validateTableOrderList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  if (value.trim().toLowerCase() === "auto") {
    return [];
  }

  return value.split(",").filter((element) => parseOrderToken(element) === undefined);
}

export function isValidInteger(value: number | string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return Number.isInteger(Number(value));
}

export function isValidNumber(value: number | string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return !Number.isNaN(Number(value));
}

export function isValidDirection(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return value?.toUpperCase() in OrderDirection;
}

export function isValidLevel(value: string): boolean {
  if (value?.toLowerCase() === "auto") {
    return true;
  }
  return value?.toUpperCase() in AggregationLevel;
}

export function validateMeasureList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      return newObj.filter((elem) => !(elem.hasOwnProperty("name") && elem.hasOwnProperty("unit")));
    }
  } catch (e) {
    console.error("validateMeasureList: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

export function validateMarkerType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      return newObj.filter(
        (elem) =>
          !elem.hasOwnProperty("latitude") && !elem.hasOwnProperty("longitude") && !elem.hasOwnProperty("iconUrl"),
      );
    }
  } catch (e) {
    throw e;
  }

  return ["Invalid JSON structure"];
}

export function validateGpxType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      return newObj.filter((elem) => !elem.hasOwnProperty("file"));
    }
  } catch (e) {
    throw e;
  }

  return ["Invalid JSON structure"];
}

export function validateGeojsonType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      return newObj.filter((elem) => !elem.hasOwnProperty("file"));
    }
  } catch (e) {
    throw e;
  }

  return ["Invalid JSON structure"];
}

export function isValidDate(value: string): boolean {
  const newDate: number = Date.parse(value);
  return Number.isInteger(newDate);
}

export function isValidDateLink(value: string): boolean {
  return value?.toUpperCase() in DateLink;
}

export function isValidDateFormat(value: string): boolean {
  return value?.toUpperCase() in DateDistance;
}

export function isValidAxisLabelsMode(value: string): boolean {
  return value?.toUpperCase() in AxisLabelsMode;
}

export function isValidDataFormat(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }
  return value?.toUpperCase() in DataFormat;
}

export function isValidTableType(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return value?.toUpperCase() in TableType;
}

export function isValidThereofPosition(value: string): boolean {
  return value?.toUpperCase() in ThereofPosition;
}

export function validateThereOfJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (jsonObject instanceof Array) {
      // return newObj.filter(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))
      return jsonObject.filter(
        (elem) =>
          !(elem.hasOwnProperty("rowGroup") && elem.hasOwnProperty("category") && elem.hasOwnProperty("subCategory")),
      );
    }
  } catch (err) {
    console.error("validateThereOfJsonStr: failed to parse JSON", err);
  }
  return ["Invalid JSON structure"];
}

/**
 * Validates the bn-table `attributes` prop: a JSON object mapping column labels
 * to aggregate expressions like `set(_leiter)` or `sum(ac1)`.
 * Returns the offending `label: expression` entries; empty array means valid.
 */
export function validateAttributesJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (jsonObject !== null && typeof jsonObject === "object" && !(jsonObject instanceof Array)) {
      return Object.entries(jsonObject)
        .filter(([, expression]) => typeof expression !== "string" || !isValidAttributeExpression(expression))
        .map(([label, expression]) => `${label}: ${expression}`);
    }
  } catch (err) {
    console.error("validateAttributesJsonStr: failed to parse JSON", err);
  }
  return ["Invalid JSON structure"];
}

export function validatePartOfJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (jsonObject instanceof Array) {
      // return newObj.filter(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))
      return jsonObject.filter((elem) => !(elem.hasOwnProperty("rowGroup") && elem.hasOwnProperty("category")));
    }
  } catch (e) {
    console.error("validatePartOfJsonStr: failed to parse JSON", e);
  }
  return ["Invalid JSON structure"];
}

export function isValidi18nMode(value: string): boolean {
  return value?.trim().toUpperCase() in I18nMode;
}

export function isValidMeasureType(value: string): boolean {
  return value?.trim().toUpperCase() in MeasureType;
}

/**
 * Validates a measure-scale attribute value.
 * Accepted values: `"_"` (no scaling), SI prefix letters (k, M, G, T, P, E, Z, Y, m, etc.;
 * micro as `"my"` or `"μ"`), or auto-detection modes `"GREATEST"` / `"LEAST"`.
 */
export function isValidMeasureScale(value: string): boolean {
  return (
    ["_", "k", "M", "G", "T", "P", "E", "Z", "Y", "m", "my", "μ", "n", "p", "f", "a", "z", "y"].includes(
      value?.trim(),
    ) || ["GREATEST", "LEAST"].includes(value?.trim().toUpperCase())
  );
}

export function validateI18nString(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }
  try {
    const jsonObject = JSON.parse(value);
    const errList = [];

    for (const value in jsonObject) {
      if (typeof jsonObject[value] === "object") {
        errList.push(value + ":" + jsonObject[value]);
      }
      return errList;
    }
  } catch (e) {
    console.error("validateI18nString: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

export function validateStylesString(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }
  try {
    JSON.parse(value);
    return [];
  } catch (e) {
    console.error("validateStylesString: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

export function isTableCategoryWidth(value: string): boolean {
  return value?.toUpperCase().trim() in TableCategoryWidth;
}

export function isTableBarColumnWidth(value: string): boolean {
  return value?.toUpperCase().trim() in TableBarColumnWidth;
}

export function validateColumnThereOfJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    return jsonObject.filter(
      (elem) => !(elem.hasOwnProperty("scenario") && elem.hasOwnProperty("name") && elem.hasOwnProperty("subGroups")),
    );
  } catch (e) {
    console.error("validateColumnThereOfJsonStr: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

export function validateStackConfig(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const config = JSON.parse(value);

    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      return ["stack: must be a JSON object"];
    }

    const errors: string[] = [];

    if (!config.hasOwnProperty("by")) {
      errors.push("stack: 'by' is required");
    } else {
      const validBy = ["scenarios", "dimensions"];
      if (!validBy.includes(config.by)) {
        errors.push(`stack: 'by' must be one of: ${validBy.join(", ")}`);
      }
    }

    if (config.hasOwnProperty("mode")) {
      const validModes = ["absolute", "relative", "absolute-relative"];
      if (!validModes.includes(config.mode)) {
        errors.push(`stack: 'mode' must be one of: ${validModes.join(", ")}`);
      }
    }

    if (config.hasOwnProperty("order")) {
      const validOrders = ["asc", "desc", "dataset"];
      if (!validOrders.includes(config.order)) {
        errors.push(`stack: 'order' must be one of: ${validOrders.join(", ")}`);
      }
    }

    return errors;
  } catch (_e) {
    return ["stack: invalid JSON"];
  }
}

// @ts-ignore - Parameter reserved for future validation
export function isValidFontSize(_value: string): boolean {
  return true;
}

// @ts-ignore - Parameter reserved for future validation
export function isValidFontFamily(_value: string): boolean {
  return true;
}

export function isValidTreeDirection(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }
  return ["ltr", "rtl", "ttb", "btt"].includes(value?.toLowerCase().trim());
}

export function isValidEdgeStyle(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }
  return ["straight", "orthogonal", "curved"].includes(value?.toLowerCase().trim());
}

export function validateTreeEdgesJson(value: string): string[] {
  if (isBlankInput(value)) {
    return ["edges: value is required"];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (!Array.isArray(jsonObject)) {
      return ["edges: must be an array"];
    }

    if (jsonObject.length === 0) {
      return ["edges: array must not be empty"];
    }

    const errors: string[] = [];
    const validOperators = ["*", "/", "+", "-", "x", "÷", "none"];

    jsonObject.forEach((edge, index) => {
      if (typeof edge !== "object" || edge === null) {
        errors.push(`edges[${index}]: must be an object`);
        return;
      }

      if (typeof edge.from !== "string" || edge.from.trim() === "") {
        errors.push(`edges[${index}]: 'from' is required`);
      }

      if (typeof edge.to !== "string" || edge.to.trim() === "") {
        errors.push(`edges[${index}]: 'to' is required`);
      }

      if (edge.operator !== undefined && !validOperators.includes(edge.operator)) {
        errors.push(`edges[${index}]: 'operator' must be one of: ${validOperators.join(", ")}`);
      }
    });

    return errors;
  } catch (e) {
    console.error("validateTreeEdgesJson: failed to parse JSON", e);
    return ["edges: invalid JSON structure"];
  }
}

/**
 * Checks whether a value is a valid XY chart measure token: a scenario
 * column (`ac1`…`pl4`) or a variance token (`d…`/`dr…`, sentiment suffix
 * optional - spec §4.4 of the scatter/bubble charts).
 */
export function isValidMeasureToken(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return resolveMeasure(value) !== null;
}
