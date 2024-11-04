
import {DateDistance, DateLink, DateStringFactory} from "./DateStringFactory";

import {DateTime, Info} from "luxon";

describe("Basis Test Data Structure", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
  it("Test DateString", () => {
        let expected = "01.05.2020";
        expect(dateStringFactory.getDateString(DateTime.fromISO("2020-05-01T02:00:00+02:00"))).toEqual(expected);
  });

  it("Test getDateLinkString", () => {
    let expected = "2020..2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.YEAR, 32)).toEqual(expected);
  });

  it("Test Quarter same Year", () => {
    let expected = "2Q..4Q 2020";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2020-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.QUARTER,32)).toEqual(expected);
  });

  it("Test Quarter different Year", () => {
    let expected = "2Q 2020..4Q 2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.QUARTER,32)).toEqual(expected);
  });

  it("Test AutoCalculation years", () => {
    let expected = "May 2020..Oct 2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Test AutoCalculation Month", () => {
    let expected = "KW18..KW23 2020";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2020-06-03T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Test AutoCalculation Month different year", () => {
    let expected = "May 2020..Jan 2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2021-01-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Test AutoCalculation days", () => {
    let expected = "01.05.2020..10.05.2020";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2020-05-10T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Test END Week", () => {
    let expected = "KW31.";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2023-06-01T02:00:00+02:00"),DateTime.fromISO("2023-07-31T02:00:00+02:00"), DateLink.END, DateDistance.WEEK,32)).toEqual(expected);
  });

  it("Test START Week", () => {
    let expected = ".KW22";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2023-06-01T02:00:00+02:00"),DateTime.fromISO("2023-07-31T02:00:00+02:00"), DateLink.START, DateDistance.WEEK,32)).toEqual(expected);
  });

  it("Test AutoCalculation Week End", () => {
    let expected = "KW31.";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2023-06-01T02:00:00+02:00"),DateTime.fromISO("2023-07-31T02:00:00+02:00"), DateLink.END, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Test AutoCalculation Week Start", () => {
    let expected = ".KW22";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2023-06-01T02:00:00+02:00"),DateTime.fromISO("2023-07-31T02:00:00+02:00"), DateLink.START, DateDistance.AUTO,32)).toEqual(expected);
  });



});

describe("No StartDate Selected", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
  it("Date1 Missing", () => {
    let expected = "";
    expect(dateStringFactory.getDateLinkString(null, DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  });


});


describe("No EndDate Selected", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
  it("Date2 Missing + Interval ", () => {
    let expected = "";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), null, DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  })

  it("Date2 Missing + Cum ", () => {
    let expected = "";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), null, DateLink.CUM, DateDistance.AUTO,32)).toEqual(expected);
  });

  it("Date2 Missing + AVG ", () => {
    let expected = "Ø01.10.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), null, DateLink.AVG, DateDistance.AUTO,32)).toEqual(expected);
  });

});

describe("clean up visualisation if start and end (formated) ist identical", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
  it("Both Dates, Interval ", () => {
    let expected = "01.10.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.INTERVAL, DateDistance.AUTO,32)).toEqual(expected);
  })


  it("Both Dates, CUM ", () => {
    let expected = "01.10.2021_01.10.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.CUM, DateDistance.AUTO,32)).toEqual(expected);
  })


  it("Both Dates, AVG -> diplays Date1 ", () => {
    let expected = "Ø01.10.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateLink.AVG, DateDistance.AUTO,32)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "ØOct 2021..Oct 2022";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2022-10-01T02:00:00+02:00"), DateLink.AVG, DateDistance.AUTO,32)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "Ø01.10.2021..01.11.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-11-01T02:00:00+02:00"), DateLink.AVG, DateDistance.AUTO,32)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "ØOct 2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-31T02:00:00+02:00"), DateLink.AVG, DateDistance.MONTH,32)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "ØOct..Nov 2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-11-01T02:00:00+02:00"), DateLink.AVG, DateDistance.MONTH,32)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "Ø01.10.2021";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-10-01T02:00:00+02:00"), null, DateLink.AVG, DateDistance.AUTO,1)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays Date1 .. Date2 ", () => {
    let expected = "ØMay 2021..May 2022";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2021-05-01T02:00:00+02:00"), DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateLink.AVG, DateDistance.AUTO,28)).toEqual(expected);
  })

  it("Two Dates, AVG -> diplays WK ", () => {
    let expected = "ØKW18 2023";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2023-05-01T02:00:00+02:00"), DateTime.fromISO("2023-05-07T02:00:00+02:00"), DateLink.AVG, DateDistance.WEEK,28)).toEqual(expected);
  })

});

describe("Test calculateDistanceType Calculation", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');

  it(" Less than 28 days apart -->  Distance DAY", () => {
    let expected = DateDistance.DAY;
    expect(dateStringFactory.calculateDistanceType(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-25T02:00:00+02:00"))).toEqual(expected);
  })

  it(" Less than 28 weeks apart -->  Distance WEEK", () => {
    let expected = DateDistance.WEEK;
    expect(dateStringFactory.calculateDistanceType(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-12-01T02:00:00+02:00"))).toEqual(expected);
  })

  it(" Less than 28 quarters apart -->  Distance QUARTER", () => {
    let expected = DateDistance.QUARTER;
    expect(dateStringFactory.calculateDistanceType(DateTime.fromISO("2010-10-01T02:00:00+02:00"), DateTime.fromISO("2016-10-01T02:00:00+02:00"))).toEqual(expected);
  })

  it(" More than 28 quarters apart -->  Distance YEARS", () => {
    let expected = DateDistance.YEAR;
    expect(dateStringFactory.calculateDistanceType(DateTime.fromISO("2010-10-01T02:00:00+02:00"), DateTime.fromISO("2021-10-01T02:00:00+02:00"))).toEqual(expected);
  })
});


describe("Test Setter", () => {

let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
  dateStringFactory.setDateFormat({
    year:     "yyyy",
    quarter:  "yyyy",
    month:    "yyyy",
    week:     "yyyy",
    day:      "yyyy",
    hour:     "yyy",
    minute:     "yyy",
    second:     "yyy",
    millisecond:     "yyy",
    fallback: "dd.MM.yyyy",
  })

  dateStringFactory.setDateLinkFormat({
    avg:      "[DATE]..[DATE2]",
    interval: "[DATE]..[DATE2]",
    start:    "[DATE]..[DATE2]",
    end:      "..[DATE]",
    ytd:      "[DATE]..[DATE2]",
    ytg:      "[DATE]..[DATE2]",
    cum:      "[DATE]..[DATE2]",
    mat:      "[DATE]..[DATE2]",
    none:     "[DATE]..[DATE2]",
  });

  it("Test getDateLinkString with overwriten date and link formats", () => {
    let expected = "..2020";
    expect(dateStringFactory.getDateLinkString(DateTime.fromISO("2020-05-01T02:00:00+02:00"),DateTime.fromISO("2020-10-01T02:00:00+02:00"), DateLink.END, DateDistance.QUARTER,32)).toEqual(expected);
  });
});

describe("Test Smart Date", () => {

  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('de');
  dateStringFactory.setDateFormat( {
    year:     "yyyy",
    quarter:  "q'Q' yyyy",
    month:    "LLL yyyy",
    week:     "'KW'WW yyyy",
    day:      "dd.MM.yyyy",
    hour:     "dd.MM.yyyy HH:mm:ss",
    minute:     "dd.MM.yyyy HH:mm:ss",
    second:     "dd.MM.yyyy HH:mm:ss",
    millisecond:     "dd.MM.yyyy HH:mm:ss",
    fallback: "dd.MM.yyyy",
  });

  dateStringFactory.setDateFormatShort(  {
    year:     "yy",
    quarter:  "'Q'q",
    month:    "LLL",
    week:     "'KW'WW",
    day:      "dd",
    hour:     "dd.MM.yyyy HH:mm:ss",
    minute:     "dd.MM.yyyy HH:mm:ss",
    second:     "dd.MM.yyyy HH:mm:ss",
    millisecond:     "dd.MM.yyyy HH:mm:ss",
    fallback: "TT",
  });

  it("Returns Short Day ", () => {
    let expected = "02";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.DAY)).toEqual(expected);
  });

  it("Returns Short Day and Month", () => {
    let expected = "01 Mai";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.DAY)).toEqual(expected);
  });

  it("Returns Short Day and Month and year", () => {
    let expected = "01 Jan 22";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.DAY)).toEqual(expected);
  });

  it("Returns Short Month ", () => {
    let expected = "Mai";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.MONTH)).toEqual(expected);
  });

  it("Returns Shor Month", () => {
    let expected = "Mai";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.MONTH)).toEqual(expected);
  });

  it("Returns Short Day and Month and year", () => {
    let expected = "Jan 22";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.MONTH)).toEqual(expected);
  });

  it("Returns Short Quarter ", () => {
    let expected = "Q2";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.QUARTER)).toEqual(expected);
  });

  it("Returns Short Quarter", () => {
    let expected = "Q2";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.QUARTER)).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    let expected = "Q1 22";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-02-01T02:00:00+02:00"), DateDistance.QUARTER)).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    let expected = "Q1 22";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-01T02:00:00+02:00"), DateDistance.QUARTER)).toEqual(expected);
  });

  it("Returns Short Quarter ", () => {
    let expected = "KW18";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.WEEK)).toEqual(expected);
  });

  it("Returns Short Quarter", () => {
    let expected = "KW17";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-01T02:00:00+02:00"), DateDistance.WEEK)).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    let expected = "KW17";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-04-25T02:00:00+02:00"), DateDistance.WEEK)).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    let expected = "KW52";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-02T02:00:00+02:00"), DateDistance.WEEK)).toEqual(expected);
  });

  it("Returns Short Quarter and year", () => {
    let expected = "KW01 22";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-01-03T02:00:00+02:00"), DateDistance.WEEK)).toEqual(expected);
  });

  it("Returns Fallback", () => {
    let expected = "02.05.2022";
    expect(dateStringFactory.getSmartDateString(DateTime.fromISO("2022-05-02T02:00:00+02:00"), DateDistance.NONE)).toEqual(expected);
  });
});

describe("Intl Localisation", () => {
  it("Returns German Monthnames (without .)", () => {
    let expected = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    expect(Info.months("short", { locale: "de" })).toEqual(expected);
  });

  it("Expecting  Monthname (without .)", () => {
    let expected = "Aug";
    expect(DateTime.fromISO('2014-08-06T13:07:04.054').toFormat('LLL')).toEqual(expected);
  });

  it("Expecting  Monthname (with.)", () => {
    let expected = "Aug";
    expect(DateTime.fromISO('2014-08-06T13:07:04.054').toFormat('MMM')).toEqual(expected);
  });
});


describe("datesBetween Range length", () => {
  let dateStringFactory: DateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale('en');
/*
  it("Range in Days", () => {
    let expected = 5;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T00:02:00+02:00"), DateTime.fromISO("2021-10-05T00:02:00+02:00"), DateDistance.DAY, 28).length).toEqual(expected);
  })
*/
  it("Range in Month", () => {
    let expected = 3;
    expect(dateStringFactory.datesBetween(DateTime.fromISO("2021-10-01T02:00:00+02:00"), DateTime.fromISO("2021-12-01T02:00:00+02:00"), DateDistance.MONTH, 28).length).toEqual(expected);
  })
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

