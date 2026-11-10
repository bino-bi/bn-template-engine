import { DateTime } from "luxon";
import { AlaSQLDatabase } from "../../../../context/scopedDb";
import { DateDistance, DateStringFactory } from "../../../../utils/DateStringFactory";

/** `interval` value deactivating the feature. */
export const INTERVAL_NONE = "none";
/** `interval` value grouping by the dataset's `setname` column. */
export const INTERVAL_SETNAME = "setname";
/** Label rendered for the bucket collecting rows with a blank setname. */
export const BLANK_BUCKET_LABEL = "-";

/** A single interval column block: stable lookup key + display label. */
export interface IntervalBucket {
  key: string;
  label: string;
}

/** True for all date-based interval values (everything except none/setname). */
export function isDateInterval(interval: string): boolean {
  return interval !== INTERVAL_NONE && interval !== INTERVAL_SETNAME;
}

/**
 * SQL expression computing the bucket value of a source row.
 * Dates are normalized to the start of their bucket via the `normalizeDate`
 * alasql UDF (same mechanism as bn-chart-time); setname tolerates both the
 * documented lowercase `setname` and the `setName` casing used in fixtures.
 */
export function intervalBucketSQL(interval: string): string {
  if (interval === INTERVAL_SETNAME) {
    return "COALESCE([setname],[setName])";
  }
  return `normalizeDate([date], '${interval}')`;
}

/** SQL expression reading the optional `setnameIndex` column, tolerant like `setname`. */
export const SETNAME_INDEX_SQL = "COALESCE([setnameIndex],[setNameIndex])";

/** A raw `setnameIndex` value as a number; undefined when it is blank or not numeric. */
export function coerceSetnameIndex(value: unknown): number | undefined {
  if (typeof value === "string" ? value.trim() === "" : typeof value !== "number") {
    return undefined;
  }
  const index = Number(value);
  return Number.isFinite(index) ? index : undefined;
}

/** Coerces a raw bucket value (luxon DateTime, string, millis) to a stable string key. */
export function coerceBucketKey(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  const dt = toDateTime(value);
  if (dt) {
    return dt.toISO();
  }
  return String(value);
}

/**
 * Resolves `auto` to a concrete date granularity from the dataset's date span
 * (mirrors TimeChart.findDateInterval). Non-auto values pass through.
 * The min/max is computed in JS because alasql's MIN/MAX only aggregates numbers,
 * while `date` values are usually ISO strings.
 */
export function resolveIntervalGranularity(db: AlaSQLDatabase, fromExpr: string, interval: string): string {
  if (interval !== DateDistance.AUTO) {
    return interval;
  }

  const rows = db.exec<{ d?: unknown }[]>(`SELECT [date] as d FROM ${fromExpr}`);

  let min: number | undefined;
  let max: number | undefined;
  for (const row of rows) {
    const millis = toDateTime(row.d)?.toMillis();
    if (millis === undefined) {
      continue;
    }
    min = min === undefined ? millis : Math.min(min, millis);
    max = max === undefined ? millis : Math.max(max, millis);
  }

  if (min === undefined || max === undefined) {
    return DateDistance.DAY;
  }

  return new DateStringFactory().calculateDistanceType(DateTime.fromMillis(min), DateTime.fromMillis(max));
}

/**
 * Queries the distinct interval buckets of the source data.
 * Date buckets are sorted chronologically ascending and labeled locale-aware;
 * setname buckets keep their order of first appearance in the data, blank
 * setnames are collected in a trailing-position "-" bucket where they occur.
 * When rows carry a numeric `setnameIndex`, the setname buckets are sorted
 * ascending by the smallest index of each setname. Buckets without an index
 * follow, and ties keep the order of first appearance.
 */
export function queryIntervalBuckets(
  db: AlaSQLDatabase,
  fromExpr: string,
  interval: string,
  locale: string,
): IntervalBucket[] {
  if (interval === INTERVAL_SETNAME) {
    const setRows = db.exec<{ __interval?: unknown; __index?: unknown }[]>(
      `SELECT ${intervalBucketSQL(interval)} as __interval, ${SETNAME_INDEX_SQL} as __index FROM ${fromExpr}`,
    );
    const seen = new Set<string>();
    const indexes = new Map<string, number>();
    const buckets: IntervalBucket[] = [];
    for (const row of setRows) {
      const key = coerceBucketKey(row.__interval);
      if (!seen.has(key)) {
        seen.add(key);
        buckets.push({ key, label: key.length === 0 ? BLANK_BUCKET_LABEL : key });
      }
      const index = coerceSetnameIndex(row.__index);
      const known = indexes.get(key);
      if (index !== undefined && (known === undefined || index < known)) {
        indexes.set(key, index);
      }
    }
    // without any index the order of first appearance stays as it is
    if (indexes.size > 0) {
      const rank = (bucket: IntervalBucket) => indexes.get(bucket.key) ?? Number.POSITIVE_INFINITY;
      buckets.sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1));
    }
    return buckets;
  }

  const rows = db.exec<{ __interval?: unknown }[]>(
    `SELECT ${intervalBucketSQL(interval)} as __interval FROM ${fromExpr}`,
  );

  const seen = new Set<string>();
  const dates: DateTime[] = [];
  for (const row of rows) {
    const dt = toDateTime(row.__interval);
    if (!dt) {
      continue;
    }
    const key = dt.toISO();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    dates.push(dt);
  }
  dates.sort((a, b) => a.toMillis() - b.toMillis());

  const dateStringFactory = new DateStringFactory();
  dateStringFactory.setLocale(locale);
  return dates.map((dt) => ({
    key: dt.toISO(),
    label: dateStringFactory.getDateString(dt, interval as DateDistance),
  }));
}

function toDateTime(value: unknown): DateTime | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value, { zone: "utc" });
    return dt.isValid ? dt : undefined;
  }
  if (typeof value === "number") {
    const dt = DateTime.fromMillis(value, { zone: "utc" });
    return dt.isValid ? dt : undefined;
  }
  if (typeof (value as { isValid?: boolean }).isValid === "boolean") {
    const dt = value as DateTime;
    return dt.isValid ? dt : undefined;
  }
  return undefined;
}
