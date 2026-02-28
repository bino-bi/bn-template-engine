/**
 * Reactive store for raw input data, keyed by datasource name.
 *
 * Written by `bn-datasource` components which receive JSON arrays from the host
 * application. Consumed by `bn-dataset` components that query these datasources
 * using AlaSQL to produce processed datasets.
 *
 * Each value is the raw JSON array as provided by the host application.
 *
 * @module stores/datasources
 */
import { createStore } from "@stencil/store";

const { state, on, get, set } = createStore({});

export { on, get, set };
export default state;
