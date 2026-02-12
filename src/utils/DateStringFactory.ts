import {DateTime, DateTimeUnit, DurationLike} from "luxon";
import { DateFormat, DateLinkFormat } from "../components/bn-chart-time/utils/model"; //TODO: JHE:  Merge Title und Cahrt DateFormat...
//import {DateFormat, DateLinkFormat} from "../components/ibcs-chart-time/utils/model";

export enum DateDistance {
  YEAR = "year",
  QUARTER = "quarter",
  MONTH = "month",
  WEEK = "week",
  DAY = "day",
  HOUR = "hour",
  MINUTE = "minute",
  SECOND = "second",
  MILLISECOND = "millisecond",
  NONE = "fallback",
  AUTO = "auto",
}

export enum DateLink {
  AVG = "avg",
  INTERVAL = "interval",
  START = "start",
  END = "end",
  YTD = "ytd",
  YTG = "ytg",
  CUM = "cum",
  MAT = "mat",
  NONE = "none",
  AUTO = "auto",
}

export class DateStringFactory {

  private readonly _dateFormat: DateFormat = {
    year: "yyyy",
    quarter: "q'Q' yyyy",
    month: "LLL yyyy",
    week: "'KW'WW yyyy",
    day: "dd.MM.yyyy",
    hour: "TT",
    minute: "TT",
    second: "TT",
    millisecond: "TT:SSS",
    fallback: "dd.MM.yyyy",
  };

  private readonly _dateFormatShort: DateFormat = {
    year: "yy",
    quarter: "q'Q'",
    month: "LLL",
    week: "'KW'WW",
    day: "dd",
    hour: "hh'h'",
    minute: "mm'm'",
    second: "ss's'",
    millisecond: "SSS'ms'",
    fallback: "dd.MM.yyyy",
  };

  private readonly _dateLinkFormat: DateLinkFormat = {
    avg: "Ø[LINK]",
    interval: "[DATE]..[DATE2]",
    start: ".[DATE]",
    end: "[DATE].",
    ytd: "_[DATE]",
    ytg: "[DATE]_",
    cum: "[DATE]_[DATE2]",
    mat: "~[DATE]",
    none: "[DATE]",
  };

  private dateFormat: DateFormat;
  private dateLinkFormat: DateLinkFormat;
  private dateFormatShort: DateFormat;
  private locale: string = "de";


  constructor() {
    this.dateFormat = this._dateFormat;
    this.dateLinkFormat = this._dateLinkFormat;
    this.dateFormatShort = this._dateFormatShort;

    /*
    // FIXME: JHE: kein custom support in Luxon
    DateTime.updateLocale('de', {
      monthsShort: 'Jan_Feb_Mrz_Apr_Mai_Jun_Jul_Aug_Sep_Okt_Nov_Dez'.split('_'),
    });

     */
  }

  public setDateLinkFormat(datelink: DateLinkFormat) {
    this.dateLinkFormat = datelink;
  }

  public setDateFormat(dateFormat: DateFormat) {
    this.dateFormat = dateFormat;
  }

  public setDateFormatShort(dateFormatShort: DateFormat) {
    this.dateFormatShort = dateFormatShort;
  }

  public setLocale(locale: string) {
     this.locale = locale;
  }

  /**
   * Converts date string based on dateFormatMap and  the selected Type
   *
   * @param date 
   * @param type?
   */
  public getDateString(date: DateTime, type?: DateDistance): string {
    return date.setLocale(this.locale).toFormat(this.dateFormat[type as string] || this.dateFormat["fallback"]);
  }

  /**
   * Converts date string based on dateFormatMap and  the selected Type
   *
   * @param date 
   * @param type?
   */
  public getSmartDateString(date: DateTime, type: DateDistance): string {
    switch (type) {
      case DateDistance.DAY: {
        return this.getFormatedDayDate(date);
      }
      case DateDistance.MONTH: {
        return this.getFormatedMonthDate(date);
      }
      case DateDistance.QUARTER: {
        return this.getFormatedQuarterDate(date);
      }
      case DateDistance.WEEK: {
        return this.getFormatedWeekDate(date);
      }
      case DateDistance.HOUR: {
        return this.getFormatedHourDate(date);
      }
      case DateDistance.MINUTE: {
        return this.getFormatedMinuteDate(date);
      }
      case DateDistance.SECOND: {
        return this.getFormatedSecondDate(date);
      }
      case DateDistance.MILLISECOND: {
        return this.getFormatedMilliSecondDate(date);
      }
      default: {
        return this.getDateString(date, type);
      }
    }
  }

  
  /**
   * Calulating best fitting DateDistance type between 2 dates
   *
   * @param start
   * @param end
   */
  public calculateDistanceType(start: DateTime | number, end: DateTime | number | null, limit: number = 32): DateDistance {
    if (end == null) {
      return DateDistance.DAY
    }

    

    let mStart: DateTime = typeof start == 'number'? DateTime.fromMillis(start): start;
    let mEnd: DateTime = typeof end == 'number'? DateTime.fromMillis(end): end;

   

    if(mEnd.diff(mStart).as('milliseconds')  == 0 ){
       return DateDistance.DAY;
    }else if (mEnd.diff(mStart).as('milliseconds') < limit) {
      return DateDistance.MILLISECOND;
    } else if (mEnd.diff(mStart).as('seconds') < limit) {
      return DateDistance.SECOND;
    } else if (mEnd.diff(mStart).as('minutes') < limit) {
      return DateDistance.MINUTE;
    } else if (mEnd.diff(mStart).as('hours') < limit) {
      return DateDistance.HOUR;
    } else if (mEnd.diff(mStart).as('days') < limit) {
      return DateDistance.DAY;
    } else if (mEnd.diff(mStart).as('weeks') < limit) {
      return DateDistance.WEEK;
    } else if (mEnd.diff(mStart).as('months') < limit) {
      return DateDistance.MONTH;
    } else if (mEnd.diff(mStart).as('quarters') < limit) {
      return DateDistance.QUARTER;
    } else {
      return DateDistance.YEAR;
    }

  }

  /**
   * Get an array of moment instances, each representing a day beween given timestamps.
   * @param {string|Date} from start date
   * @param {string|Date} to end date
   * @param dateInterval
   * @param spanLimit
   */
  public datesBetween(from: DateTime, to: DateTime, dateInterval: DateDistance, spanLimit: number): DateTime[] {

    const unit: DateTimeUnit = this.convertDateDistanceToMomentunitOfTime(dateInterval);

    const fromDate = from.startOf(unit);
    const toDate = to.endOf(unit);

    let span = toDate.diff(fromDate).as(unit);

    const days = [];

    if (span >= spanLimit) {
      console.warn('Clip Span from', span, 'to spanLimit', spanLimit);
      span = spanLimit;
    }

    let currentDate = fromDate;

    do {
      days.push(currentDate);
      currentDate = currentDate.plus(this.createDiratonLike(unit, 1));
    } while(currentDate <= toDate && days.length < span)

    return days;
  }

  /**
   * Creates DateString depending on date, mode and type.
   *
   * if mode is set to auto a type will be calculated internaly
   * in this case the type parameter will be ignored
   *
   * function validates parameter if a  invalid  empty string is returned
   * @param date1 start date
   * @param date2
   * @param mode
   * @param type
   */
  public getDateLinkString(startDateTime: DateTime | null, endDateTime: DateTime | null, mode: DateLink, type: DateDistance, spanLimit: number): string {
    // No Start/ End Date exists
    if (startDateTime == null && endDateTime == null) {
      // BinoSystem.warn('NO START AND END DATE SELECTED');
      return "";
    }

    if (startDateTime == null && !( mode == DateLink.END || mode == DateLink.YTD)) {
      // BinoSystem.warn('NO START N SELECTED');
      return "";
    }

    if (endDateTime == null && (DateLink.INTERVAL === mode || DateLink.CUM === mode ||  DateLink.END  === mode || DateLink.YTD === mode)) {
      // BinoSystem.warn('NO END N SELECTED');
      return "";
    }

    let date1: DateTime = startDateTime || DateTime.now();
    let date2: DateTime | null = endDateTime;

    

    // calculate type value aka. auto-mode
    if (type === DateDistance.AUTO) {
      type = this.calculateDistanceType(date1, date2, spanLimit);
    }

    let dateString1 = this.getDateString(date1, type);
    let dateString2 = '';
    let link = DateLink.NONE;

    if(date2 != null) {
      dateString2 = this.getDateString(date2, type);
      link = DateLink.INTERVAL;
      // clean up visualisation if start and end (formated) ist identical
      if (dateString1 === dateString2 && mode === DateLink.INTERVAL ) {
        // BinoSystem.warn('CHANGED INTERVAL TO NONE; START AND END ARE IDENTICAL');
        mode = DateLink.NONE;
      }
      if (dateString1 === dateString2 && mode == DateLink.AVG) {
        // BinoSystem.warn('CHANGED INTERVAL TO NONE; START AND END ARE IDENTICAL');
        link = DateLink.NONE;
      }

      if (( DateLink.END  === mode || DateLink.YTD === mode) ) {
        dateString1 = dateString2;
      }

      // clean up dateString1 if same year
      if (mode === DateLink.INTERVAL || mode === DateLink.CUM || DateLink.AVG ) {

       
        if (type === DateDistance.QUARTER){
          if( date1.quarter === date2.quarter && date1.year === date2.year ) {
              dateString2 = dateString2.replace(" " + date2.year, "");
          } else if (date1.year === date2.year) {
              dateString1 = dateString1.replace(" " + date1.year, "");
          }
        }
        else if(type === DateDistance.MONTH){
          if(date1.month === date2.month && date1.year === date2.year ) {
            dateString2 = dateString2.replace(" " + date2.year, "");
          } else if (date1.year === date2.year) {
            dateString1 = dateString1.replace(" " + date1.year, "");
          }
        }
        else if(type === DateDistance.WEEK) {
          if(date1.weekNumber === date2.weekNumber && date1.year === date2.year ) {
            dateString2 = dateString2.replace(" " + date2.year, "");
          } else if (date1.year === date2.year) {
            dateString1 = dateString1.replace(" " + date1.year, "");
          }
        }  
      }
    }

    return this.dateLinkFormat[mode as string].replace("[LINK]",  this.dateLinkFormat[link]).replace("[DATE]", dateString1).replace("[DATE2]", dateString2);
  }

  getShortDateString(date: DateTime, type: DateDistance) {
    return date.setLocale(this.locale).toFormat(this.dateFormatShort[type as string] || this.dateFormatShort["fallback"]);
  }

  private getFormatedDayDate(date: DateTime) {
    let format = this.dateFormatShort["day"];

    if (this.isFirstInMonth(date)) {
      format += " " + this.dateFormatShort["month"];
    }

    if (this.isJanuary(date)) {
      format += " " + this.dateFormatShort["year"];
    }

    return date.setLocale(this.locale).toFormat(format);
  }


  private getFormatedMonthDate(date: DateTime) {
    let format = this.dateFormatShort["month"];

    if (this.isJanuary(date)) {
      format += " " + this.dateFormatShort["year"];
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedQuarterDate(date: DateTime) {
    let format = this.dateFormatShort["quarter"];

    if (this.isFirstQuarter(date)) {
      format += " " + this.dateFormatShort["year"];
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedWeekDate(date: DateTime) {
    let format = this.dateFormatShort["week"];

    if (this.isFirstWeek(date)) {
      format += " " + this.dateFormatShort["year"];
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedHourDate(date: DateTime) {
    let format = this.dateFormatShort["hour"];

    if (this.isFirstHour(date)) {
      format += " " + this.dateFormatShort["day"];
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedMinuteDate(date: DateTime) {
    let format = this.dateFormatShort["minute"];

    if (this.isFirstMinute(date)) {
      format = this.dateFormatShort["hour"] + ":" + format;
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedSecondDate(date: DateTime) {
    let format = this.dateFormatShort["second"];

    if (this.isFirstSecond(date)) {
      format = this.dateFormatShort["minute"] + ":" + format;
    }

    return date.setLocale(this.locale).toFormat(format);
  }

  private getFormatedMilliSecondDate(date: DateTime) {
    let format = this.dateFormatShort["millisecond"];

    if (this.isFirstMilliSecond(date)) {
      format = this.dateFormatShort["second"] + ":" + format;
    }

    return date.setLocale(this.locale).toFormat(format);
  }


  private isFirstInMonth(date: DateTime) {
    return date.day == 1;
  }

  private isJanuary(date: DateTime) {
    return date.month == 1;
  }

  private isFirstQuarter(date: DateTime) {
    return date.quarter == 1;
  }

  private isFirstWeek(date: DateTime) {
    return date.weekNumber == 1;
  }

  private isFirstHour(date: DateTime) {
    return date.hour == 0;
  }

  private isFirstMinute(date: DateTime) {
    return date.minute == 0;
  }

  private isFirstSecond(date: DateTime) {
    return date.second == 0;
  }

  private isFirstMilliSecond(date: DateTime) {
    return date.millisecond == 0;
  }

  private convertDateDistanceToMomentunitOfTime(dateInterval: DateDistance): DateTimeUnit {
    let unitOfTime: DateTimeUnit;

    switch (dateInterval) {
      case DateDistance.YEAR:
        unitOfTime = 'year';
        break;
      case DateDistance.MONTH:
        unitOfTime = 'month';
        break;
      case DateDistance.QUARTER:
        unitOfTime = 'quarter';
        break;
      case DateDistance.WEEK:
        unitOfTime = 'week';
        break;
      case DateDistance.DAY:
        unitOfTime = 'day';
        break;
      case DateDistance.HOUR:
        unitOfTime = "hour";
        break;
      case DateDistance.MINUTE:
        unitOfTime = "minute";
        break;
      case DateDistance.SECOND:
        unitOfTime = "second";
        break;
      case DateDistance.MILLISECOND:
        unitOfTime = "millisecond";
        break;
      default:
        unitOfTime = 'day';
    }

    return unitOfTime;
  }

  private createDiratonLike(unit: DateTimeUnit, number: number): DurationLike {
    let unitOfTime: DurationLike = {days: 0};

    switch (unit) {
      case 'year':
        unitOfTime =  {years: number};
        break;
      case 'month':
        unitOfTime =  {months: number};
        break;
      case 'quarter':
        unitOfTime = {quarters: number};
        break;
      case 'week':
        unitOfTime =  {weeks: number};
        break;
      case 'day':
        unitOfTime =  {days: number};
        break;
      case 'hour':
        unitOfTime =  {hours: number};
        break;
      case 'minute':
        unitOfTime = {minutes: number};
        break;
      case 'second':
        unitOfTime = {seconds: number};
        break;
      case 'millisecond':
        unitOfTime =  {milliseconds: number};
        break;
      default:
        unitOfTime =  {days: number};
    }
    return unitOfTime;
  }
}
