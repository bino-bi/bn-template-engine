/**
 * Adapter pattern interface for converting untyped JSON records into validated domain objects.
 *
 * Each domain model class (e.g. TableDataRow, TimeChartComponentConfig) has a corresponding
 * adapter implementation that validates individual fields via {@link CompareUtil} type guards
 * before assignment. Invalid or missing fields are silently ignored, preserving the defaults
 * from the domain class constructor.
 *
 * @typeParam T - The target domain type produced by this adapter.
 */
export interface IAdapter<T> {
  /** Converts an untyped JSON record into a validated instance of `T`. */
  adapt(data: Record<string, unknown>): T;
  /** Returns a default-initialized instance of `T` with all fields at their initial values. */
  default(): T;
}
