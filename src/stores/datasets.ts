/**
 * Type documentation for the datasets store.
 *
 * Stores processed query results, keyed by dataset name.
 * Written by `bn-dataset` after executing AlaSQL queries against datasources.
 * Read by visualization components (bn-table, bn-chart-time, bn-chart-structure)
 * via the `withDataset` mixin, which subscribes to changes on a specific key.
 *
 * Each value is an array of row objects representing the query output.
 *
 * Store instances are created per `<bn-context>` via `createScopedStores()`.
 *
 * @module stores/datasets
 */
