import {DateTime} from "luxon";
import { DateDistance, DateLink } from "../../../../../utils/DateStringFactory";
import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { CompareUtil } from "../../../../../utils/helper/CompareUtil";

export class TimePeriod {



  constructor(public start: DateTime = DateTime.now(),
    public end: DateTime = DateTime.now(),
    public format: DateDistance = DateDistance.AUTO,
    public link: DateLink = DateLink.AUTO) {
  }
}

export class TimePeriodAdapter implements IAdapter<TimePeriod> {
  construnctor() {
  }

  adapt(data: any): TimePeriod {
    const entry: TimePeriod = new TimePeriod();

    if (CompareUtil.isDate(data.start)) {
      entry.start = data.start;
    }

    if (CompareUtil.isDate(data.end)) {
      entry.end = data.end;
    }

    if (CompareUtil.isExisting(data.format)) {
      entry.format = data.format;
    }


    if (CompareUtil.isExisting(data.format)) {
      entry.link = data.link;
    }

    return entry;
  }

  default(): TimePeriod {
    return new TimePeriod();
  }
}
