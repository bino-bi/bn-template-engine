import { IAdapter } from "../helper/IAdapter";
import { CompareUtil } from "../helper/CompareUtil";

export class DataFormatDigits {
  constructor(
    public percent: number = 2,
    public decimal: number = 1,
  ) {}
}

export class DataFormatDigitsAdapter implements IAdapter<DataFormatDigits> {
  adapt(data: Record<string, unknown>): DataFormatDigits {
    const prefix = new DataFormatDigits();

    if (CompareUtil.isNumber(data.percent)) {
      prefix.percent = data.percent;
    }

    if (CompareUtil.isNumber(data.decimal)) {
      prefix.decimal = data.decimal;
    }

    return prefix;
  }

  default(): DataFormatDigits {
    return new DataFormatDigits();
  }
}
