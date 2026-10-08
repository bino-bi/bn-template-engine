import { Title } from "../Title";
import { TitleConfig, TitleConifgAdapter } from "../model/TitleConfig";
import { MeasureEntryAdapter } from "../model/MeasureEntriy";
import { TimePeriodAdapter } from "../model/TimePeriod";
import { DateTime } from "luxon";
import { OrderAdapter, OrderDirection } from "../../../../../utils/model/Order";
import { StringAdapter } from "../../../../../utils/helper/StringAdapter";
import { I18nMode } from "../../../../../utils/constants";
import { DateDistance, DateLink } from "../../../../../utils/DateStringFactory";
import { IBCSRuleSet } from "../../../../../utils/ibcsRuleSet";
// import { IBCSRuleSet } from "../../../../utils/ibcsRuleSet";

// Test i18n data
const i18n: Map<string, string> = new Map();

[
  { key: "SEPERATOR_WS", value: ", " },
  { key: "in", value: "in" },
  { key: "ORDER_asc", value: "↑" },
  { key: "ORDER_desc", value: "↓" },
  { key: "title1", value: "Beispiel Daten" },
  { key: "ac", value: "AC" },
  { key: "py", value: "PY" },
  { key: "fc", value: "FC" },
  { key: "pl", value: "PL" },
  { key: "category", value: " " },
  { key: "operation", value: " " },
  { key: "thereof", value: "davon" },
  { key: "ibcssymbol_delta_ac", value: "Δ{%}" },
  { key: "ibcssymbol_delta_generic", value: "Δ({%})" },
].forEach(function (entry) {
  i18n.set(entry.key, entry.value);
});

function craeteConfig(data: any): TitleConfig {
  return new TitleConifgAdapter(
    new MeasureEntryAdapter(),
    new TimePeriodAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
  ).adapt(data);
}

/**
 *   Test Case 01 Simple Table List
 */
describe("Test Title Good Cases", () => {
  const config: TitleConfig = craeteConfig({
    i18n: I18nMode.ALL,
    businessunit: "BinoBi Racing",
    measures: [
      { name: "Nettoumsatz", unit: "mEUR" },
      { name: "Bruttoumsatz", unit: "mEUR" },
    ],
    scenarios: ["pp1", "pl1", "ac1", "fc1", "dac1_fc1_pos", "dfc1_pl1_pos"],
    timeperiod: {
      start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
      end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
      format: DateDistance.MONTH,
      link: DateLink.INTERVAL,
    },
    order: {
      hierarchy: ["fc1"],
      direction: OrderDirection.ASC,
    },
  });

  // Init Factory; setup MetaData
  const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

  titleDataSetFactory.setConfig(config);

  let data = titleDataSetFactory.update();

  it("should create a correctly filled dimension string", () => {
    const expectedDimension = "Jan..Mai 2020 PY, PL, FC↑, AC, Δ(FC - PL), ΔFC";
    expect(data.dimension).toEqual(expectedDimension);
  });

  it("should create a correctly filled business unit string", () => {
    const expectedUnit = "BinoBi Racing";
    expect(data.unit).toEqual(expectedUnit);
  });

  it("should create a correctly filled business unit string after update", () => {
    const expectedUnit = "BinoBi Racing";
    data = titleDataSetFactory.update();
    expect(data.unit).toEqual(expectedUnit);
  });
});

describe("Test Title without config", () => {
  const config: TitleConfig = craeteConfig({});

  // Init Factory; setup MetaData
  const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

  titleDataSetFactory.setConfig(config);

  let data = titleDataSetFactory.update();

  it("should create a empty dimension string", () => {
    const expectedDimension = "";
    expect(data.dimension).toEqual(expectedDimension);
  });

  it("should create a empty business unit string", () => {
    const expectedUnit = "";
    expect(data.unit).toEqual(expectedUnit);
  });

  it("should create a empty business unit string after update", () => {
    const expectedUnit = "";
    data = titleDataSetFactory.update();
    expect(data.unit).toEqual(expectedUnit);
  });
});

describe("Test order object", () => {
  describe("Config with descending order object", () => {
    const config: TitleConfig = craeteConfig({
      i18n: I18nMode.ALL,
      businessunit: "BinoBi Racing",
      measures: [
        { name: "Nettoumsatz", unit: "mEUR" },
        { name: "Bruttoumsatz", unit: "mEUR" },
      ],
      scenarios: ["pp1", "pl1", "ac1", "fc1", "dac1_fc1_pos", "dpl1_fc1_pos"],
      timeperiod: {
        start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
        end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
        format: DateDistance.MONTH,
        link: DateLink.INTERVAL,
      },
      order: undefined,
    });

    // Init Factory; setup MetaData
    const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

    titleDataSetFactory.setConfig(config);

    const data = titleDataSetFactory.update();
    const expectedDimension = "Jan..Mai 2020 PY, PL, FC, AC, ΔFC, Δ(PL - FC)";

    it("should display no order", () => {
      config.order = undefined;
      expect(data.dimension).toEqual(expectedDimension);
    });
  });

  describe("Config with descending order object", () => {
    const config: TitleConfig = craeteConfig({
      i18n: I18nMode.ALL,
      businessunit: "BinoBi Racing",
      measures: [
        { name: "Nettoumsatz", unit: "mEUR" },
        { name: "Bruttoumsatz", unit: "mEUR" },
      ],
      scenarios: ["pp1", "pl1", "ac1", "fc1", "dac1_fc1_pos", "dpl1_fc1_pos"],
      timeperiod: {
        start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
        end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
        format: DateDistance.MONTH,
        link: DateLink.INTERVAL,
      },
      order: {
        hierarchy: ["fc1"],
        direction: OrderDirection.DESC,
      },
    });

    // Init Factory; setup MetaData
    const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

    titleDataSetFactory.setConfig(config);

    const data = titleDataSetFactory.update();
    const expectedDimension = "Jan..Mai 2020 PY, PL, FC↓, AC, ΔFC, Δ(PL - FC)";

    it("should display descending order", () => {
      expect(data.dimension).toEqual(expectedDimension);
    });
  });

  describe("Config with ascending order object", () => {
    const config: TitleConfig = craeteConfig({
      i18n: I18nMode.ALL,
      businessunit: "BinoBi Racing",
      measures: [
        { name: "Nettoumsatz", unit: "mEUR" },
        { name: "Bruttoumsatz", unit: "mEUR" },
      ],
      scenarios: ["pp1", "pl1", "ac1", "fc1", "dac1_fc1_pos", "dpl1_fc1_pos"],
      timeperiod: {
        start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
        end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
        format: DateDistance.MONTH,
        link: DateLink.INTERVAL,
      },
      order: {
        hierarchy: ["fc1"],
        direction: OrderDirection.ASC,
      },
    });

    // Init Factory; setup MetaData
    const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

    titleDataSetFactory.setConfig(config);

    const data = titleDataSetFactory.update();
    const expectedDimension = "Jan..Mai 2020 PY, PL, FC↑, AC, ΔFC, Δ(PL - FC)";

    it("should display ascending order", () => {
      expect(data.dimension).toEqual(expectedDimension);
    });
  });
});

describe("Scenarios Label Translation", () => {
  describe("custom scenario", () => {
    const config: TitleConfig = craeteConfig({
      i18n: I18nMode.ALL,
      businessunit: null,
      measures: [],
      scenarios: ["custom"],
      timeperiod: {
        start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
        end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
        format: DateDistance.MONTH,
        link: DateLink.INTERVAL,
      },
      order: undefined,
    });

    // Init Factory; setup MetaData
    const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

    titleDataSetFactory.setConfig(config);

    const data = titleDataSetFactory.update();
    const expectedDimension = "Jan..Mai 2020 custom";

    it("should display custom string which is not translated", () => {
      expect(data.dimension).toEqual(expectedDimension);
    });
  });

  describe("scenario is null", () => {
    const config: TitleConfig = craeteConfig({
      i18n: I18nMode.ALL,
      businessunit: null,
      measures: [],
      scenarios: [],
      timeperiod: {
        start: DateTime.fromISO("2020-01-12T02:00:00+02:00"),
        end: DateTime.fromISO("2020-05-12T02:00:00+02:00"),
        format: DateDistance.MONTH,
        link: DateLink.INTERVAL,
      },
      order: undefined,
    });

    // Init Factory; setup MetaData
    const titleDataSetFactory: Title = new Title(new IBCSRuleSet());

    titleDataSetFactory.setConfig(config);

    const data = titleDataSetFactory.update();
    const expectedDimension = "Jan..Mai 2020";

    it("should display custom string which is not translated", () => {
      expect(data.dimension).toEqual(expectedDimension);
    });
  });
});
