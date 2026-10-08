//import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";

export class MeasureEntry {
  constructor(
    public name: string = "",
    public unit: string = "",
  ) {}
}

export class MeasureEntryAdapter implements IAdapter<MeasureEntry> {
  construnctor() {}

  adapt(data: Record<string, unknown>): MeasureEntry {
    const entry: MeasureEntry = new MeasureEntry();

    if (CompareUtil.isString(data.name)) {
      entry.name = data.name;
    }

    if (CompareUtil.isString(data.unit)) {
      entry.unit = data.unit;
    }

    return entry;
  }

  default(): MeasureEntry {
    return new MeasureEntry("", "");
  }
}
