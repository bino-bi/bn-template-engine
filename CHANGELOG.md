# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

#### bn-table: Inline Bar Chart Columns

New properties for rendering variance and scenario columns as inline IBCS-compliant bar charts:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bar-columns` | `string[]` | `[]` | List of column names to render as bar charts instead of numbers. |
| `unit-scaling` | `number` | `0.01` | Pixels per unit for absolute variance bars (d_ prefix). |
| `percentage-scaling` | `number` | `0.5` | Pixels per percentage point for relative variance pins (dr_ prefix). |

**Usage Examples:**

```html
<!-- Render variance columns as bar charts -->
<bn-table
  scenarios="ac1,pp1"
  variances="dac1_pp1_pos,drac1_pp1_pos"
  bar-columns="dac1_pp1_pos,drac1_pp1_pos"
></bn-table>

<!-- Custom scaling (larger bars) -->
<bn-table
  scenarios="ac1,pp1"
  variances="dac1_pp1_pos"
  bar-columns="dac1_pp1_pos"
  unit-scaling="0.02"
  percentage-scaling="1"
></bn-table>

<!-- Scenario columns as bar charts (IBCS grayscale) -->
<bn-table
  scenarios="ac1,pp1,fc1"
  bar-columns="ac1,pp1,fc1"
></bn-table>
```

**Bar Chart Types:**

- **Absolute Variance (d_ prefix)**: Horizontal bars with centered axis
  - Bar extends left (negative) or right (positive) from center axis
  - Green for positive-good, red for negative-bad (based on _pos/_neg suffix)
  - Value label displayed next to bar

- **Relative Variance (dr_ prefix)**: Pin/dot chart
  - Thin colored line from axis with black dot at end
  - Arrow indicator for extreme values (>100%)
  - Italic percentage label (IBCS standard)

- **Scenario Columns (ac, pp, fc, pl)**: IBCS grayscale styling
  - AC (Actual): Dark gray, solid fill
  - PP (Previous Period): Light gray, solid fill
  - FC (Forecast): Dark gray stroke, hatched pattern
  - PL (Plan): Dark gray stroke, outlined (no fill)

**Fill Patterns:**

Variance bars support configurable fill patterns via componentStyle:
- `solid`: Filled bar (default for pos/neg)
- `hatched`: Diagonal line pattern (default for fc)
- `outlined`: Stroke only, no fill (default for neu/pl)

---

#### bn-chart-time: LineChart Visualization Mode

New properties for rendering time series data as line charts:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chart-mode` | `'bar' \| 'line' \| 'auto'` | `'bar'` | Controls how the chart is rendered. When set to `'auto'`, the chart automatically switches to line mode when data points exceed `max-bars`. |
| `max-bars` | `number` | `28` | Threshold for auto-switching to line mode. Only applies when `chart-mode="auto"`. |

**Usage Examples:**

```html
<!-- Default bar chart -->
<bn-chart-time scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Force line chart mode -->
<bn-chart-time chart-mode="line" scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Auto-switch to line when data points exceed 28 -->
<bn-chart-time chart-mode="auto" max-bars="28" scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Auto-switch with custom threshold -->
<bn-chart-time chart-mode="auto" max-bars="15" scenarios="ac1,pp1" ...></bn-chart-time>
```

**Line Chart Features:**
- Square markers (8x8px) at each data point
- Data values displayed above each marker
- Scenario labels positioned to the right of the last data point
- Smart X-axis labels showing only start, end, and year boundaries
- Vertical dashed separator lines at year transitions
- IBCS color schema:
  - AC (Actual): Black fill, black stroke, solid line
  - PP (Previous Period): Gray fill, gray stroke, solid line
  - FC (Forecast): White fill, black stroke, dashed line
  - PL (Plan): White fill, black stroke, solid line

---

#### bn-grid: Matrix Layout Component (Small Multiples)

New component for creating IBCS-style matrix layouts with cross-style dividers, ideal for "small multiples" visualizations.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chart-title` | `string` | `''` | Title displayed at top-left of the grid. |
| `row-headers` | `string` | `'[]'` | JSON array defining row headers. |
| `column-headers` | `string` | `'[]'` | JSON array defining column headers. |
| `show-row-headers` | `string` | `'true'` | Whether to display row headers. |
| `show-column-headers` | `string` | `'true'` | Whether to display column headers. |
| `show-borders` | `string` | `'true'` | Whether to display divider lines between cells. |
| `row-header-width` | `string` | `'auto'` | Width of row header column. |
| `cell-gap` | `string` | `'0px'` | Gap between cells. |

**Usage Examples:**

```html
<!-- Index-based slot naming -->
<bn-grid
  chart-title="Trends, in USD"
  row-headers='["ΔPY%", "ΔPY"]'
  column-headers='["Total Revenue", "Gross Profit"]'
>
  <bn-chart-time slot="0-0" ... />
  <bn-chart-time slot="0-1" ... />
  <bn-chart-time slot="1-0" ... />
  <bn-chart-time slot="1-1" ... />
</bn-grid>

<!-- ID-based slot naming -->
<bn-grid
  row-headers='[{"label": "Revenue", "id": "rev"}, {"label": "Profit", "id": "profit"}]'
  column-headers='[{"label": "Q1", "id": "q1"}, {"label": "Q2", "id": "q2"}]'
>
  <bn-chart-time slot="rev-q1" ... />
  <bn-chart-time slot="rev-q2" ... />
  <bn-chart-time slot="profit-q1" ... />
  <bn-chart-time slot="profit-q2" ... />
</bn-grid>
```

**Layout Features:**
- **Cross-style dividers**: Only internal lines between cells (no outer borders)
- **Title support**: Optional title at top-left
- **Flexible headers**: Simple string arrays or objects with custom IDs
- **Content-sized cells**: Grid sizes to fit content, no excess whitespace
- **Named slots**: Both index-based (`"0-1"`) and ID-based (`"rev-q1"`) slot naming

---

### [0.1.2](https://github.com/bino-bi/bn-template-engine/compare/v0.1.1...v0.1.2) (2021-01-10)

### [0.1.1](https://github.com/bino-bi/bn-template-engine/compare/v0.1.0...v0.1.1) (2021-01-10)
