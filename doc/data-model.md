# Data Model

This document describes the data schema used by bn-template-engine components. Data is provided as JSON rows via `<bn-datasource>`, queried with AlaSQL in `<bn-dataset>`, and rendered by visualization components.

## Overview

Each row in a dataset represents a data point with:

- **Dimensions** - categorical fields for grouping and labeling (category, rowGroup, etc.)
- **Scenarios** - numeric values for different business scenarios (actual, plan, forecast, previous period)
- **Operation** - whether the row adds (`"+"`) or subtracts (`"-"`) in aggregations

## Scenarios

Four scenario families, each with up to four slots:

| Family | Slots | Description | IBCS Visual |
|--------|-------|-------------|-------------|
| **Actual (AC)** | `ac1`, `ac2`, `ac3`, `ac4` | Realized values | Solid dark bars |
| **Previous Period (PP)** | `pp1`, `pp2`, `pp3`, `pp4` | Prior period comparison | Light gray bars |
| **Forecast (FC)** | `fc1`, `fc2`, `fc3`, `fc4` | Projected values | Hatched bars |
| **Plan (PL)** | `pl1`, `pl2`, `pl3`, `pl4` | Target/budget values | Outlined bars |

All scenario fields are `number | null`. In queries, they are aggregated with the operation sign:

```sql
SUM(ac1 * transformOperator(operation)) as ac1
```

Where `transformOperator("+")` returns `1` and `transformOperator("-")` returns `-1`.

### Example

```json
[
  { "category": "Product Sales", "operation": "+", "ac1": 150000, "pp1": 140000, "pl1": 145000 },
  { "category": "Discounts",     "operation": "-", "ac1": 12000,  "pp1": 10000,  "pl1": 11000 },
  { "category": "Services",      "operation": "+", "ac1": 90000,  "pp1": 85000,  "pl1": 88000 }
]
```

## Variances

Variance columns are computed from scenario pairs. They follow a naming pattern:

```
{type}_{base}_{delta}_{direction}
```

| Part | Values | Meaning |
|------|--------|---------|
| `type` | `d` or `dr` | `d` = absolute difference, `dr` = relative (percentage) |
| `base` | `ac1`..`pl4` | The primary scenario |
| `delta` | `ac1`..`pl4` | The comparison scenario |
| `direction` | `pos`, `neg`, `neu`, `op`, `opinv` | Favorable, unfavorable, neutral, or by row operation |

**Examples:**

| Variance | Meaning |
|----------|---------|
| `dac1_pl1_pos` | Absolute: AC1 minus PL1, favorable when positive |
| `drac1_pp1_neg` | Relative %: (AC1 - PP1) / \|PP1\|, unfavorable when positive |
| `dac1_fc1_neu` | Absolute: AC1 minus FC1, neutral (no color coding) |

The `direction` determines the IBCS color coding in charts and tables:

- `pos` - Green/teal when the value is favorable (positive difference is good)
- `neg` - Red when the value is unfavorable (positive difference is bad)
- `neu` - Gray, no direction judgment
- `op` - By the row operation. In a `type="opt"` or `"optnototal"` table, entry values are shown without their sign. There a `-` row acts like `neg` and a `+` row or a sum row like `pos`, so a rising cost is red and rising revenue is green. Thereof rows use the operation of their parent. In other tables and in charts the values carry their sign already, so `op` acts like `pos`.
- `opinv` - The inverse of `op`, for reports where the main measure is a cost.

A variance that prints as zero at the displayed digits has no sign and no direction color, as IBCS shows it. With one decimal digit this holds for `0`, `0.04` and `-0.04`. It applies to absolute, relative and percentage point variances in table cells (entry, sum and total rows), to the bar and pin labels of a table, and to the variance labels of `bn-chart-time` and `bn-chart-structure`.

To display variances, pass them as a comma-separated list to the `variances` prop:

```html
<bn-table scenarios="ac1,pl1" variances="dac1_pl1_pos,drac1_pl1_pos"></bn-table>
```

## Dimensions

### Row Grouping (Hierarchical)

Rows can be organized into a three-level hierarchy:

| Field | Type | Description |
|-------|------|-------------|
| `rowGroup` | `string` | Primary grouping (e.g., "Revenue", "Costs") |
| `rowGroupIndex` | `number` | Sort order for row groups |
| `category` | `string` | Dimension within a row group (e.g., "Product Sales") |
| `categoryIndex` | `number` | Sort order for categories |
| `subCategory` | `string` | Detail dimension for drill-down |
| `subCategoryIndex` | `number` | Sort order for subcategories |

```
rowGroup: "Revenue"
├── category: "Product Sales"
│   ├── subCategory: "Electronics"
│   └── subCategory: "Furniture"
└── category: "Services"
```

### Column Grouping

For multi-dimensional tables:

| Field | Type | Description |
|-------|------|-------------|
| `columnGroup` | `string` | Column-level grouping |
| `columnGroupIndex` | `number` | Sort order for column groups |
| `columnSubGroup` | `string` | Column sub-grouping |
| `columnSubGroupIndex` | `number` | Sort order for column sub-groups |

### Temporal Dimension

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | ISO 8601 date string (e.g., `"2024-01-15"`) |

Used by `<bn-chart-time>` for time series visualization. The `dateInterval` prop controls the aggregation level (year, quarter, month, etc.).

`date` values are read and shown in UTC, in every browser time zone: a date without a time is midnight UTC, a value with an offset is converted to UTC, a number is epoch milliseconds. The SQL date functions (`YEAR`, `MONTH`, `DAY`) in a `filter` or a dataset query still use the time zone of the browser, so compare the text instead: `[date] >= '2024-01-01'`.

### Other Fields

| Field | Type | Description |
|-------|------|-------------|
| `setname` | `string` | Dataset identifier (used by structure charts, and by `<bn-table>` with `interval="setname"`) |
| `setnameIndex` | `number` | Optional. Sort order of the `setname` groups of a `<bn-table>` with `interval="setname"` |
| `operation` | `string` | `"+"` (default) or `"-"` - determines sign in aggregations |

With `interval="setname"` a `<bn-table>` shows one column block per `setname`. Without `setnameIndex` the blocks are in order of first appearance in the data. With `setnameIndex` they are sorted ascending by it, for example three months first and a year-to-date block last. If a `setname` has different indexes, the smallest one counts. Blocks without a numeric index come last. `setnameIndex` needs `setname`: a row with an index and a blank `setname` gives the warning `WARN_intervalSetnameIndex`. The check runs only with `interval="setname"`, other tables do not read the field. Date intervals ignore the field.

### Custom Fields

Rows may carry additional user-defined fields prefixed with an underscore (e.g. `_leiter`, `_region`, `_product`). They pass through `<bn-datasource>` and `<bn-dataset>` untouched and can be consumed by `<bn-table>` via the `attributes` prop (see below). Standard visualization queries ignore them.

## Attribute Columns (bn-table)

The `attributes` prop on `<bn-table>` defines custom columns computed from dataset fields. It is a JSON object: keys are column labels, values are aggregate expressions evaluated over the rows that make up each table row.

```html
<bn-table
  datasets="$umsatz"
  scenarios="ac1,pp1"
  attributes='{"Verkaufsleiter": "set(_leiter)", "Umsatz gesamt": "sum(ac1)"}'>
</bn-table>
```

| Function | Result |
|----------|--------|
| `set(field)` | Unique values, joined with `", "` |
| `first(field)` | First value |
| `last(field)` | Last value |
| `min(field)` | Minimum |
| `max(field)` | Maximum |
| `avg(field)` | Average |
| `sum(field)` | Sum |
| `lit(value)` | Constant value |

`field` can be any dataset field - custom `_`-prefixed fields as well as standard ones like `ac1` or `date`. Behavior:

- Attribute columns are placed after the category column, before the scenario columns.
- Cells stay blank on `SUM`, `GROUP_SUM`, `GROUPHEAD`, `REST`, and `PARTELEMENT` rows; thereof drill rows compute values over the drilled subset.
- `sum`/`avg` on scenario fields (`ac1`-`pl4`) respect the row operation sign, consistent with the built-in scenario columns.
- Numeric results (`min`/`max`/`avg`/`sum`) are formatted like scenario value cells (measure scale and decimal digits, even when `data-format="percent"`); other results render as-is.
- Column labels are looked up in the i18n map and fall back to the label verbatim.

## Generated Row Types

When `<bn-table>` processes data, it generates additional rows:

| Type | Description |
|------|-------------|
| `ENTRY` | Normal data row |
| `GROUPHEAD` | Row group header |
| `GROUP_SUM` | Subtotal for a row group. With `running-sum` it is the result of all groups up to this one |
| `SUM` | Grand total |
| `DRILLELEMENT` | Thereof drill-down detail row, below its parent row or above it (`thereof-position`) |
| `PARTELEMENT` | Part-of percentage row |
| `REST` | Aggregated remaining rows (when a `limit` is applied) |

## Count Fields

Each scenario has a corresponding `_cnt` field (e.g., `ac1_cnt`) that tracks the number of non-null values. These are used internally for variance validation - a variance is only computed when both the base and delta scenarios have data.

## Complete Example

```json
[
  {
    "rowGroup": "Revenue",
    "rowGroupIndex": 1,
    "category": "Product Sales",
    "categoryIndex": 1,
    "operation": "+",
    "date": "2024-01-01",
    "ac1": 150000,
    "pp1": 140000,
    "fc1": 155000,
    "pl1": 145000
  },
  {
    "rowGroup": "Revenue",
    "rowGroupIndex": 1,
    "category": "Services",
    "categoryIndex": 2,
    "operation": "+",
    "date": "2024-01-01",
    "ac1": 90000,
    "pp1": 85000,
    "fc1": 92000,
    "pl1": 88000
  },
  {
    "rowGroup": "Costs",
    "rowGroupIndex": 2,
    "category": "Personnel",
    "categoryIndex": 1,
    "operation": "-",
    "date": "2024-01-01",
    "ac1": 80000,
    "pp1": 75000,
    "fc1": 82000,
    "pl1": 78000
  }
]
```

This data can be queried and displayed as:

```html
<bn-table
  scenarios="ac1,pp1,pl1"
  variances="dac1_pl1_pos"
  grouped="true"
  type="sum">
</bn-table>
```

The table will show:
- Two row groups: Revenue and Costs
- Categories within each group
- Subtotals per group and a grand total
- An absolute variance column (AC1 vs PL1)
