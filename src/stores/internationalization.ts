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
 * time by `Formatter.translateScenarioLabel` — not by `withTranslation`,
 * which only interpolates `{{mustache}}` placeholders.
 *
 * @module stores/internationalization
 */
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

/**
 * Message keys shared by both XY charts (`bn-chart-scatter`,
 * `bn-chart-bubble`): axis captions, legend labels, the no-data text, and
 * one message per warning/error code the charts can raise (`{{…}}`
 * placeholders are interpolated by `withTranslation`).
 */
const xyChartKeysDe = {
  axis: { in: "in" },
  legend: { title: "" },
  "no-data": "Keine Daten",
  "xy-prop-json": "{{prop}}: ungültiges JSON.",
  "xy-measure-invalid": "{{prop}}: '{{measure}}' ist weder eine Szenario-Spalte noch ein Varianz-Token.",
  "xy-family-mixed": "Alle Kennzahlen müssen zur selben Szenario-Familie gehören (gefunden: {{families}}).",
  "xy-level-order": "Facet-, Serien- und Punktebene müssen in der Hierarchie streng absteigen ({{detail}}).",
  "xy-duplicate-point":
    "{{count}} doppelte Punkt-Identität(en) verworfen (erste Zeile gewinnt): {{names}}. Im DataSet-SQL aggregieren.",
  "xy-point-clipped": "{{count}} Punkt(e) außerhalb des expliziten min/max ausgeschlossen.",
  "xy-variance-nodata": "{{count}} Zeile(n) ohne Varianzdaten ausgeschlossen.",
  "xy-label-unknown": "Unbekannte Label-Namen: {{names}}.",
  "xy-series-overflow": "Mehr Serien als Palettenfarben; Farben wiederholen sich aufgehellt.",
  "xy-point-budget": "{{count}} Punkte überschreiten das Budget von 5000 Punkten; 'limit' erwägen.",
};

const xyChartKeysEn = {
  axis: { in: "in" },
  legend: { title: "" },
  "no-data": "No Data",
  "xy-prop-json": "{{prop}}: invalid JSON.",
  "xy-measure-invalid": "{{prop}}: '{{measure}}' is neither a scenario column nor a variance token.",
  "xy-family-mixed": "All measures must share one scenario family (found: {{families}}).",
  "xy-level-order": "Facet, series, and point levels must strictly descend in the hierarchy ({{detail}}).",
  "xy-duplicate-point":
    "{{count}} duplicate point identitie(s) dropped (first row wins): {{names}}. Aggregate in the DataSet SQL.",
  "xy-point-clipped": "{{count}} point(s) outside the explicit min/max excluded.",
  "xy-variance-nodata": "{{count}} row(s) without variance data excluded.",
  "xy-label-unknown": "Unknown label name(s): {{names}}.",
  "xy-series-overflow": "More series than palette colors; colors repeat with a tint step.",
  "xy-point-budget": "{{count}} points exceed the 5000-point budget; consider 'limit'.",
};

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
  "bn-chart-time": { "no-data": "Keine Daten" },
  "bn-chart-structure": { "no-data": "Keine Daten", REST: "REST" },
  "bn-chart-scatter": {
    ...xyChartKeysDe,
    "xy-iso-domain": "Iso-Linien benötigen einen strikt positiven Wertebereich auf beiden Achsen; übersprungen.",
  },
  "bn-chart-bubble": {
    ...xyChartKeysDe,
    legend: { ...xyChartKeysDe.legend, size: "Größe", compare: "Szenarien" },
    "xy-compare-variance": "compareWith kann nicht mit Varianz-Kennzahlen auf den Achsen kombiniert werden.",
    "bubble-size-negative": "{{count}} Blase(n) mit negativem Größenwert ausgeschlossen.",
    "bubble-share-range": "{{count}} Anteilswert(e) außerhalb [0,1] wurden begrenzt.",
    "bubble-scale-group-unknown": "size.group '{{group}}' verweist auf keine bn-scaling-group im Kontext.",
    "bubble-scale-overflow":
      "{{count}} gruppenskalierte Blase(n) überschreiten das Panel; in Originalgröße gezeichnet.",
  },
  "bn-chart-bullet": {
    axis: { in: "in" },
    "no-data": "Keine Daten",
    target: "Ziel",
    "bullet-prop-json": "{{prop}}: ungültiges JSON.",
    "bullet-measure-invalid": "{{prop}}: '{{measure}}' ist keine Szenario-Spalte (ac1…pl4).",
    "bullet-measure-same": "actual und target müssen unterschiedliche Szenarien sein ('{{measure}}').",
    "bullet-target-none": "Kein Ziel-Szenario gefunden (pl1/pp1/fc1); nur Ist-Balken werden gezeichnet.",
    "bullet-target-missing": "{{count}} Zeile(n) ohne Zielwert; Varianz und Marker entfallen.",
    "bullet-target-invalid": "{{count}} Zeile(n) mit Ziel ≤ 0 können nicht normalisiert werden; Balken entfällt.",
    "bullet-mixed-operation": "{{count}} KPI-Gruppe(n) mischen '+'- und '-'-Zeilen; Sentiment fällt auf '+' zurück.",
    "bullet-ranges-ignored": 'ranges: im normalisierten (IBCS-)Modus ignoriert; normalize="none" setzen.',
    "bullet-ranges-invalid": "ranges: erwartet bis zu 2 aufsteigende positive Zielanteile ({{detail}}).",
  },
  "bn-table": {
    in: "in",
    category: " ",
    operation: " ",
    there_of: "davon",
    part_of: "in % von",
    SUM_TOTAL: "❖",
    REST: "REST",
    "no-data": "Keine Daten",
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
  "bn-chart-time": { "no-data": "No Data" },
  "bn-chart-structure": { "no-data": "No Data", REST: "REST" },
  "bn-chart-scatter": {
    ...xyChartKeysEn,
    "xy-iso-domain": "Iso-lines need a strictly positive domain on both axes; skipped.",
  },
  "bn-chart-bubble": {
    ...xyChartKeysEn,
    legend: { ...xyChartKeysEn.legend, size: "Size", compare: "Scenarios" },
    "xy-compare-variance": "compareWith cannot be combined with variance measures on the axes.",
    "bubble-size-negative": "{{count}} bubble(s) with a negative size value excluded.",
    "bubble-share-range": "{{count}} share value(s) outside [0,1] were clamped.",
    "bubble-scale-group-unknown": "size.group '{{group}}' names no bn-scaling-group in scope.",
    "bubble-scale-overflow": "{{count}} group-scaled bubble(s) exceed the panel; rendered true-size.",
  },
  "bn-chart-bullet": {
    axis: { in: "in" },
    "no-data": "No Data",
    target: "Target",
    "bullet-prop-json": "{{prop}}: invalid JSON.",
    "bullet-measure-invalid": "{{prop}}: '{{measure}}' is not a scenario column (ac1…pl4).",
    "bullet-measure-same": "actual and target must map different scenarios ('{{measure}}').",
    "bullet-target-none": "No target scenario found (pl1/pp1/fc1); rendering actual bars only.",
    "bullet-target-missing": "{{count}} row(s) without a target value; variance and marker omitted.",
    "bullet-target-invalid": "{{count}} row(s) with target ≤ 0 cannot be normalized; bar omitted.",
    "bullet-mixed-operation": "{{count}} KPI group(s) mix '+' and '-' rows; sentiment defaults to '+'.",
    "bullet-ranges-ignored": 'ranges: ignored in normalized (IBCS) mode; set normalize="none".',
    "bullet-ranges-invalid": "ranges: expected up to 2 ascending positive fractions of the target ({{detail}}).",
  },
  "bn-table": {
    in: "in",
    category: " ",
    operation: " ",
    there_of: "there of",
    part_of: "in % of",
    SUM_TOTAL: "❖",
    REST: "REST",
    "no-data": "No Data",
  },
});

const BN_INTERNATIONALIZATION_KEYS = Object.keys(de || {});

export const SYSTEM_I18N_DEFAULTS: Record<string, unknown> = { _system: { de, en } };

export { globalLabelKeys, BN_INTERNATIONALIZATION_KEYS };
