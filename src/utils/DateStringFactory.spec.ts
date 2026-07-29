import { DateDistance, DateLink, DateStringFactory } from "./DateStringFactory";

import { DateTime, Info } from "luxon";

describe("Basis Test Data Structure", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  it("Test DateString", () => {
    const expected = "05/01/2020";
    expect(dateStringFactory.getDateString(DateTime.fromISO("2020-05-01T02:00:00+02:00"))).toEqual(expected);
  });

  it("Test getDateLinkString", () => {
    const expected = "2020..2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.YEAR,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test Quarter same Year", () => {
    const expected = "2Q..4Q 2020";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2020-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.QUARTER,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test Quarter different Year", () => {
    const expected = "2Q 2020..4Q 2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.QUARTER,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation years", () => {
    const expected = "May 2020..Oct 2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation Month", () => {
    const expected = "W18..W23 2020";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2020-06-03T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation Month different year", () => {
    const expected = "May 2020..Jan 2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2021-01-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation days", () => {
    const expected = "05/01/2020..05/10/2020";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2020-05-10T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test END Week", () => {
    const expected = "W31.";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2023-06-01T02:00:00+02:00"),
        DateTime.fromISO("2023-07-31T02:00:00+02:00"),
        DateLink.END,
        DateDistance.WEEK,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test START Week", () => {
    const expected = ".W22";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2023-06-01T02:00:00+02:00"),
        DateTime.fromISO("2023-07-31T02:00:00+02:00"),
        DateLink.START,
        DateDistance.WEEK,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation Week End", () => {
    const expected = "W31.";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2023-06-01T02:00:00+02:00"),
        DateTime.fromISO("2023-07-31T02:00:00+02:00"),
        DateLink.END,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Test AutoCalculation Week Start", () => {
    const expected = ".W22";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2023-06-01T02:00:00+02:00"),
        DateTime.fromISO("2023-07-31T02:00:00+02:00"),
        DateLink.START,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });
});

describe("No StartDate Selected", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  it("Date1 Missing", () => {
    const expected = "";
    expect(
      dateStringFactory.getDateLinkString(
        null,
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });
});

describe("No EndDate Selected", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  it("Date2 Missing + Interval ", () => {
    const expected = "";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        null,
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Date2 Missing + Cum ", () => {
    const expected = "";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        null,
        DateLink.CUM,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Date2 Missing + AVG ", () => {
    const expected = "Ø10/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        null,
        DateLink.AVG,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });
});

describe("clean up visualisation if start and end (formated) ist identical", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  it("Both Dates, Interval ", () => {
    const expected = "10/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.INTERVAL,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Both Dates, CUM ", () => {
    const expected = "10/01/2021_10/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.CUM,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Both Dates, AVG -> diplays Date1 ", () => {
    const expected = "Ø10/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "ØOct 2021..Oct 2022";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2022-10-01T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "Ø10/01/2021..11/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-11-01T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.AUTO,
        32,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "ØOct 2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-31T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.MONTH,
        32,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "ØOct..Nov 2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-11-01T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.MONTH,
        32,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "Ø10/01/2021";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        null,
        DateLink.AVG,
        DateDistance.AUTO,
        1,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    const expected = "ØMay 2021..May 2022";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2021-05-01T02:00:00+02:00"),
        DateTime.fromISO("2022-05-01T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.AUTO,
        28,
      ),
    ).toEqual(expected);
  });

  it("Two Dates, AVG -> diplays WK ", () => {
    const expected = "ØW18 2023";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2023-05-01T02:00:00+02:00"),
        DateTime.fromISO("2023-05-07T02:00:00+02:00"),
        DateLink.AVG,
        DateDistance.WEEK,
        28,
      ),
    ).toEqual(expected);
  });
});

describe("Test calculateDistanceType Calculation", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");

  it(" Less than 28 days apart -->  Distance DAY", () => {
    const expected = DateDistance.DAY;
    expect(
      dateStringFactory.calculateDistanceType(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-25T02:00:00+02:00"),
      ),
    ).toEqual(expected);
  });

  it(" Less than 28 weeks apart -->  Distance WEEK", () => {
    const expected = DateDistance.WEEK;
    expect(
      dateStringFactory.calculateDistanceType(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-12-01T02:00:00+02:00"),
      ),
    ).toEqual(expected);
  });

  it(" Less than 28 quarters apart -->  Distance QUARTER", () => {
    const expected = DateDistance.QUARTER;
    expect(
      dateStringFactory.calculateDistanceType(
        DateTime.fromISO("2010-10-01T02:00:00+02:00"),
        DateTime.fromISO("2016-10-01T02:00:00+02:00"),
      ),
    ).toEqual(expected);
  });

  it(" More than 28 quarters apart -->  Distance YEARS", () => {
    const expected = DateDistance.YEAR;
    expect(
      dateStringFactory.calculateDistanceType(
        DateTime.fromISO("2010-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
      ),
    ).toEqual(expected);
  });
});

describe("Test Setter", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  dateStringFactory.setDateFormat({
    year: "yyyy",
    quarter: "yyyy",
    month: "yyyy",
    week: "yyyy",
    day: "yyyy",
    hour: "yyy",
    minute: "yyy",
    second: "yyy",
    millisecond: "yyy",
    fallback: "dd.MM.yyyy",
  });

  dateStringFactory.setDateLinkFormat({
    avg: "[DATE]..[DATE2]",
    interval: "[DATE]..[DATE2]",
    start: "[DATE]..[DATE2]",
    end: "..[DATE]",
    ytd: "[DATE]..[DATE2]",
    ytg: "[DATE]..[DATE2]",
    cum: "[DATE]..[DATE2]",
    mat: "[DATE]..[DATE2]",
    none: "[DATE]..[DATE2]",
  });

  it("Test getDateLinkString with overwriten date and link formats", () => {
    const expected = "..2020";
    expect(
      dateStringFactory.getDateLinkString(
        DateTime.fromISO("2020-05-01T02:00:00+02:00"),
        DateTime.fromISO("2020-10-01T02:00:00+02:00"),
        DateLink.END,
        DateDistance.QUARTER,
        32,
      ),
    ).toEqual(expected);
  });
});

describe("Test Smart Date", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("de");
  dateStringFactory.setDateFormat({
    year: "yyyy",
    quarter: "q'Q' yyyy",
    month: "LLL yyyy",
    week: "'KW'WW yyyy",
    day: "dd.MM.yyyy",
    hour: "dd.MM.yyyy HH:mm:ss",
    minute: "dd.MM.yyyy HH:mm:ss",
    second: "dd.MM.yyyy HH:mm:ss",
    millisecond: "dd.MM.yyyy HH:mm:ss",
    fallback: "dd.MM.yyyy",
  });

  dateStringFactory.setDateFormatShort({
    year: "yy",
    quarter: "'Q'q",
    month: "LLL",
    week: "'KW'WW",
    day: "dd",
    hour: "dd.MM.yyyy HH:mm:ss",
    minute: "dd.MM.yyyy HH:mm:ss",
    second: "dd.MM.yyyy HH:mm:ss",
    millisecond: "dd.MM.yyyy HH:mm:ss",
    fallback: "TT",
  });

  it("Returns Short Day ", () => {
    const expected = "02";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.DAY),
    ).toEqual(expected);
  });

  it("Returns Short Day and Month", () => {
    const expected = "01 Mai";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.DAY),
    ).toEqual(expected);
  });

  it("Returns Short Day and Month and year", () => {
    const expected = "01 Jan 22";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.DAY),
    ).toEqual(expected);
  });

  it("Returns Short Month ", () => {
    const expected = "Mai";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.MONTH),
    ).toEqual(expected);
  });

  it("Returns Shor Month", () => {
    const expected = "Mai";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.MONTH),
    ).toEqual(expected);
  });

  it("Returns Short Day and Month and year", () => {
    const expected = "Jan 22";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.MONTH),
    ).toEqual(expected);
  });

  it("Returns Short Quarter ", () => {
    const expected = "Q2";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.QUARTER),
    ).toEqual(expected);
  });

  it("Returns Short Quarter", () => {
    const expected = "Q2";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.QUARTER),
    ).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    const expected = "Q1 22";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-02-01T02:00:00+02:00"), DateDistance.QUARTER),
    ).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    const expected = "Q1 22";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.QUARTER),
    ).toEqual(expected);
  });

  it("Returns Short Quarter ", () => {
    const expected = "KW18";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.WEEK),
    ).toEqual(expected);
  });

  it("Returns Short Quarter", () => {
    const expected = "KW17";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.WEEK),
    ).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    const expected = "KW17";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-04-25T02:00:00+02:00"), DateDistance.WEEK),
    ).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    const expected = "KW52";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-02T02:00:00+02:00"), DateDistance.WEEK),
    ).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    const expected = "KW01 22";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-03T02:00:00+02:00"), DateDistance.WEEK),
    ).toEqual(expected);
  });

  it("Returns Fallback", () => {
    const expected = "02.05.2022";
    expect(
      dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.NONE),
    ).toEqual(expected);
  });
});

describe("Intl Localisation", () => {
  it("Returns German Monthnames (without .)", () => {
    const expected = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    expect(Info.months("short", { locale: "de" })).toEqual(expected);
  });

  it("Expecting  Monthname (without .)", () => {
    const expected = "Aug";
    expect(DateTime.fromISO("2014-08-06T13:07:04.054").toFormat("LLL")).toEqual(expected);
  });

  it("Expecting  Monthname (with.)", () => {
    const expected = "Aug";
    expect(DateTime.fromISO("2014-08-06T13:07:04.054").toFormat("MMM")).toEqual(expected);
  });
});

describe("datesBetween Range length", () => {
  const dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale("en");
  /*
  it("Range in Days", () => {
    let expected = 5;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2021-10-05T00:02:00+02:00"), DateDistance.DAY, 28).length).toEqual(expected);
  })
*/
  it("Range in Month", () => {
    const expected = 3;
    expect(
      dateStringFactory.datesBetween(
        DateTime.fromISO("2021-10-01T02:00:00+02:00"),
        DateTime.fromISO("2021-12-01T02:00:00+02:00"),
        DateDistance.MONTH,
        28,
      ).length,
    ).toEqual(expected);
  });
  /*
  it("Range in Quarter", () => {
    let expected = 3;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2021-12-01T00:02:00+02:00"), DateDistance.QUARTER, 28).length).toEqual(expected);
  })



  it("Range in YEAR (2) less a year", () => {
    let expected = 2;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2022-09-01T00:02:00+02:00"), DateDistance.YEAR, 28).length).toEqual(expected);
  })

  it("Range in YEAR (2) more a year", () => {
    let expected = 2;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2022-11-01T00:02:00+02:00"), DateDistance.YEAR, 28).length).toEqual(expected);
  })

  it("Range in YEAR (5)", () => {
    let expected = 3;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2023-03-01T00:02:00+02:00"), DateDistance.YEAR, 28).length).toEqual(expected);
  })

  it("Range in Quarter (5)", () => {
    let expected = 13;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2022-10-01T00:02:00+02:00"), DateDistance.QUARTER, 28).length).toEqual(expected);
  })

 */
});

describe("Locale-dependent patterns", () => {
  const may1 = DateTime.fromISO("2020-05-01T02:00:00+02:00");
  const week = DateTime.fromISO("2023-05-01T02:00:00+02:00");

  it("keeps the German patterns for de", () => {
    const factory = new DateStringFactory();
    factory.setLocale("de");

    expect(factory.getDateString(may1, DateDistance.DAY)).toEqual("01.05.2020");
    expect(factory.getDateString(week, DateDistance.WEEK)).toEqual("KW18 2023");
    expect(factory.getDateString(may1, DateDistance.MONTH)).toEqual("Mai 2020");
  });

  it("uses English patterns for en", () => {
    const factory = new DateStringFactory();
    factory.setLocale("en");

    expect(factory.getDateString(may1, DateDistance.DAY)).toEqual("05/01/2020");
    expect(factory.getDateString(week, DateDistance.WEEK)).toEqual("W18 2023");
    expect(factory.getDateString(may1, DateDistance.MONTH)).toEqual("May 2020");
  });

  it("falls back to the German patterns for an unknown locale", () => {
    const factory = new DateStringFactory();
    factory.setLocale("fr");

    expect(factory.getDateString(may1, DateDistance.DAY)).toEqual("01.05.2020");
    expect(factory.getDateString(week, DateDistance.WEEK)).toEqual("KW18 2023");
  });

  it("lets an explicit format win over the locale defaults, whatever the call order", () => {
    const custom = {
      year: "yyyy",
      quarter: "yyyy",
      month: "yyyy",
      week: "'CW'WW",
      day: "yyyy-MM-dd",
      hour: "TT",
      minute: "TT",
      second: "TT",
      millisecond: "TT",
      fallback: "yyyy-MM-dd",
    };

    const before = new DateStringFactory();
    before.setDateFormat(custom);
    before.setLocale("en");

    const after = new DateStringFactory();
    after.setLocale("en");
    after.setDateFormat(custom);

    expect(before.getDateString(may1, DateDistance.DAY)).toEqual("2020-05-01");
    expect(after.getDateString(may1, DateDistance.DAY)).toEqual("2020-05-01");
    expect(before.getDateString(week, DateDistance.WEEK)).toEqual("CW18");
  });
});
