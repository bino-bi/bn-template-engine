/**
 * Reactive store for dataset metadata, keyed by dataset name.
 *
 * Each value is a {@link DatasetMeta} object computed by `calculateDatasetMeta()`
 * in a single O(n) pass whenever `bn-dataset` updates its query results. Consumer
 * components (bn-table, bn-chart-time, bn-chart-structure) use this metadata to
 * auto-configure properties such as scenarios, aggregation level, sort order,
 * and date interval when the user has not set them explicitly.
 *
 * Delivered to components via the optional third parameter of `withDataset`.
 *
 * @module stores/datasetsMeta
 */
import { createStore } from "@stencil/store";

const { state, on, get, set } = createStore({});

export { on, get, set };
export default state;
