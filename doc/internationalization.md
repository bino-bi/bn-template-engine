# Internationalization

bn-template-engine includes built-in translations for English and German. You can override labels, add translations, or set the locale via `<bn-context>` and `<bn-internationalization>`.

## Setting the Locale

Set the `locale` prop on `<bn-context>`:

```html
<bn-context locale="en">
  <!-- English labels (default) -->
</bn-context>

<bn-context locale="de">
  <!-- German labels -->
</bn-context>
```

The locale determines which translation bundle is used for scenario labels, sort indicators, table headings, and title connectors. Built-in bundles exist for exactly `en` and `de`; the lookup is an exact string match (there is no BCP 47 normalization - `de-DE` does not match `de`).

The locale also sets the number format of tables and charts: `en` prints `1,234.5` and `5.20%`, `de` prints `1.234,5` and `5,20%`. A locale the browser does not know prints German numbers.

## How Lookups Work

Translations are stored per **namespace**, per **language code**, as a flat key-value map:

```
store[namespace][code][key] → label
```

- Every component resolves its namespace from the `i18n-namespace` DOM attribute, with **default inheritance**: the element's own attribute wins; otherwise the nearest ancestor carrying `i18n-namespace` provides it - a layout card, layout page, tree, grid, or the `<bn-context>` itself, crossing shadow boundaries; otherwise the built-in `_system` namespace is used.
- Keys missing from the resolved namespace fall back to `_system` per key; if a key is missing in both places, `t()` returns the key itself (it never throws).
- `<bn-layout-page>` and `<bn-layout-card>` reflect their `i18nNamespace` prop as the `i18n-namespace` attribute (so descendants inherit it) and forward it - falling back to the deprecated, title-only `titleNamespace` - to their internal `<bn-title>`.

The **namespace is a storage slot, not a key prefix**. Keys are stored verbatim (after flattening); the component-style prefixes below are part of the key itself.

## Built-in Keys

### Scenario Labels (key prefix `global.`)

| Key | English | German |
|-----|---------|--------|
| `global.ac1` | AC | AC |
| `global.pp1` | PY | PY |
| `global.fc1` | FC | FC |
| `global.pl1` | PL | PL |

(Slots 2-4 follow the same pattern: `global.ac2` → AC2, `global.pp3` → PY3, etc.)

### Sort Indicators & Variance Symbols (key prefix `global.`)

| Key | Value | Description |
|-----|-------|-------------|
| `global.ORDER_asc` | ↑ | Ascending sort indicator |
| `global.ORDER_desc` | ↓ | Descending sort indicator |
| `global.ibcssymbol_delta_ac` | `Δ{%}` | Absolute variance (e.g., ΔPY) |
| `global.ibcssymbol_delta_generic` | `Δ({%})` | Absolute variance, generic form |
| `global.ibcssymbol_delta_ac_relative` | `Δ{%}%` | Relative variance (e.g., ΔPY%) |
| `global.ibcssymbol_delta_generic_relative` | `Δ({%})%` | Relative variance, generic form |

The `{%}` token is replaced at render time with the comparison scenario abbreviation.

### Table Labels

| Key | English | German |
|-----|---------|--------|
| `bn-table.in` | in | in |
| `bn-table.there_of` | there of | davon |
| `bn-table.part_of` | in % of | in % von |
| `bn-table.SUM_TOTAL` | ❖ | ❖ |
| `bn-table.REST` | REST | REST |

### Title Connectors

| Key | English | German |
|-----|---------|--------|
| `bn-title.SEPERATOR_WS` | `, ` | `, ` |
| `bn-title.CONNECTOR_WS` | ` and ` | ` und ` |
| `bn-title.in` | in | in |

Note the key really is spelled `SEPERATOR_WS`.

The XY and bullet charts have additional message keys under `bn-chart-scatter.`, `bn-chart-bubble.`, and `bn-chart-bullet.` - see `src/stores/internationalization.ts` for the complete list.

## Custom Translations

Override or add translations with `<bn-internationalization>`. Without a `namespace` attribute the payload is **merged into `_system`**, so partial overrides apply on top of the built-ins and every component picks them up:

```html
<bn-context locale="en">

  <bn-internationalization code="en">
    {
      "global": { "ac1": "Actual", "pl1": "Budget", "pp1": "Prior Year" },
      "bn-table": { "there_of": "of which", "SUM_TOTAL": "Total" }
    }
  </bn-internationalization>

  <!-- components... -->
</bn-context>
```

Nested objects are flattened with dot-separated keys, so the payload above stores `global.ac1`, `bn-table.there_of`, … - exactly the built-in key shape. A flat payload (`{"global.ac1": "Actual"}`) is equivalent.

Multiple `<bn-internationalization>` elements for the same namespace and code merge in document order (later elements win per key).

### Props

| Prop | Description |
|------|-------------|
| `code` | Language code (e.g., `"en"`, `"de"`). Must match the `<bn-context>` locale to take effect. |
| `namespace` | Storage namespace. Defaults to `_system` (the bundle all components read). |

### Named Namespaces

A non-default namespace is an alternative bundle that only elements resolving a matching `i18n-namespace` consult (missing keys still fall back to `_system` per key). Set the attribute on the component itself or on any ancestor - layout pages/cards, trees, grids, and `<bn-context>` all work as providers thanks to default inheritance. Keys inside must use the same fully-prefixed shape as the built-ins:

```html
<bn-internationalization code="en" namespace="external">
  { "global": { "ac1": "Actuals (audited)" } }
</bn-internationalization>

<!-- directly on the component ... -->
<bn-table i18n-namespace="external" scenarios="ac1,pl1"></bn-table>

<!-- ... or inherited from an enclosing layout page -->
<bn-layout-page i18n-namespace="external">
  <div slot="slot-0"><bn-table scenarios="ac1,pl1"></bn-table></div>
</bn-layout-page>
```

## Using Translations in bn-text

The `<bn-text>` component can reference translations with the `t()` function. `bn-text` reads the default `_system` namespace, so custom keys registered without a namespace are directly addressable:

```html
<bn-internationalization code="en">
  { "labels": { "revenue": "Net Revenue" } }
</bn-internationalization>

<bn-text datasets="revenue" value="${t('labels.revenue')}: ${data.revenue[0].ac1}"></bn-text>
```

## Full Example

```html
<bn-context locale="en">

  <!-- Partial override of built-in labels; merges into _system -->
  <bn-internationalization code="en">
    {
      "global": { "ac1": "Actual", "pl1": "Budget", "pp1": "Prior Year", "fc1": "Forecast" },
      "bn-table": { "there_of": "of which", "SUM_TOTAL": "Grand Total" }
    }
  </bn-internationalization>

  <bn-datasource name="sales">
    [
      { "category": "North", "ac1": 120, "pl1": 100 },
      { "category": "South", "ac1": 80, "pl1": 90 }
    ]
  </bn-datasource>

  <bn-dataset name="sales" datasources="sales">
    SELECT category, SUM(ac1) as ac1, SUM(pl1) as pl1 FROM sales GROUP BY category
  </bn-dataset>

  <bn-page format="hd" orientation="landscape">
    <bn-body>
      <bn-table scenarios="ac1,pl1" variances="dac1_pl1_pos"></bn-table>
    </bn-body>
  </bn-page>

</bn-context>
```

The table will display columns labeled "Actual", "Budget", and the variance column "ΔBudget" instead of "AC", "PL", and "ΔPL".
