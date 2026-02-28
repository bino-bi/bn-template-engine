import { CompareUtil } from "./CompareUtil";
import { IAdapter } from "./IAdapter";

/** Shared utilities for the adapter layer, used by all component config adapters. */
export class AdapterUtils {
  /** Returns the trimmed string value, or an empty string if the input is not a string. */
  public static adaptDefaultString(data: unknown): string {
    if (CompareUtil.isString(data)) {
      return data.trim();
    }

    return "";
  }

  /**
   * Safely adapts an array of untyped records through a typed adapter.
   * If `data` is not an array, returns an empty array instead of throwing.
   */
  public static adaptArray<T>(data: unknown, adapter: IAdapter<T>): T[] {
    const targetArray: T[] = [];

    if (CompareUtil.isArray(data)) {
      data.forEach((b: unknown) => {
        targetArray.push(adapter.adapt(b as Record<string, unknown>));
      });
    }

    return targetArray;
  }
}
