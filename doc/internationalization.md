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

The locale determines which built-in translation bundle is used for scenario labels, sort indicators, table headings, and title connectors.

## Built-in Labels

### Scenario Labels

| Key | English | German |
|-----|---------|--------|
| `ac1` | AC | AC |
| `ac2` | AC2 | AC2 |
| `pp1` | PY | PY |
| `pp2` | PY2 | PY2 |
| `fc1` | FC | FC |
| `fc2` | FC2 | FC2 |
| `pl1` | PL | PL |
| `pl2` | PL2 | PL2 |

(Slots 3 and 4 follow the same pattern: AC3, AC4, PY3, PY4, etc.)

### Variance Symbols

| Key | Value | Description |
|-----|-------|-------------|
| `ibcssymbol_delta_ac` | `Δ{%}` | Absolute variance (e.g., ΔPY) |
| `ibcssymbol_delta_ac_relative` | `Δ{%}%` | Relative variance (e.g., ΔPY%) |

The `{%}` token is replaced at render time with the comparison scenario abbreviation.

### Table Labels

| Key | English | German |
|-----|---------|--------|
| `bn-table.there_of` | there of | davon |
| `bn-table.part_of` | in % of | in % von |
| `bn-table.SUM_TOTAL` | ❖ | ❖ |
| `bn-table.REST` | REST | REST |

### Title Connectors

| Key | English | German |
|-----|---------|--------|
| `bn-title.SEPARATOR_WS` | `, ` | `, ` |
| `bn-title.CONNECTOR_WS` | ` and ` | ` und ` |
| `bn-title.in` | in | in |

## Custom Translations

Override or add translations with `<bn-internationalization>`:

```html
<bn-context locale="en">

  <bn-internationalization code="en" namespace="bn-table">
    {
      "there_of": "of which",
      "SUM_TOTAL": "Total"
    }
  </bn-internationalization>

  <!-- components... -->
</bn-context>
```

### Props

| Prop | Description |
|------|-------------|
| `code` | Language code (e.g., `"en"`, `"de"`) |
| `namespace` | Translation namespace (e.g., `"bn-table"`, `"bn-title"`) |

### Namespace System

Translations are stored in a flat key-value map with namespaced keys. The `namespace` prop is prepended to each key:

```
namespace="bn-table" + key "there_of" → stored as "bn-table.there_of"
```

Global keys (scenario labels, variance symbols) have no namespace prefix.

To override global scenario labels:

```html
<bn-internationalization code="en">
  {
    "ac1": "Actual",
    "pl1": "Budget",
    "pp1": "Prior Year"
  }
</bn-internationalization>
```

## Nested Translation Objects

The JSON body can use nested objects. They are automatically flattened with dot-separated keys:

```html
<bn-internationalization code="en" namespace="custom">
  {
    "labels": {
      "revenue": "Net Revenue",
      "costs": "Operating Costs"
    }
  }
</bn-internationalization>
```

This stores `"custom.labels.revenue"` and `"custom.labels.costs"`.

## Using Translations in bn-text

The `<bn-text>` component can reference translations with the `t()` function:

```html
<bn-text value="${t('custom.labels.revenue')}: ${data.revenue.ac1}"></bn-text>
```

## Full Example

```html
<bn-context locale="en">

  <!-- Override scenario labels globally -->
  <bn-internationalization code="en">
    {
      "ac1": "Actual",
      "pl1": "Budget",
      "pp1": "Prior Year",
      "fc1": "Forecast"
    }
  </bn-internationalization>

  <!-- Override table-specific labels -->
  <bn-internationalization code="en" namespace="bn-table">
    {
      "there_of": "of which",
      "SUM_TOTAL": "Grand Total"
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
