/** Distinct value statistics for a single dimension column (e.g. rowGroup, category). */
export interface DimensionMeta {
  distinctValues: string[];
  count: number;
  hasData: boolean;
}

/** Min/max value range for a single scenario column across all rows. */
export interface ScenarioMeta {
  key: string;
  hasData: boolean;
  min: number | null;
  max: number | null;
}

/** Date boundaries for the time chart axis, derived from the `date` column. */
export interface DateRangeMeta {
  min: string | null;
  max: string | null;
  hasData: boolean;
  distinctCount: number;
}

/**
 * Single-pass statistical summary of a dataset, calculated by `calculateDatasetMeta()`.
 * Used by consumer components to auto-configure when explicit props are not set
 * (e.g. falling back to suggestedLevel when no `level` prop is provided).
 */
export interface DatasetMeta {
  rowCount: number;
  scenarios: ScenarioMeta[];
  availableScenarios: string[];
  rowGroup: DimensionMeta;
  category: DimensionMeta;
  subCategory: DimensionMeta;
  columnGroup: DimensionMeta;
  columnSubGroup: DimensionMeta;
  dateRange: DateRangeMeta;
  /** Auto-detected aggregation level based on deepest populated dimension. */
  suggestedLevel: string;
  /** Auto-detected sort order based on the deepest populated dimension. */
  suggestedOrder: string;
  /** Auto-detected date interval (e.g. "month", "quarter") based on date column spacing, or null if no dates. */
  suggestedDateInterval: string | null;
  calculatedAt: number;
}
