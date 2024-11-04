import { CompareUtil } from "./CompareUtil";
import { IAdapter } from "./IAdapter";

export class AdapterUtils {
  public static adaptDefaultString(data: any): string {
    if (CompareUtil.isString(data)) {
      return data.trim();
    }

    return '';
  }

  public static adaptArray<T>(data: any, adapter: IAdapter<T>): T[] {
    const targetArray: any = [];

    if (CompareUtil.isArray(data)) {
      data.forEach((b: any) => {
        targetArray.push(adapter.adapt(b));
      })
    }

    return targetArray;
  }

}
