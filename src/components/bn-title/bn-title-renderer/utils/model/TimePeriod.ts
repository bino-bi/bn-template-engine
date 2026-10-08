import { DateTime } from "luxon";
import { DateDistance, DateLink } from "../../../../../utils/DateStringFactory";
import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { CompareUtil } from "../../../../../utils/helper/CompareUtil";

export class TimePeriod {
  constructor(
    public start: DateTime = DateTime.now(),
    public end: DateTime = DateTime.now(),
    public format: DateDistance = DateDistance.AUTO,
    public link: DateLink = DateLink.AUTO,
  ) {}
}

export class TimePeriodAdapter implements IAdapter<TimePeriod> {
  construnctor() {}

  adapt(data: Record<string, unknown>): TimePeriod {
    const entry: TimePeriod = new TimePeriod();

    if (CompareUtil.isDate(data.start)) {
      entry.start = data.start;
    }

    if (CompareUtil.isDate(data.end)) {
      entry.end = data.end;
    }

    if (CompareUtil.isExisting(data.format)) {
      entry.format = data.format as DateDistance;
    }

    if (CompareUtil.isExisting(data.link)) {
      entry.link = data.link as DateLink;
    }

    return entry;
  }

  default(): TimePeriod {
    return new TimePeriod();
  }
}
