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

#### `datasets`, `selected-style`, `i18n-namespace` and `render-orientation` are declared properties

The components already read these attributes, but did not declare them. They were missing from the generated docs and from the TypeScript types, and setting the JS property did nothing. They are props now: `datasets` on the table, the charts and `bn-text`, `selectedStyle` on every styled component, `i18nNamespace` on every component with translated text, `renderOrientation` on `bn-context`. Each one reflects to its attribute, so markup does not change. Clearing `datasets` now empties the component, before it kept its last data.

#### `bn-ruleset`: `name` and `colorIndex` work in the table, the time chart, the structure chart and the title

A rule set could already reorder scenarios everywhere, but its `name` and `colorIndex` only had an effect in the scatter, bubble and bullet chart. They now work in `bn-table`, `bn-chart-time`, `bn-chart-structure` and `bn-title` too.

- `colorIndex` selects the style slot a scenario is drawn in: `10` the `ac` look (solid), `20` the `pp` look (light), `30` the `fc` look (hatched), `50` the `pl` look (outlined). The theme still decides how each slot looks. It applies to bars, markers, lines, the variance axis, the in-cell bars of a table and the line under a table column header. Any other value counts as `10`, now also for the target of a bullet chart.
- `name` labels the scenario: `"pl": { "name": "Budget" }` gives "Budget" for `pl1` and "Budget2" for `pl2`. It replaces the translated label `global.pl1`, in every language. Only a name that a `<bn-ruleset>` sets counts, the built-in names do not label anything.

Without a `<bn-ruleset>` nothing changes. A report that already sets `name` or `colorIndex` in a rule set now sees them in these four components.

```html
<bn-ruleset>{ "scenarios": { "pl": { "name": "Budget", "colorIndex": 30 } } }</bn-ruleset>
```

#### JSON Schemas for the JSON attributes and element contents

The npm package now has a JSON Schema (draft-07) for each of these documents, in `dist/schemas/`:

| File | Describes |
|------|-----------|
| `theme.schema.json` | content of `<bn-component-style>` |
| `ruleset.schema.json` | content of `<bn-ruleset>` |
| `i18n.schema.json` | content of `<bn-internationalization>` |
| `thereof.schema.json`, `partof.schema.json` | `thereof` and `partof` of `bn-table` |
| `stack.schema.json` | `stack` of `bn-chart-time` and `bn-chart-structure` |
| `axis.schema.json` | `x` and `y` of `bn-chart-scatter` and `bn-chart-bubble` |

Import one with `@bino-bi/bn-template-engine/schemas/theme.schema.json`. The schemas are generated from the types the components use, and a test checks that the built-in style, rule set and texts are valid against them.

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
<bn-dataset name="sales" refresh-interval="30" src="https://example.com/api/sales.json"></bn-dataset>
```

While `src` is set the body is ignored. The polling attribute `interval` is `refresh-interval` now, see below.

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

#### Stacked charts: negative segments stack on their own side of the axis

`bn-chart-time` and `bn-chart-structure` took the absolute value of every stack segment. A stack of 10, -4 and 6 was drawn as one bar of length 20 on the positive side and labelled `20`. Positive segments now stack outward from the axis on the positive side, negative segments on the other side, and the total label shows the signed sum (`12`). The label of a negative total sits at the end of the negative side. The category or date label sits opposite the total, behind the segments of that side. The stacked area of `chart-mode="line"` is laid out the same way.

- In the relative modes the share is still `value / sum of absolute values`: 10, -4 and 6 print `50%`, `-20%` and `30%`. A 100 % stack keeps its length and is split around the axis. The shares of a stack with negative segments do not add up to 100 %.
- `bn-chart-time` laid a stack out for its largest segment, so an absolute stack reached into the space above the chart. It is now laid out for the stack total. Existing absolute stacks change their height and their auto-fitted scale.
- A `bn-chart-structure` stack of only positive values is drawn as before.
- A scenario without a value in a row or period is no segment. A stack of AC and FC, where a period has only one of them, printed `NaN` for the other. It draws nothing for it now.

#### `bn-chart-scatter` / `bn-chart-bubble`: relative variance axes are in percent

An axis with a relative variance (`drac1_pp1`) printed its ticks as fractions (`0,20` for +20 %), and `min`, `max`, `refLine` and `highlight` had to be written as fractions. The ticks now print `20%`, and these four values are read in percent, as `bn-table` and `bn-chart-time` show the same measure. A relative variance as bubble `size` prints its value label in percent too.

**Migration**: on an axis with a `dr…` measure, multiply `min`, `max`, `refLine`, `highlight.from` and `highlight.to` by 100 (`"min":-0.4` becomes `"min":-40`). A `"unit":"%"` on such an axis can go, the ticks carry the percent sign.

#### `bn-chart-time`: `interval-span-limit` no longer cuts the series

The chart drew at most `interval-span-limit` (28) periods and dropped the rest, the newest first: three years of monthly data with `date-interval="month"` ended in April of the third year. The limit now only chooses the interval for `date-interval="auto"` (the finest interval that gives fewer periods than the limit). Every period between the first and the last date is drawn, so a chart with an explicit interval and more than 28 periods gets wider. `chart-mode="auto"` now sees the real number of periods and switches to a line above `max-bars`. A limit that is not a positive number counts as 28. When the interval is far finer than the data (more than 10000 periods between the first and the last date), only the periods with data are drawn and gaps are not filled.

#### Date titles keep their year, week labels use the ISO week year

- A date link in the modes `start`, `end`, `ytd`, `ytg` and `mat` prints one date. Its year was cut off when both dates are in the same year: the title for the end of July 2023 was `Jul.`. It is `Jul 2023.` now. Ranges (`interval`, `cum`, `avg`) print the year once, as before: `Jan..Jul 2023`.
- Week labels printed the ISO week number with the calendar year: Monday 2024-12-30 starts week 1 of 2025 and was `KW01 2024`, and 2021-01-03 was `KW53 2021`. They now use the ISO week year: `KW01 2025`, `KW53 2020`. The year separator of a line chart with weeks is at week 1.

#### `bn-chart-bullet`: a group with `+` and `-` rows shows the net value

A level value that holds `"+"` and `"-"` rows was summed as if every row were `"+"`: revenue 100 and cost 30 showed `130`. It now shows the net value `70`, for actual and target, and the rows are sorted and limited by this value. The text of `WARN_bullet_mixed_operation` says so. A level value with only `"-"` rows keeps its positive value.

#### Readiness: a component that threw makes the page "not rendered"

Stencil catches an exception of `render()`, of a lifecycle hook or of `connectedCallback` and goes on, so a component that threw counted as rendered and `window.componentRegisterIsRenderedResult` became `true` for a broken page. Now such a component has the status `ERROR`, and the flag is `false` as long as one is in the document. This also covers an element that sits outside of `bn-context`.

`window.componentRegisterFailures` lists the failed components as `{ tag, id, message }`. It is written together with the flag, and it is filled only when no component is running any more. A reader therefore sees one of three states:

- the flag is `true`: every component rendered
- the failures list is not empty: the page has settled, but a component failed
- neither: still working

The flag and the console line `componentRegisterIsRendered: <bool>` keep their name and format. **A reader that only waits for `true` never gets it for a page with a failed component. It must also check `window.componentRegisterFailures`.**

Also new: `bn-layout-page`, `bn-layout-card` and the inner renderers are tracked, a component that leaves the document is removed from the register, and the result waits for web fonts that are still loading.

A `has-error` item, also one of type `error`, is not a failed component. A page with an `ERR_sql` item still counts as rendered.

#### `has-error`: failures that were only logged are items now

- `bn-chart-time`, `bn-chart-structure`, `bn-chart-bullet`, `bn-chart-scatter`, `bn-chart-bubble`: a failing query on a registered dataset (for example a `filter` that AlaSQL cannot read) is an `ERR_sql` item of type `error`, and the chart renders nothing instead of "No Data". `bn-table` did this already, it now also covers a failing row count, measure-scale and interval query. A dataset that is not registered yet still means "no data".
- `bn-dataset`, `bn-datasource`: `ERR_body` when the body cannot be decoded or parsed or is not a JSON array, `ERR_src` when the request fails, **when the server answers with an HTTP error status**, or when the response is not a JSON array, `ERR_name` on every element when two of them produce the same name (also a dataset with the name of its datasource). When the name is no longer shared, the remaining element loads its data again, and a dataset on top of that name reads it again too. An empty body and the JSON value `null` mean "no rows" and are no error. A static `bn-dataset` with an empty body is now registered as a table without rows.
- `bn-internationalization`: `ERR_body` for a body that is not a JSON object.
- `bn-component-style`: `ERR_keys` (type `error`) lists the keys that are not part of the style. Checked are the section names, the keys of each section, and the keys of `scaleFactors` and `padding`. The theming guide named sections that were never read (`text`, `timeChart`, `structureChart`, `tree`, `grid`). The sections are the tag names: `bn-text`, `bn-chart-time`, `bn-chart-structure`, `bn-tree`, `bn-grid`. See [doc/theming.md](doc/theming.md).
- `show-measure-scale`, `show-overlay-avg` and `show-overlay-median` shared the id `ERR_grouped`. A valid value of one removed the item of another. These three attributes are booleans now and have no item any more, see below.

#### `bn-page`: true page sizes, `full-hd` works, `@page` rule

The page sizes come from one table now, which also feeds the validation of `format`.

- `format="full-hd"` was drawn as XGA: the stylesheet only knew the spelling `full_hd`. `full-hd` is 1920 x 1080 now. **`full_hd` is no format any more.**
- **Paper formats have their true size.** `a4` was 8.17 x 11.6 in and is 8.27 x 11.69 in, `a3` 11.69 x 16.54, `a2` 16.54 x 23.39, `a1` 23.39 x 33.11, `a0` 33.11 x 46.81. Reports in these formats reflow.
- `a6`, `a5`, `tabloid` and `ledger`, which only the stylesheet knew, are valid formats.
- An unknown `format` or `orientation` is also reported when it is there from the start, not only when it changes later.
- `bn-layout-page` reflects `pageFormat` and `pageOrientation` to its `page-format` and `page-orientation` attributes, so a format that is set as a property reaches the `@page` rule.
- The first `bn-context` of a document writes one `@page` rule with the size its first page is drawn in (turned or not, see below). The rule sets no margin. **A caller that prints with `preferCSSPageSize` now gets this size as the sheet**, for A4 8.27 x 11.69 in. A caller that passes a fixed paper size must pass the size of the format, otherwise Chrome fits the page into the sheet.

See [bn-page](src/components/bn-page/readme.md) for the sizes.

#### Page numbers: a number of the author is kept

`bn-context` overwrote the `page-number` of every page 250 ms after the load. It now numbers the pages right away, numbers pages that are added later, writes a number again that was removed, and leaves a `page-number` alone that it did not write itself. The pages still count by position: the page after `page-number="A-1"` on position 2 is page 3.

`bn-footer.pageNumber` is a string. A text label such as `A-1` was parsed as a number and printed as `NaN`.

#### `bn-layout-page`: a page is only turned when its orientation differs

A page whose orientation differs from the `render-orientation` of `bn-context` is turned onto the sheet. This happened only by accident of the late page-number write, and a page without `page-orientation` was turned whenever `render-orientation` was set, also an XGA page in a landscape document. Now the page is turned on the first render, and only when its orientation (its own, or the native one of its format) differs.

#### `bn-layout-page` / `bn-layout-card`: `1-over-3` uses the full width

The layout `1-over-3` got four column tracks instead of three, so its content took three quarters of the width. It has three columns now.

A `custom-template` without a quoted row threw in `render()` on the page. It is drawn as a single cell now and reported as `WARN_pageCustomTemplate` or `WARN_cardCustomTemplate`. The same item reports rows of different length, a pair of quotes without a cell and a row that cannot be read (a cell name may hold letters, digits, `_` and `.`). Rows can be written in double or in single quotes, the latter fit into a double-quoted attribute: `page-custom-template="'a a' 'b c'"`.

#### `bn-layout-card`: an inherited keyword stays on the host

A card with `title-scenarios="inherited-page"` (or another inherited title field, or `ruleset`) replaced the keyword in its own attribute with the value it had read at connect. It stopped following the page, and a component inside the card read the stale value. The card keeps the attribute as the author wrote it now. A component inside it that uses `inherited-closest` still gets the page value: such a card stands for the page, the cards between the two are not asked. When the page has no value, the card counts as not setting one, as before.

#### `bn-chart-bullet`: the `normalize` property is `normalizeMode`

The JS property `normalize` replaced `Node.normalize()` on the element, so a TypeScript project that checks library types could not compile against the package. The property is now `normalizeMode`. The HTML attribute stays `normalize`, markup does not change.

#### Removed: elements, props and layouts that nothing used

- `<bn-template>`: it only rendered its slot. Remove the tag, its children stay where they are.
- `<editor-companion>`: no page used it.
- `bn-footer`: the `code` attribute and the sample barcode images it could show.
- `bn-layout-page` / `bn-layout-card`: the layouts `gold3` and `gold4`. They were never documented. A page that names one now gets a single cell, like any unknown layout name.
- `bn-layout-page` / `bn-layout-card`: the method `getNumberOfSlot()`.

#### The inner renderer elements are internal and have new names

Each table, chart and title element draws through an inner element in its shadow root. These were named `ibcs-*`. They are now `bn-*-renderer` (`ibcs-table` is `bn-table-renderer`, `ibcs-chart-time` is `bn-chart-time-renderer`, and so on, `ibcs-title` is `bn-title-renderer`). Their props and methods are marked internal and are no longer part of the published JSX types.

Only the `bn-*` elements listed in the README are public API. A page that selected an inner element by tag must select the public element.

`window.componentRegisterFailures[].tag` names the element that threw. For a failure inside a renderer this is now the new tag.

The setter methods `setProps()` and `setBusinessUnit()` of the inner title element are gone.

#### `namespace` is no longer read as `i18n-namespace`

A component took a plain `namespace` attribute as a fallback for `i18n-namespace`. This alias is gone, write `i18n-namespace`. The `namespace` attribute of `<bn-internationalization>` is something else and stays.

#### Boolean attributes are real booleans everywhere

These props were strings that had to be `"true"` or `"false"`. They are booleans now, like the boolean props of the other components:

- `bn-table`: `grouped`, `show-measure-scale`, `show-group-title`
- `bn-chart-time`: `line-full-width`, `show-categories`, `show-measure-scale`, `show-overlay-avg`, `show-overlay-median`
- `bn-chart-structure`: `show-categories`, `show-measure-scale`
- `bn-grid`: `show-row-headers`, `show-column-headers`, `show-borders`
- `bn-tree`: `show-operators`

`attr="true"` and `attr="false"` work as before, and the defaults are the same. What changes:

- An attribute without a value, or with any text other than `false`, is true. Before, such a value counted as false and gave a warning.
- The warnings `ERR_grouped`, `ERR_showMeasureScale`, `ERR_showGroupTitle`, `ERR_lineFullWidth`, `ERR_showCategories`, `ERR_showOverlayAvg`, `ERR_showOverlayMedian`, `ERR_showRowHeaders`, `ERR_showColumnHeaders`, `ERR_showBorders` and `ERR_showOperators` no longer exist.
- Removing the attribute at runtime sets the prop to false, also when its default is true. Write `attr="true"` to switch it on again.
- In JS the property is a boolean: `table.grouped = true`.

#### `bn-dataset` / `bn-datasource`: `interval` is `refresh-interval`

`interval` meant the polling time in seconds here and the column bucketing on `bn-table`. The polling attribute is now `refresh-interval` (property `refreshInterval`). `interval` on `bn-table` is unchanged.

```html
<bn-dataset name="live" src="/api/sales.json" refresh-interval="30"></bn-dataset>
```

#### `bn-chart-time`: `level`, `order`, `order-direction` and `limit` are removed

A time chart always shows one value per period, in date order. These four attributes were validated and gave `ERR_*` and `AUTO_*` items, but had no effect on the chart. They are removed together with their items (`ERR_level`, `ERR_order`, `ERR_orderDirection`, `ERR_limit`, `AUTO_level`, `AUTO_order`, `WARN_inherited_order`, `WARN_inherited_orderDirection` on this element). Markup that still has the attributes renders as before.

#### `has-error`: the id prefix tells the type, many ids are renamed

Most attribute checks reported a warning under an id that began with `ERR_`, and three ids had no prefix at all. Now the prefix and the `type` of an item always agree: `ERR_` is an error, `WARN_` and `AUTO_` are warnings. The severity of an item did not change, only its id. The other ids in this file use the new names.

- **`ERR_<name>` is `WARN_<name>`** for every item of type `warning`: `aspect`, `attributes`, `axisLabelsMode`, `barColumns`, `barColumnWidth`, `cardCustomTemplate`, `categoryWidth`, `chartMode`, `compareWith`, `dataFormat`, `dataFormatDigitsDecimal`, `dataFormatDigitsPercent`, `dateEnd`, `dateFormat`, `dateInterval`, `dateLink`, `dateStart`, `direction`, `edgeStyle`, `empty_name`, `format`, `interval`, `intervalConflict`, `intervalNoDate`, `intervalSetname`, `invalid_value`, `level`, `levelSpacing`, `limit`, `maxBars`, `measures`, `measureScale`, `measureType`, `nodeSpacing`, `normalize`, `numeric_name`, `order`, `orderDirection`, `orientation`, `pageCustomTemplate`, `partof`, `percentageScaling`, `reserved_name`, `scale`, `scenarios`, `seriesLevel`, `stack`, `syncSpaceLeft`, `thereof`, `type`, `unitScaling`, `variances`.
- `ERR_categorythereof` is `WARN_columnthereof`, after the attribute it checks.
- `WARN_overflow` with type `error` (content does not fit although the author fixed the size) is `ERR_overflow`. The warning keeps the id `WARN_overflow`.
- `JSON_PARSE` on `bn-component-style` and `bn-ruleset` is `ERR_body`, as on the data elements.
- `no_value` on `bn-text` is `WARN_value`.
- `WARN_use_dataset` is `WARN_datasets`.
- `LAYOUT_cellPairing_<section>_<row>` in the `diagnostics` of the layout state of a table is `WARN_layout_cell_pairing_<section>_<row>`.
- The data warnings of scatter, bubble and bullet use underscores only: `WARN_xy-duplicate-point` is `WARN_xy_duplicate_point`, and the same for the other `WARN_xy-*`, `WARN_bubble-*` and `WARN_bullet-*` ids.

The ids that stay as they were: all `AUTO_*` ids, all ids of type `error` (`ERR_sql`, `ERR_filter`, `ERR_body`, `ERR_src`, `ERR_name`, `ERR_keys`, `ERR_edges`, `ERR_rowHeaders`, `ERR_columnHeaders`, `ERR_xy_*`, `ERR_bullet_*`) and the other `WARN_*` ids.

[doc/integration-contract.md](doc/integration-contract.md) lists every id and states what stays stable in 1.x: the readiness values on `window`, the console line, `getLayoutState()` and the `has-error` items.

#### Translation keys: `bn-title.SEPARATOR_WS` and `bn-table.thereof`

Two built-in keys were misspelled: `bn-title.SEPERATOR_WS` is now `bn-title.SEPARATOR_WS`, and `bn-table.there_of` is now `bn-table.thereof`. The old names keep working: a `<bn-internationalization>` body that uses one is read under the new name, and `t('bn-table.there_of')` in a `bn-text` template still finds the text. Rename the keys in your translations, the old names end with 2.0.

#### Theme: every `scaleFactors` value is a multiple of the font size

Four line widths in `scaleFactors` were pixels, next to values that are multiples of the font size. They are multiples now, like the rest. The defaults give the same pixels at the default font size:

| Section | Key | Before (px) | Now (× font size) |
|---------|-----|-------------|-------------------|
| `bn-chart-bullet` | `targetLineWidth` | `2` | `0.15` |
| `bn-chart-bullet` | `axisLineWidth` | `1` | `0.075` |
| `bn-chart-scatter`, `bn-chart-bubble` | `refLineWidth` | `1` | `0.075` |
| `bn-chart-scatter`, `bn-chart-bubble` | `gridLineWidth` | `1` | `0.075` |

These lines now get thinner and thicker with `scale` and with the font size, like the lines of the time and structure chart. A theme that sets one of the four keys must divide its value by the font size (13.3333 by default). [doc/theming.md](doc/theming.md) has a table with the unit of every key.

#### npm package: entry points

- The package has an `exports` map with `.`, `./loader`, `./schemas/<name>.schema.json` and `./package.json`. Node and bundlers no longer resolve other paths inside the package, for example `@bino-bi/bn-template-engine/dist/...`. URLs on a CDN are not affected.
- `types` points at `dist/types/index.d.ts`. `import { LAYOUT_STATE_VERSION, type LayoutState } from "@bino-bi/bn-template-engine"` type-checks now. Before, the type entry had the elements but not the layout state.
- The fields `es2015` and `es2017` are gone. They named a file that was never built.
- A TypeScript project with `skipLibCheck: false` compiles against the package: the type declarations no longer use the typings of alasql, `@types/luxon` is a dependency, and the type entry has no import of a style sheet.
- Spec helpers are no longer built into `dist`.
- `dist/components` (one module per element) is not an entry point. Its modules register the elements, but the elements do not render, and they never did. They no longer import `@stencil/core`. Use the loader.

[doc/installation.md](doc/installation.md) lists the entry points.

### Deprecated

These still work in all 1.x versions and are removed in 2.0:

- `title-namespace` on `bn-layout-page` and `bn-layout-card`. Use `i18n-namespace`, which also applies to the content of the page or card.
- The `asset:` prefix in `source` of `bn-image`, `image` of `bn-message`, `message-image` of `bn-layout-page` and `title-image` of `bn-layout-card`. Write the plain asset name: `source="logo"` instead of `source="asset:logo"`.
- The `fillpattern` value `fc` in a theme. Write `hatched`. The built-in theme uses `hatched` now.
- The translation keys `bn-title.SEPERATOR_WS` and `bn-table.there_of`, see above.

### Fixed

- Docs: the examples of `thereof`, `partof` and `columnthereof` on `bn-table` were not valid JSON, and the one of `partof` used the key `rowGroups` instead of `rowGroup`. The `stack` docs of `bn-chart-time` and `bn-chart-structure` listed `by` values that are not accepted. They name `scenarios` and `dimensions` now.
- `bn-chart-time`: a chart without rows threw in its auto-fit, because the average overlay (on by default) reads the first and the last period. The chart showed "No Data" anyway, the exception was only logged.
- `bn-table`, `bn-title`: invalid JSON in `thereof`, `partof`, `columnthereof` or `measures` threw in `render()`. The validators report the value, and the component now renders without it.
- `bn-text`: the auto-fit measured once, also when a web font was still loading. It measures again when fonts have loaded.
- `bn-chart-time`: the distance between a label and its column was fixed to `0.3` in the component. It is read from `scaleFactors.labelToColumn` of the theme.
- Spec runs: the 500 ms timer of the status register fired after a spec file had ended ("Cannot log after tests are done"), which made small runs exit with 1.
- `bn-table`, `bn-chart-time`, `bn-chart-structure`, `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`: with no rows, each component printed its no-data text as a bare paragraph in the top-left corner, styled differently per component (small italic in the structure chart) and repeated once per variance segment in the time and structure charts. All six now show one box that fills the component's space, with a thin dashed grey border and the text centered in muted grey. Layout state still reports `hasNoData`; the component rect now spans the cell.
- Tables and charts with no rows printed the no-data label with literal `==` markers (`==No Data==` / `==Keine Daten==`). The built-in label is now `No Data` (en) / `Keine Daten` (de). A `*.no-data` key set to `""` now hides the label instead of bringing the placeholder back.
- `bn-table`: a table that rendered taller than its layout cell was clipped without a trace - the bottom rows, grand total included, simply disappeared and no diagnostic mentioned it. The table now measures its rendered size against the constrained parent on every render and publishes an item in `has-error` with the measured magnitude (the error `ERR_overflow` when `scale` pins the size, the warning `WARN_overflow` in auto mode). Scaling is unchanged: `scale` still fits the width only, so a height overflow is fixed by more space, fewer rows (`limit`) or a smaller `scale`.
- `bn-chart-time`: the measure-scale footer ("in kEUR") floated beside the base chart's SVG whenever the SVG was narrow enough to fit next to it, shifting the base chart right by the footer width while the variance segments stayed put. Base and variance bars were misaligned by exactly that width. The footer now always sits above the SVG.
- Chart wrappers: stale `AUTO_percentageScaling` warning was not cleared when a scaling group resolved.
- `bn-chart-structure` / `bn-chart-time`: an optional attribute that was simply not set produced a warning of its own - `level: invalid value(s) 'undefined' are not supported.` and the same for `order-direction`, `unit-scaling`, `percentage-scaling`, `date-interval` and `axis-labels-mode` - next to the correct `AUTO_<field>` notice for the very same blank value. On a report with many charts these drowned out the real warnings. An omitted field now yields only its documented `AUTO_<field>` notice; `WARN_<field>` is reserved for a value that was written and is wrong.
- SI prefix tables: removed a stray `"P"` (peta) from the negative-prefix table (femto range was shifted); `measure-scale` now accepts both `"my"` and `"μ"` for micro; magnitude→prefix picking is now `Math.log10`-based and handles exponential notation (`1e-7`, `1e24`) and boundary values correctly.
- `bn-dataset`, `bn-datasource`: changing `name` left the data under the old name. A static dataset kept its old table, a SQL dataset was never registered under the new name, and a `src` dataset moved only with the next poll. The old table or view is now dropped, its consumers are notified, and the data loads again under the new name. A SQL dataset whose source was renamed or removed now delivers no rows and sets `ERR_sql`, so a table behind it does not keep the old numbers.
- `bn-dataset`, `bn-datasource`: an element that was removed and attached again stayed empty, did not restart polling and kept writing to the `bn-context` it came from. It now loads again in the context it is attached to.
- `bn-datasource`, `bn-dataset`: `window.componentRegisterIsRenderedResult` became `true` while the first request for `src` was still running, so a PDF could be rendered with empty tables. The component now counts as rendering until that request has succeeded, failed or been cancelled. Polling requests (`interval`) do not hold the flag, and a poll tick that comes while the first request is still running is skipped instead of cancelling it. An element that is removed and attached again no longer counts as rendering forever.
- `bn-table` and all charts: a small negative value that rounds to zero was printed as `-0,0` or `-0,0%`. It is printed as `0,0` or `0,0%` now.
- `bn-table`: in a grouped table, rows with an empty `rowGroup` (`null`, `""` or missing) made the table repeat every row of every group under a header `null`, and the group sum printed `-`. These rows are now shown once, in one group labelled `-` whose sum is part of the total. A warning `WARN_blankRowGroup` is set in `has-error`. A numeric `rowGroup` had the same problem and is fixed too.
- `bn-table`: in a percent table (`data-format="percent"`) an absolute variance was printed as a plain decimal, so 3,10% against 5,20% showed `-0,0`. It is printed in percentage points with the percent digits now: `-2,10`. The measure scale is not applied to it. These cells have the class and the layout state type `percentpoint` now (before `decimal`).
- `bn-table`: with `interval` and `limit`, the REST row showed half the value for two relative variances that share one reference (for example `drac1_pp1_pos` and `drfc1_pp1_pos`), because the reference was summed twice. An actual of 90 and a forecast of 75 against a reference of 100 printed `-5.00%` and `-12.50%`, now `-10.00%` and `-25.00%`.
- `bn-table`: FC bars in a bar column and FC waterfall bars were white on white, because the default style value `fillpattern: "fc"` was not understood. `fillpattern` now takes `solid`, `hatched` or `outlined` in the table, in `bn-chart-time` and in `bn-chart-structure`. `fc` still works and means `hatched`; any other value counts as not set. In the charts an `outlined` style is now drawn without fill (transparent); before, the charts ignored it.
- `bn-table`: total rows were counted into the scale of a bar column although they draw no bar, so with auto scaling every bar was shorter than it could be (rows 10 and 20 with a total of 30: the 20 bar had two thirds of the possible length).
- `bn-table`: with auto scaling the largest bar of a narrow bar column could be drawn with a zigzag break and a stub although it is not off the scale (rows +10, +20 and -5 at the default width: the +20 bar filled the whole 31.67 px bar area). It is drawn as one bar of 22.92 px now, twice the +10 bar.
- `bn-table`: value labels in bar columns ignored the locale and the percent digits. They always used `.` as the decimal separator (`+1.2K` in a German report), showed relative variances as whole percents (`+13%` for 12,5%) and could print `-0`. Labels now use the decimal separator of the locale (`+1,2K`), relative variances use `data-format-digits-percent` (`+12,5%`), and an absolute variance of a percent table is labelled in percentage points. A relative label that is too long for the label gutter drops digits (`+123,5%` for 123,46%), and a value that rounds to 1000 takes the next unit (`+1M`, before `+1000K`).
- `bn-table`: in a table without grouping, the first thereof row of every drill got its row group appended (`thereof Retail (Europe)`), and an empty row group was printed as `(null)`. The row group is now added only when the same name appears twice under the same parent, and never when it is empty. A thereof row whose name also exists in another row group could show the values of that other row: in the `interval` columns of a grouped table (2 instead of 7) and in the `columnthereof` columns of a table without grouping (11 instead of 3). These rows now show the values of their own row group.
- `bn-chart-structure`, `bn-chart-bullet`: with several columns in `order`, `order-direction` was applied to the last column only (`order="ac1,category"` with `desc` sorted `ac1` ascending). It applies to every column now, as in `bn-table`.
- `inherited-closest` on `scenarios`, `variances`, `order` and `order-direction` (`bn-table`, `bn-chart-time`, `bn-chart-structure`) and on `ruleset` (all components that take a rule set): the lookup stopped at the first `bn-layout-card` or `bn-layout-page` above the component, also when that card did not set the value. A table in a plain card never got the value of the page. The value now comes from the nearest card or page that sets it. A card whose own attribute is an unresolved `inherited-*` keyword counts as not setting it, so the keyword is never handed down as a value. A component that used `inherited-closest` for one prop and `inherited-page` for another read both from the same ancestor; each prop has its own lookup now. A value that a card or the page gets later is picked up from every ancestor on the way up, not only from the first one.
- `bn-table`, `bn-chart-time`, `bn-chart-structure`: an `inherited-closest` / `inherited-page` keyword that no card or page could satisfy was used as a literal value. `scenarios="inherited-page"` under a page without `title-scenarios` rendered a scenario named `inherited-page`, and the same for `order` gave an undefined sort column, both without a warning. The component now behaves as if the attribute was not set (scenarios auto-detected from the dataset, no variances, default order and direction) and sets a `WARN_inherited_<prop>` warning in `has-error`, for example `scenarios: 'inherited-page' could not be resolved, no surrounding page sets titleScenarios`. This warning replaces the `AUTO_<prop>` notice of that attribute and goes away when the keyword resolves. An attribute that is changed to a keyword after the component was attached is looked up as well.
- `bn-layout-card`: a `title-scenarios`, `title-variances`, `title-order`, `title-order-direction` or `ruleset` keyword that the card could not resolve was handed to the card title as a literal value. The title gets a blank value now. The card itself sets no warning.
- `bn-chart-time`: `date-interval="auto"` fell back to `day` for ISO date strings, and the series was then cut after 28 periods: three years of monthly data showed their first 28 days. The interval is now taken from the first and the last date of the filtered rows, so this series is shown as 12 quarters.
- `bn-chart-time`: the average line (on by default) and the median line counted a period without a value as 0. With actuals of 100 for eight months and forecast for four, the average was `66,7` instead of `100`, and the median could be empty. Both use only the periods that have a value. A chart without any value for the scenario draws no line (before: a line at 0).
- `bn-chart-time`: a variance over a scenario that is not in `scenarios` (`variances="dac1_pl1_pos"` with `scenarios="ac1,pp1"`) drew an empty variance segment without a hint. The warning `WARN_variances_scenario` now names the variance and the missing scenario.
- `bn-chart-structure`: with `limit`, the REST row summed only the first `limit` rows of the remainder (rows 100, 50 and 20 with `limit="1"` gave a REST of `50` instead of `70`), and a REST row with `0` was added when the limit cut nothing. A row without a value no longer empties the whole REST value.
- `bn-chart-structure`: `stackColors` of the component style was ignored, stacks always used the built-in colours.
- `bn-chart-structure`, `bn-chart-time`, `bn-chart-bubble`: the label inside a stack segment or a bubble was white on any fill that is not written as six digit hex, also on `#fff` or `rgb(255, 255, 255)`. Hex colours with 3, 4, 6 and 8 digits and `rgb()` / `rgba()` are read now. A colour that cannot be read gets black text.
- `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`: axis ticks had at most two decimals, taken from the text of a float, so ticks repeated (`0,02 | 0,03 | 0,03 | 0,04`) or got needless decimals (`0,60` for a step of 0,2). Decimals now come from the tick step. For a domain narrower than the float resolution of its values the chart did not finish rendering. It gets one tick now.
- `bn-chart-scatter`: iso lines were labelled without decimals (`1` for 0,5, `3` for 2,5). The labels have the decimals of the finest value, and the space next to the frame fits them.
- `bn-chart-bubble`: value labels always had one decimal (`0,0` for 0,032). They show three significant digits of the largest value: `32,0`, `0,0320`, `1.234.567`.
- `bn-chart-scatter`, `bn-chart-bubble`: two points with the same name in different series counted as one, the second was dropped with `WARN_xy_duplicate_point`. The series is part of the point identity now.
- `bn-chart-bubble`: the legend swatch of a forecast series was a white circle, the same as plan. It has the hatch pattern of the bubbles now.
- `bn-chart-scatter`, `bn-chart-bubble`: a chart higher than its layout cell was cut off without a diagnostic, only the width was checked. `WARN_overflow` is now also set when a container that hides its overflow cuts the chart off at the bottom. It names the measured sizes and works with automatic scaling too. A page that just grows or scrolls gives no warning.
- `bn-chart-bullet`: a negative actual value has no bar. With `normalize="target"` this was reported as `WARN_bullet_target_invalid` (a text about the target), with `normalize="none"` not at all. Both modes set `WARN_bullet_actual_negative` now.
- `bn-tree`: edges with a cycle below the root crashed the component. They are reported under `ERR_edges`, as are nodes that are not connected to the root.
- `bn-tree`: the operators between three or more siblings were drawn on one spot, and for `rtl` and `btt` they sat off the edges. Each operator now sits between its two siblings on the line that joins the children. All edges of a parent bend at the same place. In `ttb` and `btt` a parent sits centred over its children (before: over the first child). Parents that share a child keep the column of their first child.
- `bn-tree`: a tree that was invalid when it loaded drew no edges after `edges` was corrected, and a change of `direction`, `level-spacing` or `node-spacing` kept the old edge positions. The tree measures after every render now.
- `bn-tree`: a tree that is wider than its container, or cut off at the bottom by a container that hides its overflow, gave no diagnostic. It sets `WARN_overflow` now.

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
