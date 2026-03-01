/**
 * Type documentation for the datasetsMeta store.
 *
 * Stores dataset metadata, keyed by dataset name. Each value is a
 * {@link DatasetMeta} object computed by `calculateDatasetMeta()` in a single
 * O(n) pass whenever `bn-dataset` updates its query results. Consumer
 * components (bn-table, bn-chart-time, bn-chart-structure) use this metadata
 * to auto-configure properties such as scenarios, aggregation level, sort
 * order, and date interval when the user has not set them explicitly.
 *
 * Store instances are created per `<bn-context>` via `createScopedStores()`.
 *
 * @module stores/datasetsMeta
 */
