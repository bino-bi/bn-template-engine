import { CompareUtil } from "./CompareUtil";
import { IAdapter } from "./IAdapter";

export class AdapterUtils {
  public static adaptDefaultString(data: unknown): string {
    if (CompareUtil.isString(data)) {
      return data.trim();
    }

    return "";
  }

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
