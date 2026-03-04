/**
 * Luxon format templates for date axis labels at each granularity level.
 *
 * Each property holds a Luxon-compatible format string (e.g. `"yyyy"`, `"MMM"`, `"dd"`).
 * The `fallback` template is used when no specific granularity matches.
 * Indexed by string to allow dynamic lookup by {@link DateDistance} keys.
 */
export interface DateFormat {
  year: string;
  quarter: string;
  month: string;
  week: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  millisecond: string;
  fallback: string;

  [index: string]: string;
}

/**
 * Luxon format templates for date link/aggregation labels.
 *
 * Used when dates represent aggregated periods (year-to-date, cumulative, etc.)
 * rather than individual points. Indexed by string for dynamic lookup.
 */
export interface DateLinkFormat {
  avg: string;
  interval: string;
  start: string;
  end: string;
  ytd: string;
  ytg: string;
  cum: string;
  mat: string;
  none: string;

  [index: string]: string;
}
