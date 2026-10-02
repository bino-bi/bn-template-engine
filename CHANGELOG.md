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

#### `filter` and `bn-dataset` SQL: double backticks are rejected

AlaSQL runs text between double backticks as JavaScript. A `filter` (on `bn-table` and the five charts) that contains a double backtick is not sent to AlaSQL: the component shows its no-data state and `has-error` gets an `ERR_filter` item of type `error`. A `bn-dataset` SQL body with a double backtick is not registered and the dataset gets an `ERR_sql` item. A SQL body that AlaSQL cannot parse now also sets `ERR_sql` (before: console only). Two backticks with only a comment between them count as a double backtick.

#### Layout attributes take exactly one CSS value

`width`, `height`, `position`, `top`, `right`, `bottom`, `left`, `font-size`, `grid-column` and `grid-row` are parsed by the browser before they are written to the engine's stylesheet. A value that is not valid for its property is ignored, as before. New: a value with a trailing semicolon (`width="100px;"`), with more than one declaration (`width="10px; color: red"`) or with `!important` is ignored as a whole.

#### `bn-dataset` / `bn-datasource`: the URL moves from the body to `src`

A body that started with `/`, `http://` or `https://` used to be fetched as a URL, so SQL that began with a `/* comment */` was requested from the server instead of being run. The body is now always inline content. To load JSON from an endpoint, set the new `src` attribute:

```html
<!-- before -->
<bn-dataset name="sales" interval="30">https://example.com/api/sales.json</bn-dataset>
<!-- after -->
<bn-dataset name="sales" interval="30" src="https://example.com/api/sales.json"></bn-dataset>
```

While `src` is set the body is ignored. `interval` keeps its meaning.

#### Sanitized HTML: disallowed elements are removed with their content

Applies to `bn-text` `value`, `bn-message` `text` (`message-text`) and the title `business-unit`.

- An element that is not on the allowlist is removed together with everything inside it. Before, it was replaced by its text.
- `code`, `pre`, `blockquote` and `del` are new on the allowlist.
- `style` is kept only when it is exactly `text-align: left`, `center` or `right`.
- `href` and `src` accept `http:`, `https:`, `mailto:` and relative URLs. `src` also accepts `data:` URLs. Any other URL is removed.

#### Dates are read and shown in UTC

`date` values, `date-start` / `date-end` of `bn-title` and all date labels used the time zone of the browser. Report data carries dates as `2024-01-01T00:00:00Z`, so west of UTC every value fell into the previous month, quarter or year (January 2024 was shown as `Dec 2023` in New York), and east of UTC a late evening value fell into the next one. `bn-table` (`interval`), `bn-chart-time` and `bn-title` now parse and format dates in UTC, so a report renders the same in every time zone.

- A date without a time (`2024-05-20`) is midnight UTC and shows the same day as before.
- A value with an offset (`2024-01-31T23:30:00+01:00`) is converted to UTC and grouped by its UTC date. Before, it was grouped by the local date of the browser.
- A number is read as epoch milliseconds in UTC.
- `bucket` in the `getLayoutState()` table detail is now `2024-01-01T00:00:00.000Z` instead of a local offset such as `2024-01-01T00:00:00.000+01:00`.
- Not changed: the SQL date functions (`YEAR`, `MONTH`, `DAY`) in a `filter` or a dataset query still use the time zone of the browser. In New York `YEAR([date]) = 2024` leaves out `2024-01-01T00:00:00Z`. Compare the text instead: `[date] >= '2024-01-01'`.

#### Numbers follow the `bn-context` locale

Every number used to be printed in the German format (`1.234,5`, `5,20%`), whatever the locale was. Tables and charts now format numbers with `Intl.NumberFormat` for the locale of their `bn-context`: `locale="en"`, which is also the default when no locale is set, prints `1,234.5` and `5.20%`; `locale="de"` prints as before. A report that relied on German numbers without setting a locale has to set `<bn-context locale="de">`. A locale the browser does not know falls back to the German format. A space in front of the percent sign is removed in every locale. Percent labels inside stacked bars of `bn-chart-time` and `bn-chart-structure` use the same format (`45,0%` for `de`, before always `45.0%`).

#### `bn-table`: `order` applies to every column and to row groups

With several columns in `order`, `order-direction` was applied to the last column only (`order="rowGroup,category"` with `desc` sorted the groups ascending). It now applies to every column. Row groups followed `order` only for a `rowGroup` or `rowGroupIndex` entry; with any other order (the default `category`, a scenario) they came in the order of the data rows. They now follow the entries of `order` that exist per group: `rowGroup` and `rowGroupIndex` directly, a scenario such as `ac1` by the group sum. Without such an entry (for example the default `order="category"`) groups are sorted by `rowGroupIndex` ascending.

#### Relative variances divide by the absolute reference

A relative variance was computed as `(a - b) / b`. Against a negative reference the sign was flipped: -80 against -100 is better by 20 but was shown as `-20%`. Against a reference of 0 the result was `∞%`; in a table bar column with automatic scaling this collapsed all pins of the column, and `bn-chart-time` and `bn-chart-structure` drew a full pin labelled `+∞%`. `bn-table`, `bn-chart-time` and `bn-chart-structure` now compute `(a - b) / |b|` and show `n/a` without a bar or pin when the reference is 0. This includes 0 against 0, which was `-` in the table and nothing in the two charts. A reference whose sum is 0 only up to float rounding (for example 1234.56 - 1000.1 - 234.46) counts as 0 too. Missing data is shown as before. `bn-chart-bubble` and `bn-chart-scatter` use the same formula; a point with a reference of 0 is left out as before.

### Fixed

- `bn-table`, `bn-chart-time`, `bn-chart-structure`, `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`: with no rows, each component printed its no-data text as a bare paragraph in the top-left corner, styled differently per component (small italic in the structure chart) and repeated once per variance segment in the time and structure charts. All six now show one box that fills the component's space, with a thin dashed grey border and the text centered in muted grey. Layout state still reports `hasNoData`; the component rect now spans the cell.
- Tables and charts with no rows printed the no-data label with literal `==` markers (`==No Data==` / `==Keine Daten==`). The built-in label is now `No Data` (en) / `Keine Daten` (de). A `*.no-data` key set to `""` now hides the label instead of bringing the placeholder back.
- `bn-table`: a table that rendered taller than its layout cell was clipped without a trace - the bottom rows, grand total included, simply disappeared and no diagnostic mentioned it. The table now measures its rendered size against the constrained parent on every render and publishes a `WARN_overflow` item in `has-error` with the measured magnitude (an `error` when `scale` pins the size, a `warning` in auto mode). Scaling is unchanged: `scale` still fits the width only, so a height overflow is fixed by more space, fewer rows (`limit`) or a smaller `scale`.
- `bn-chart-time`: the measure-scale footer ("in kEUR") floated beside the base chart's SVG whenever the SVG was narrow enough to fit next to it, shifting the base chart right by the footer width while the variance segments stayed put. Base and variance bars were misaligned by exactly that width. The footer now always sits above the SVG.
- Chart wrappers: stale `AUTO_percentageScaling` warning was not cleared when a scaling group resolved.
- `bn-chart-structure` / `bn-chart-time`: an optional attribute that was simply not set produced a warning of its own - `level: invalid value(s) 'undefined' are not supported.` and the same for `order-direction`, `unit-scaling`, `percentage-scaling`, `date-interval` and `axis-labels-mode` - next to the correct `AUTO_<field>` notice for the very same blank value. On a report with many charts these drowned out the real warnings. An omitted field now yields only its documented `AUTO_<field>` notice; `ERR_<field>` is reserved for a value that was written and is wrong.
- SI prefix tables: removed a stray `"P"` (peta) from the negative-prefix table (femto range was shifted); `measure-scale` now accepts both `"my"` and `"μ"` for micro; magnitude→prefix picking is now `Math.log10`-based and handles exponential notation (`1e-7`, `1e24`) and boundary values correctly.
- `bn-dataset`, `bn-datasource`: changing `name` left the data under the old name. A static dataset kept its old table, a SQL dataset was never registered under the new name, and a `src` dataset moved only with the next poll. The old table or view is now dropped, its consumers are notified, and the data loads again under the new name. A SQL dataset whose source was renamed or removed now delivers no rows and sets `ERR_sql`, so a table behind it does not keep the old numbers.
- `bn-dataset`, `bn-datasource`: an element that was removed and attached again stayed empty, did not restart polling and kept writing to the `bn-context` it came from. It now loads again in the context it is attached to.
- `bn-datasource`, `bn-dataset`: `window.componentRegisterIsRenderedResult` became `true` while the first request for `src` was still running, so a PDF could be rendered with empty tables. The component now counts as rendering until that request has succeeded, failed or been cancelled. Polling requests (`interval`) do not hold the flag, and a poll tick that comes while the first request is still running is skipped instead of cancelling it. An element that is removed and attached again no longer counts as rendering forever.
- `bn-table` and all charts: a small negative value that rounds to zero was printed as `-0,0` or `-0,0%`. It is printed as `0,0` or `0,0%` now.
- `bn-table`: in a grouped table, rows with an empty `rowGroup` (`null`, `""` or missing) made the table repeat every row of every group under a header `null`, and the group sum printed `-`. These rows are now shown once, in one group labelled `-` whose sum is part of the total. A warning `WARN_blankRowGroup` is set in `has-error`. A numeric `rowGroup` had the same problem and is fixed too.
- `bn-table`: in a percent table (`data-format="percent"`) an absolute variance was printed as a plain decimal, so 3,10% against 5,20% showed `-0,0`. It is printed in percentage points with the percent digits now: `-2,10`. The measure scale is not applied to it. These cells have the class and the layout state type `percentpoint` now (before `decimal`).

### Security

- Sanitized HTML (`bn-text`, `bn-message`, title `business-unit`) was parsed in the live document, so an `<img onerror>` or `<audio onerror>` inside a disallowed element ran its handler before it was removed, and `<a href="java&#x09;script:...">` passed the URL check. The HTML is now parsed in a separate inert document and URLs are checked with the URL parser.
- `bn-text` evaluated `value` with `new Function`. The pattern check in front of it did not stop expressions such as `${t['constr'+'uctor']('...')()}`, so a template could run any JavaScript, and dataset values were joined into the markup unescaped. The evaluator is replaced by a placeholder parser and every resolved value is HTML-escaped.
- `bn-table` pasted row values (row group names) and free-text settings (`sum-title`, `thereof`, `partof`, `columnthereof` names, `lit(...)` attributes) into quoted SQL literals. A value with an apostrophe such as `Men's Wear` broke its query, and a crafted value could run as AlaSQL inline JavaScript. These values are now passed to AlaSQL as query parameters.
- Layout attributes were pasted into a stylesheet in the document head, so a value could close its rule and add rules for the host page (`width="10px;} body{display:none"`). Only the browser's own serialization of a value it accepted for that property is written now.
- `bn-dataset`, `bn-datasource`: the body is no longer read as a URL (see breaking changes).
- `SECURITY.md` describes the trust model (report content is code, row values are data), what a host must do, and the Content Security Policy the engine needs.
- New `npm run test:dist`: security checks against the built package in headless Chrome. CI runs it after the build.

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
