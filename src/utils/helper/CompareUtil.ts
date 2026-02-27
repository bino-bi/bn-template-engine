import { DateTime } from "luxon";

export class CompareUtil {
  public static isExisting(data: any | undefined): boolean {
    return data !== null && data !== undefined;
  }

  public static isString(data: any | undefined): boolean {
    return typeof data === "string";
  }

  public static isNumber(data: any | undefined): boolean {
    return typeof data === "number" && !Number.isNaN(data);
  }

  public static isBoolean(data: any | undefined): boolean {
    return typeof data === "boolean";
  }

  public static isArray(data: any | undefined): boolean {
    return Array.isArray(data);
  }

  public static isObject(data: any | undefined): boolean {
    return data === new Object(data);
  }

  static isOperator(data: any | undefined): boolean {
    return data === "+" || data === "-";
  }

  static isDate(data: any | undefined): boolean {
    return data instanceof DateTime && data.isValid;
  }
}
