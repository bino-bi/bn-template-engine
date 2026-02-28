import { IAdapter } from "../helper/IAdapter";
import { CompareUtil } from "../helper/CompareUtil";

/** SI metric prefix for number scaling (e.g. prefix="M", value=1000000 divides displayed values by one million). */
export class SiPrefix {
  constructor(
    public prefix: string = "",
    public value: number = 1,
  ) {}
}

export class SiPrefixAdapter implements IAdapter<SiPrefix> {
  adapt(data: Record<string, unknown>): SiPrefix {
    const prefix = new SiPrefix();

    if (CompareUtil.isString(data.prefix)) {
      prefix.prefix = data.prefix;
    }

    if (CompareUtil.isNumber(data.value)) {
      prefix.value = data.value;
    }

    return prefix;
  }

  default(): SiPrefix {
    return new SiPrefix();
  }
}
