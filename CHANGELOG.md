# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

#### `getLayoutState()`: machine-readable report layout

A public `@Method()` on `bn-context` - which aggregates every visual descendant - and on the rich components (`bn-table`, `bn-chart-time`, `bn-chart-structure`, `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`, `bn-tree`, `bn-grid`). It returns a JSON-serializable snapshot of the rendered report, for debugging tools, embedding hosts that draw overlays, and agents that need to read a report technically.

```js
const state = await document.querySelector("bn-context").getLayoutState();
const table = await document.querySelector("bn-table").getLayoutState({ detail: "full" });
```

Per component the snapshot reports identity (`id`/`name` attribute, otherwise a generated `tag[index]`), dual-coordinate rects (relative to the `bn-context` host and to the component, CSS px), em context, named regions, metadata (bar/point/row/cell/node counts, scenarios, `hasNoData`), the parsed `has-error` diagnostics, and the resolved unit/percentage scaling - **including values that were auto-fitted silently**, which nothing else exposes. `detail: "full"` adds per-element geometry: bars, labels, axes, every table cell with its model value and column key, tree nodes/edges and grid cells with slot names.

Geometry always comes from measuring the rendered output, so results stay correct after an auto-fit re-render. Note that each call measures the live DOM at that moment: charts auto-fit asynchronously, so wait for `window.componentRegisterIsRenderedResult === true` before relying on final geometry, and prefer the default `"summary"` detail - `"full"` on a 1000×20 table lists ~20k cells.

Types are re-exported from the package root (`LayoutState`, `ComponentLayoutState`, `LayoutRect`, `DualRect`, `ScalingInfo`, …). Additive changes keep `LAYOUT_STATE_VERSION` at `1`; a breaking shape change bumps it. See [doc/layout-state.md](doc/layout-state.md).

### ⚠ BREAKING CHANGES

#### `unit-scaling` / `percentage-scaling`: new em-based semantics

The scaling attributes on `bn-table`, `bn-chart-time`, and `bn-chart-structure` keep their names but change meaning (no legacy mode):

- `unit-scaling` is now **data units per 1 em of bar length** (map-scale semantics - larger value ⇒ smaller bars). Old meaning: pixels per unit (charts) / em per unit (table).
- `percentage-scaling` is now **percentage points per 1 em of pin length**. The old chart-only `× 100` on numeric input is gone; numeric values and scaling-group values are interpreted identically.
- Values accept an optional SI suffix: `k`/`K` = 10³, `M` = 10⁶, `G` = 10⁹, `T` = 10¹² (e.g. `unit-scaling="2.5M"`). Lowercase `m`/`g`/`t` are rejected.
- `bn-table` defaults changed from `0.01`/`0.5` to `"100"`/`"2"` - same rendered output.
- Invalid values and unknown group names now fall back to auto-fit with an `AUTO_*` warning in **all** components (previously the table produced NaN silently). The auto-fit warning reports the resolved value in the new unit (e.g. `auto-fitted to 1 em ≈ 250k units`) so it can be copied into a `bn-scaling-group`.
- `bn-scaling-group` `value` is now `string | number` with the same grammar, is validated (positive, finite), and carries units-per-em / pp-per-em / units-per-em² depending on the referencing attribute (bubble `size.group` values are per em² of area). Groups now clean up their store entry on disconnect, reject names that parse as numbers, and warn on duplicate names.

**Migration** (old → new, base font 13.3333 px): charts `new = 13.3333 / old` (both attributes); table `new = 1 / old`; bubble groups `new = 177.77 / old`. See [doc/scaling.md](doc/scaling.md).

#### `bn-text`: `value` is a template with placeholders, not JavaScript

`value` is no longer evaluated. Only these placeholders are replaced:

- `${data.<dataset>[<row>].<field>}` and `${data['<name>'][<row>].<field>}` (`this.data` is accepted too)
- `${t('<key>')}` and `${t('<key>', { name: 'text', count: 3, value: data.kpi[0].ac1 })}`

Any other `${...}` (arithmetic, method calls, conditions) is printed as written. Dataset values and translations are HTML-escaped, so markup inside a value or a translation is shown as text. A backslash or a backtick in the text is printed as it is. A placeholder that does not resolve renders empty and adds a `WARN_value_path` warning to `has-error`. This also happens while a dataset is still loading and for a dataset without rows. `ERR_value_eval` is gone.

#### `bn-table`: a failed query gives `ERR_sql` instead of a partial table

When one of the table's queries fails, the table is not rendered and `has-error` gets an `ERR_sql` item of type `error`. Before, the failed part was dropped silently: a row group could disappear while the total still counted its rows. Two inputs that used to render a broken table now end in `ERR_sql`: a scenario or a `columnthereof` scenario key that is not a plain identifier (letters, digits, `_`), and a negative `limit`.

#### Sanitized HTML: disallowed elements are removed with their content

Applies to `bn-text` `value`, `bn-message` `text` (`message-text`) and the title `business-unit`.

- An element that is not on the allowlist is removed together with everything inside it. Before, it was replaced by its text.
- `code`, `pre`, `blockquote` and `del` are new on the allowlist.
- `style` is kept only when it is exactly `text-align: left`, `center` or `right`.
- `href` and `src` accept `http:`, `https:`, `mailto:` and relative URLs. `src` also accepts `data:` URLs. Any other URL is removed.

### Fixed

- `bn-table`, `bn-chart-time`, `bn-chart-structure`, `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`: with no rows, each component printed its no-data text as a bare paragraph in the top-left corner, styled differently per component (small italic in the structure chart) and repeated once per variance segment in the time and structure charts. All six now show one box that fills the component's space, with a thin dashed grey border and the text centered in muted grey. Layout state still reports `hasNoData`; the component rect now spans the cell.
- Tables and charts with no rows printed the no-data label with literal `==` markers (`==No Data==` / `==Keine Daten==`). The built-in label is now `No Data` (en) / `Keine Daten` (de). A `*.no-data` key set to `""` now hides the label instead of bringing the placeholder back.
- `bn-table`: a table that rendered taller than its layout cell was clipped without a trace - the bottom rows, grand total included, simply disappeared and no diagnostic mentioned it. The table now measures its rendered size against the constrained parent on every render and publishes a `WARN_overflow` item in `has-error` with the measured magnitude (an `error` when `scale` pins the size, a `warning` in auto mode). Scaling is unchanged: `scale` still fits the width only, so a height overflow is fixed by more space, fewer rows (`limit`) or a smaller `scale`.
- `bn-chart-time`: the measure-scale footer ("in kEUR") floated beside the base chart's SVG whenever the SVG was narrow enough to fit next to it, shifting the base chart right by the footer width while the variance segments stayed put. Base and variance bars were misaligned by exactly that width. The footer now always sits above the SVG.
- Chart wrappers: stale `AUTO_percentageScaling` warning was not cleared when a scaling group resolved.
- `bn-chart-structure` / `bn-chart-time`: an optional attribute that was simply not set produced a warning of its own - `level: invalid value(s) 'undefined' are not supported.` and the same for `order-direction`, `unit-scaling`, `percentage-scaling`, `date-interval` and `axis-labels-mode` - next to the correct `AUTO_<field>` notice for the very same blank value. On a report with many charts these drowned out the real warnings. An omitted field now yields only its documented `AUTO_<field>` notice; `ERR_<field>` is reserved for a value that was written and is wrong.
- SI prefix tables: removed a stray `"P"` (peta) from the negative-prefix table (femto range was shifted); `measure-scale` now accepts both `"my"` and `"μ"` for micro; magnitude→prefix picking is now `Math.log10`-based and handles exponential notation (`1e-7`, `1e24`) and boundary values correctly.

### Security

- Sanitized HTML (`bn-text`, `bn-message`, title `business-unit`) was parsed in the live document, so an `<img onerror>` or `<audio onerror>` inside a disallowed element ran its handler before it was removed, and `<a href="java&#x09;script:...">` passed the URL check. The HTML is now parsed in a separate inert document and URLs are checked with the URL parser.
- `bn-text` evaluated `value` with `new Function`. The pattern check in front of it did not stop expressions such as `${t['constr'+'uctor']('...')()}`, so a template could run any JavaScript, and dataset values were joined into the markup unescaped. The evaluator is replaced by a placeholder parser and every resolved value is HTML-escaped.
- `bn-table` pasted row values (row group names) and free-text settings (`sum-title`, `thereof`, `partof`, `columnthereof` names, `lit(...)` attributes) into quoted SQL literals. A value with an apostrophe such as `Men's Wear` broke its query, and a crafted value could run as AlaSQL inline JavaScript. These values are now passed to AlaSQL as query parameters.

## [v0.39.0] - 2026-01-21

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
