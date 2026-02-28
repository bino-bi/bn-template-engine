import { DateTime } from "luxon";

/**
 * Type-checking utility used throughout the adapter layer for safe JSON-to-domain conversion.
 *
 * All methods are static guards that validate a single `unknown` value before it is
 * assigned to a typed domain property. Methods that serve as TypeScript type guards
 * use `data is T` return types to enable downstream type narrowing.
 */
export class CompareUtil {
  public static isExisting(data: unknown): boolean {
    return data !== null && data !== undefined;
  }

  public static isString(data: unknown): data is string {
    return typeof data === "string";
  }

  public static isNumber(data: unknown): data is number {
    return typeof data === "number" && !Number.isNaN(data);
  }

  public static isBoolean(data: unknown): data is boolean {
    return typeof data === "boolean";
  }

  public static isArray(data: unknown): data is unknown[] {
    return Array.isArray(data);
  }

  public static isObject(data: unknown): boolean {
    return data === new Object(data);
  }

  /**
   * Checks if the value is a valid IBCS aggregation operator.
   * Only `"+"` and `"-"` are valid; any other value is rejected.
   */
  static isOperator(data: unknown): boolean {
    return data === "+" || data === "-";
  }

  /**
   * Checks if the value is a valid Luxon DateTime instance.
   * Returns false for invalid DateTime objects (e.g. parsed from malformed strings).
   */
  static isDate(data: unknown): data is DateTime {
    return data instanceof DateTime && data.isValid;
  }
}
