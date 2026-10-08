import { DateTime } from "luxon";
import { TimeChart } from "./TimeChart";
import { TimeChartComponentConfigAdapter } from "./model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "./model/TimeChartDataRow";
import { TimeChartStylesAdapter } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./model/styles/ScaleFactorsTimeChart";
import { createScopedDb, buildFromExpr } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";

const TABLE = "trend";

const buildChart = (rows: Record<string, unknown>[]): TimeChart => {
  const scoped = createScopedDb();
  const db = scoped.db;
  db.tables[TABLE] = { data: rows };

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pp1"],
    variances: ["dac1_pp1_pos"],
    dateInterval: "month",
  });

  const styles = new TimeChartStylesAdapter(
    new ScaleFactorsTimeChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new TimeChart(new IBCSRuleSet(), db, TABLE, config, styles);
};

interface ModelEntry {
  date: DateTime;
  [slot: string]: unknown;
}

const dataModel = (chart: TimeChart): ModelEntry[] => (chart as unknown as { dataModel: ModelEntry[] }).dataModel;

/** Value of a scenario in a model entry, whatever slot the rule set sorted it into. */
const scenarioValue = (entry: ModelEntry, scenario: string): number | null | undefined =>
  ["scenario1", "scenario2", "scenario3", "scenario4"]
    .map((slot) => entry[slot] as { scenario: string; value: number | null })
    .find((point) => point.scenario === scenario)?.value;

// Run under another zone with `npm run test:tz` (jest copies process.env, so TZ cannot be set here).
describe("time chart dates are read in UTC", () => {
  it("fills the month range in UTC", () => {
    const chart = buildChart([
      { date: "2024-01-01T00:00:00Z", category: "Total", categoryIndex: 1, operation: "+", ac1: 100, pp1: 90 },
      { date: "2024-03-01T00:00:00Z", category: "Total", categoryIndex: 1, operation: "+", ac1: 110, pp1: 95 },
    ]);
    const model = dataModel(chart);

    expect(model.map((entry) => entry.date.toISO())).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-02-01T00:00:00.000Z",
      "2024-03-01T00:00:00.000Z",
    ]);
    expect(scenarioValue(model[0], "ac1")).toBe(100);
    expect(scenarioValue(model[2], "ac1")).toBe(110);
  });

  it("coerceDateTime reads strings and millis in UTC", () => {
    const coerce = (TimeChart as unknown as { coerceDateTime: (v: unknown) => DateTime }).coerceDateTime;

    expect(coerce("2024-05-20").toISO()).toBe("2024-05-20T00:00:00.000Z");
    expect(coerce("2024-01-01T00:00:00Z").toISO()).toBe("2024-01-01T00:00:00.000Z");
    // 23:30 at +01:00 is 22:30 UTC, still January 31
    expect(coerce("2024-01-31T23:30:00+01:00").toISO()).toBe("2024-01-31T22:30:00.000Z");
    expect(coerce(Date.UTC(2024, 0, 1)).toISO()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("the row adapter reads the date in UTC", () => {
    const row = new TimeChartDataRowAdapter().adapt({ date: "2024-01-01T00:00:00Z" });

    expect(row.date.toISO()).toBe("2024-01-01T00:00:00.000Z");
  });
});
