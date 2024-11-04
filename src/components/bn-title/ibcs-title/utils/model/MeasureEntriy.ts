import { IAdapter } from "../../../../utils/helper/IAdapter";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";

export class MeasureEntry {
  constructor(public name: string = '',
    public unit: string = '') {
  }
}

export class MeasureEntryAdapter implements IAdapter<MeasureEntry> {
  construnctor() {
  }

  adapt(data: any): MeasureEntry {
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
    return new MeasureEntry('', '');
  }
}
