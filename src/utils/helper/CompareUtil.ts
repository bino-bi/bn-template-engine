import { DateTime } from "luxon";

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

  static isOperator(data: unknown): boolean {
    return data === "+" || data === "-";
  }

  static isDate(data: unknown): data is DateTime {
    return data instanceof DateTime && data.isValid;
  }
}
