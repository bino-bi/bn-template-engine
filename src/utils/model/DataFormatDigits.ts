import { IAdapter } from "../helper/IAdapter";
import { CompareUtil } from "../helper/CompareUtil";

/** Decimal precision configuration: separate digit counts for percent columns vs absolute (decimal) columns. */
export class DataFormatDigits {
  constructor(
    public percent: number = 2,
    public decimal: number = 1,
    /** False: a relative variance prints as a plain number, the unit stands in the title of its row. */
    public percentSign?: boolean,
  ) {}
}

export class DataFormatDigitsAdapter implements IAdapter<DataFormatDigits> {
  adapt(data: Record<string, unknown>): DataFormatDigits {
    const prefix = new DataFormatDigits();

    // Intl.NumberFormat throws outside 0 to 100
    const valid = (value: unknown): value is number =>
      CompareUtil.isNumber(value) && Number.isInteger(value) && value >= 0 && value <= 100;

    if (valid(data.percent)) {
      prefix.percent = data.percent;
    }

    if (valid(data.decimal)) {
      prefix.decimal = data.decimal;
    }

    if (data.percentSign === false) {
      prefix.percentSign = false;
    }

    return prefix;
  }

  default(): DataFormatDigits {
    return new DataFormatDigits();
  }
}
