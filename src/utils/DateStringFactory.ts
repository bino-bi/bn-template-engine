import { DateTime, DateTimeUnit, DurationLike } from "luxon";
import { DateFormat, DateLinkFormat } from "./model/DateFormat";

/** Granularity levels for date intervals, from YEAR down to MILLISECOND. AUTO triggers auto-detection. */
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

/** IBCS date-link modes controlling how start/end dates are rendered in titles and axis labels. */
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

/**
 * Produces formatted date strings and IBCS date-link notations for time-series charts.
 *
 * Supports configurable date formats (full and abbreviated), locale-aware formatting
 * via Luxon, smart boundary labels that append the parent period at crossings
 * (e.g. month name shown at the first day of a new month), and IBCS date-link
 * notation (AVG, YTD, YTG, CUM, MAT, INTERVAL, START, END).
 */
export class DateStringFactory {
  private readonly _dateFormat: DateFormat = {
    year: "yyyy",
    quarter: "q'Q' yyyy",
    month: "LLL yyyy",
    // kkkk is the ISO week year: week 1 of 2025 starts on Monday 2024-12-30
    week: "'KW'WW kkkk",
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

  /**
   * Per-locale overrides for the patterns whose literals are language-specific.
   *
   * The base maps above are German (`KW` = Kalenderwoche, `dd.MM.yyyy`); a
   * locale listed here replaces only the entries it names. Locales that are not
   * listed keep the base patterns, so adding a bundle never silently reformats
   * existing reports. Luxon's `LLL` (month) and `q` (quarter) tokens are already
   * locale-aware through `setLocale`, so they need no override.
   */
  private static readonly LOCALE_DATE_FORMAT: Record<string, Partial<DateFormat>> = {
    en: { week: "'W'WW kkkk", day: "MM/dd/yyyy", fallback: "MM/dd/yyyy" },
  };

  private static readonly LOCALE_DATE_FORMAT_SHORT: Record<string, Partial<DateFormat>> = {
    en: { week: "'W'WW", fallback: "MM/dd/yyyy" },
  };

  private dateFormat: DateFormat;
  private dateLinkFormat: DateLinkFormat;
  private dateFormatShort: DateFormat;
  private locale: string = "de";
  /** Set once a caller supplies an explicit map, so `setLocale` stops overwriting it. */
  private dateFormatPinned: boolean = false;
  private dateFormatShortPinned: boolean = false;

  constructor() {
    this.dateFormat = this._dateFormat;
    this.dateLinkFormat = this._dateLinkFormat;
    this.dateFormatShort = this._dateFormatShort;
  }

  public setDateLinkFormat(datelink: DateLinkFormat) {
    this.dateLinkFormat = datelink;
  }

  public setDateFormat(dateFormat: DateFormat) {
    this.dateFormat = dateFormat;
    this.dateFormatPinned = true;
  }

  public setDateFormatShort(dateFormatShort: DateFormat) {
    this.dateFormatShort = dateFormatShort;
    this.dateFormatShortPinned = true;
  }

  /** Replaces single short patterns and keeps the rest. Call it after `setLocale`. */
  public patchDateFormatShort(patterns: Partial<DateFormat>) {
    this.dateFormatShort = { ...this.dateFormatShort, ...patterns } as DateFormat;
  }

  /**
   * Selects the locale used for Luxon's localized tokens and swaps in the
   * locale's pattern overrides. An explicit `setDateFormat` /
   * `setDateFormatShort` always wins, whatever the call order.
   */
  public setLocale(locale: string) {
    this.locale = locale;

    if (!this.dateFormatPinned) {
      this.dateFormat = { ...this._dateFormat, ...(DateStringFactory.LOCALE_DATE_FORMAT[locale] || {}) };
    }

    if (!this.dateFormatShortPinned) {
      this.dateFormatShort = {
        ...this._dateFormatShort,
        ...(DateStringFactory.LOCALE_DATE_FORMAT_SHORT[locale] || {}),
      };
    }
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
   * Produces abbreviated date labels that include the parent period at boundary crossings.
   *
   * For example, with MONTH granularity, most ticks show just "Jan", "Feb", etc.,
   * but the first month of a new year also appends the year ("Jan 24").
   * This avoids redundant repetition while keeping boundary context visible.
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
   * Determines the best-fitting {@link DateDistance} granularity for the span between two dates.
   *
   * Cascades through granularities from finest (millisecond) to coarsest (year),
   * comparing the span against the `limit` threshold at each level. Returns the
   * first granularity where the span is below the limit, ensuring the number of
   * axis ticks stays manageable. Defaults to DAY for zero-span or null end dates.
   *
   * @param limit Maximum number of intervals before stepping up to a coarser granularity (default 32).
   */
  public calculateDistanceType(
    start: DateTime | number,
    end: DateTime | number | null,
    limit: number = 32,
  ): DateDistance {
    if (end == null) {
      return DateDistance.DAY;
    }

    const mStart: DateTime = typeof start == "number" ? DateTime.fromMillis(start) : start;
    const mEnd: DateTime = typeof end == "number" ? DateTime.fromMillis(end) : end;

    if (mEnd.diff(mStart).as("milliseconds") === 0) {
      return DateDistance.DAY;
    } else if (mEnd.diff(mStart).as("milliseconds") < limit) {
      return DateDistance.MILLISECOND;
    } else if (mEnd.diff(mStart).as("seconds") < limit) {
      return DateDistance.SECOND;
    } else if (mEnd.diff(mStart).as("minutes") < limit) {
      return DateDistance.MINUTE;
    } else if (mEnd.diff(mStart).as("hours") < limit) {
      return DateDistance.HOUR;
    } else if (mEnd.diff(mStart).as("days") < limit) {
      return DateDistance.DAY;
    } else if (mEnd.diff(mStart).as("weeks") < limit) {
      return DateDistance.WEEK;
    } else if (mEnd.diff(mStart).as("months") < limit) {
      return DateDistance.MONTH;
    } else if (mEnd.diff(mStart).as("quarters") < limit) {
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
   */
  public datesBetween(from: DateTime, to: DateTime, dateInterval: DateDistance): DateTime[] {
    const unit: DateTimeUnit = this.convertDateDistanceToMomentunitOfTime(dateInterval);

    const fromDate = from.startOf(unit);
    const toDate = to.endOf(unit);

    const days = [];

    let currentDate = fromDate;

    do {
      days.push(currentDate);
      currentDate = currentDate.plus(this.createDiratonLike(unit, 1));
    } while (currentDate <= toDate);

    return days;
  }

  /** Number of `dateInterval` periods from `from` to `to`, both included. */
  public countBetween(from: DateTime, to: DateTime, dateInterval: DateDistance): number {
    const unit: DateTimeUnit = this.convertDateDistanceToMomentunitOfTime(dateInterval);

    return Math.floor(to.startOf(unit).diff(from.startOf(unit), unit).as(unit)) + 1;
  }

  /**
   * Produces an IBCS date-link string combining date formatting with link notation.
   *
   * Supported modes map to IBCS conventions:
   * - `AVG`: average symbol `Ø` wrapping the interval
   * - `YTD` / `YTG`: year-to-date / year-to-go underline notation
   * - `CUM`: cumulative range `start_end`
   * - `MAT`: moving annual total `~date`
   * - `INTERVAL`: `start..end` range
   * - `START` / `END`: dot-prefixed/suffixed single date
   *
   * When start and end resolve to the same formatted string, INTERVAL is collapsed
   * to NONE to avoid redundant display. Year parts are deduplicated when both dates
   * share the same year (e.g. "Q1 .. Q3 2024" instead of "Q1 2024 .. Q3 2024").
   *
   * @param type DateDistance granularity; when AUTO, it is auto-detected via `calculateDistanceType`.
   */
  public getDateLinkString(
    startDateTime: DateTime | null,
    endDateTime: DateTime | null,
    mode: DateLink,
    type: DateDistance,
    spanLimit: number,
  ): string {
    // No Start/ End Date exists
    if (startDateTime == null && endDateTime == null) {
      // BinoSystem.warn('NO START AND END DATE SELECTED');
      return "";
    }

    if (startDateTime == null && !(mode === DateLink.END || mode === DateLink.YTD)) {
      // BinoSystem.warn('NO START N SELECTED');
      return "";
    }

    if (
      endDateTime == null &&
      (DateLink.INTERVAL === mode || DateLink.CUM === mode || DateLink.END === mode || DateLink.YTD === mode)
    ) {
      // BinoSystem.warn('NO END N SELECTED');
      return "";
    }

    const date1: DateTime = startDateTime || DateTime.now();
    const date2: DateTime | null = endDateTime;

    // calculate type value aka. auto-mode
    if (type === DateDistance.AUTO) {
      type = this.calculateDistanceType(date1, date2, spanLimit);
    }

    let dateString1 = this.getDateString(date1, type);
    let dateString2 = "";
    let link = DateLink.NONE;

    if (date2 != null) {
      dateString2 = this.getDateString(date2, type);
      link = DateLink.INTERVAL;
      // clean up visualisation if start and end (formated) ist identical
      if (dateString1 === dateString2 && mode === DateLink.INTERVAL) {
        // BinoSystem.warn('CHANGED INTERVAL TO NONE; START AND END ARE IDENTICAL');
        mode = DateLink.NONE;
      }
      if (dateString1 === dateString2 && mode === DateLink.AVG) {
        // BinoSystem.warn('CHANGED INTERVAL TO NONE; START AND END ARE IDENTICAL');
        link = DateLink.NONE;
      }

      if (DateLink.END === mode || DateLink.YTD === mode) {
        dateString1 = dateString2;
      }

      // clean up dateString1 if same year
      if (mode === DateLink.INTERVAL || mode === DateLink.CUM || mode === DateLink.AVG) {
        if (type === DateDistance.QUARTER) {
          if (date1.quarter === date2.quarter && date1.year === date2.year) {
            dateString2 = dateString2.replace(" " + date2.year, "");
          } else if (date1.year === date2.year) {
            dateString1 = dateString1.replace(" " + date1.year, "");
          }
        } else if (type === DateDistance.MONTH) {
          if (date1.month === date2.month && date1.year === date2.year) {
            dateString2 = dateString2.replace(" " + date2.year, "");
          } else if (date1.year === date2.year) {
            dateString1 = dateString1.replace(" " + date1.year, "");
          }
        } else if (type === DateDistance.WEEK) {
          if (date1.weekNumber === date2.weekNumber && date1.weekYear === date2.weekYear) {
            dateString2 = dateString2.replace(" " + date2.weekYear, "");
          } else if (date1.weekYear === date2.weekYear) {
            dateString1 = dateString1.replace(" " + date1.weekYear, "");
          }
        }
      }
    }

    return this.dateLinkFormat[mode as string]
      .replace("[LINK]", this.dateLinkFormat[link])
      .replace("[DATE]", dateString1)
      .replace("[DATE2]", dateString2);
  }

  /** Returns an abbreviated date string using the short format map (e.g. "yy" for year, "LLL" for month). */
  getShortDateString(date: DateTime, type: DateDistance) {
    return date
      .setLocale(this.locale)
      .toFormat(this.dateFormatShort[type as string] || this.dateFormatShort["fallback"]);
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
      // the short ISO week year, see the week format
      format += " kk";
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

  /** True when the smart label of this period also names the month or the year that starts with it. */
  public isSmartBoundary(date: DateTime, type: DateDistance): boolean {
    switch (type) {
      case DateDistance.DAY:
        return this.isFirstInMonth(date);
      case DateDistance.WEEK:
        return this.isFirstWeek(date);
      case DateDistance.MONTH:
        return this.isJanuary(date);
      case DateDistance.QUARTER:
        return this.isFirstQuarter(date);
      default:
        return false;
    }
  }

  private isFirstInMonth(date: DateTime) {
    return date.day === 1;
  }

  private isJanuary(date: DateTime) {
    return date.month === 1;
  }

  private isFirstQuarter(date: DateTime) {
    return date.quarter === 1;
  }

  private isFirstWeek(date: DateTime) {
    return date.weekNumber === 1;
  }

  private isFirstHour(date: DateTime) {
    return date.hour === 0;
  }

  private isFirstMinute(date: DateTime) {
    return date.minute === 0;
  }

  private isFirstSecond(date: DateTime) {
    return date.second === 0;
  }

  private isFirstMilliSecond(date: DateTime) {
    return date.millisecond === 0;
  }

  private convertDateDistanceToMomentunitOfTime(dateInterval: DateDistance): DateTimeUnit {
    let unitOfTime: DateTimeUnit;

    switch (dateInterval) {
      case DateDistance.YEAR:
        unitOfTime = "year";
        break;
      case DateDistance.MONTH:
        unitOfTime = "month";
        break;
      case DateDistance.QUARTER:
        unitOfTime = "quarter";
        break;
      case DateDistance.WEEK:
        unitOfTime = "week";
        break;
      case DateDistance.DAY:
        unitOfTime = "day";
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
        unitOfTime = "day";
    }

    return unitOfTime;
  }

  private createDiratonLike(unit: DateTimeUnit, number: number): DurationLike {
    switch (unit) {
      case "year":
        return { years: number };
      case "month":
        return { months: number };
      case "quarter":
        return { quarters: number };
      case "week":
        return { weeks: number };
      case "day":
        return { days: number };
      case "hour":
        return { hours: number };
      case "minute":
        return { minutes: number };
      case "second":
        return { seconds: number };
      case "millisecond":
        return { milliseconds: number };
      default:
        return { days: number };
    }
  }
}
