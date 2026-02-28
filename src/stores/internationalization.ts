/**
 * Reactive store for internationalized labels and symbols.
 *
 * Organized by namespace (`_system` ships built-in `de`/`en` bundles). Each
 * bundle is a flat key-value map produced by `flattenObject()` from a nested
 * `{ namespace: { key: label } }` structure, yielding keys like `"bn-table.SUM_TOTAL"`.
 *
 * **Token pattern**: Variance symbols use `{%}` as a placeholder for the
 * scenario abbreviation. For example, `"Δ{%}"` becomes `"ΔPY"` when the
 * comparison scenario is "PY". The `{%}` replacement is performed at render
 * time by the `withTranslation` mixin.
 *
 * @module stores/internationalization
 */
import { createStore } from "@stencil/store";
import flattenObject from "../utils/flattenObject";

/**
 * Keys that are treated as global (not namespace-scoped) across all components.
 * Includes scenario abbreviations (ac1..pl4), sort-order arrows, and IBCS
 * variance symbols with the `{%}` token for scenario substitution.
 */
const globalLabelKeys = [
  "ORDER_asc",
  "ORDER_desc",
  "ac1",
  "pp1",
  "fc1",
  "pl1",
  "ac2",
  "pp2",
  "fc2",
  "pl2",
  "ac3",
  "pp3",
  "fc3",
  "pl3",
  "ac4",
  "pp4",
  "fc4",
  "pl4",
  "ibcssymbol_delta_ac",
  "ibcssymbol_delta_generic",
  "ibcssymbol_delta_ac_relative",
  "ibcssymbol_delta_generic_relative",
];

const de = flattenObject({
  global: {
    ac1: "AC",
    pp1: "PY",
    fc1: "FC",
    pl1: "PL",
    ac2: "AC2",
    pp2: "PY2",
    fc2: "FC2",
    pl2: "PL2",
    ac3: "AC3",
    pp3: "PY3",
    fc3: "FC3",
    pl3: "PL3",
    ac4: "AC4",
    pp4: "PY4",
    fc4: "FC4",
    pl4: "PL4",
    ORDER_asc: "↑",
    ORDER_desc: "↓",
    ibcssymbol_delta_ac: "Δ{%}",
    ibcssymbol_delta_generic: "Δ({%})",
    ibcssymbol_delta_ac_relative: "Δ{%}%",
    ibcssymbol_delta_generic_relative: "Δ({%})%",
  },
  "bn-title": {
    SEPERATOR_WS: ", ",
    CONNECTOR_WS: " und ",
    in: "in",
  },
  "bn-chart": {},
  "bn-table": {
    in: "in",
    category: " ",
    operation: " ",
    there_of: "davon",
    part_of: "in % von",
    SUM_TOTAL: "❖",
    REST: "REST",
  },
});

const en = flattenObject({
  global: {
    ac1: "AC",
    pp1: "PY",
    fc1: "FC",
    pl1: "PL",
    ac2: "AC2",
    pp2: "PY2",
    fc2: "FC2",
    pl2: "PL2",
    ac3: "AC3",
    pp3: "PY3",
    fc3: "FC3",
    pl3: "PL3",
    ac4: "AC4",
    pp4: "PY4",
    fc4: "FC4",
    pl4: "PL4",
    ORDER_asc: "↑",
    ORDER_desc: "↓",
    ibcssymbol_delta_ac: "Δ{%}",
    ibcssymbol_delta_generic: "Δ({%})",
    ibcssymbol_delta_ac_relative: "Δ{%}%",
    ibcssymbol_delta_generic_relative: "Δ({%})%",
  },
  "bn-title": {
    SEPERATOR_WS: ", ",
    CONNECTOR_WS: " and ",
    in: "in",
  },
  "bn-chart": {},
  "bn-table": {
    category: " ",
    operation: " ",
    there_of: "there of",
    part_of: "in % of",
    SUM_TOTAL: "❖",
    REST: "REST",
  },
});

const BN_INTERNATIONALIZATION_KEYS = Object.keys(de || {});

const { state, on, get, set } = createStore({ _system: { de, en } });

export { on, get, set, globalLabelKeys, BN_INTERNATIONALIZATION_KEYS };
export default state;
