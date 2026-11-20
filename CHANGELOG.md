# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

- `bn-chart-scatter`, `bn-chart-bubble`: `titlePosition` in `x` and `y`. With `beside` the title stands in two lines beside the end of its axis, the name and below it the unit: left of the top of the y axis, right of the end of the x axis. The default `outside` is the place of before.
- `bn-chart-scatter`, `bn-chart-bubble`: `align` in `legend` moves the legend along its side: `start` (default), `center` or `end`.
- `bn-annotation-layer`: a `frame` around two data points whose ellipse has no room in the layer is drawn as a frame with round ends close around both. Before, the ellipse was cut to the layer and could cross its data points.
- `bn-chart-scatter`: iso-lines are drawn on axes that start at 0. Before, both axes had to start above 0. An axis below 0 still gives no lines and `WARN_xy_iso_domain`.
- `bn-chart-scatter`: `factor` in `iso` brings the product to the unit of the lines: a line with the value `v` runs where `x·y·factor = v`, and `highlight.from` and the automatic values are in that unit too. For example `0.01` for a margin in percent, `0.001` for millions from units and thousands.
- `bn-chart-scatter`, `bn-chart-bubble`: `step` in `x` and `y` sets the distance between two ticks. A step that gives more than 50 ticks is not used, the chart then picks one as before.
- `bn-chart-scatter`, `bn-chart-bubble`: an entry of `labels.points` can be `{"name":"VAB","side":"n"}`. The label then stands on that side of its mark (`n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`), also outside the plot or on another mark, and the other labels stay clear of it.
- `bn-chart-scatter`, `bn-chart-bubble`: `markStyles` in the component style sets the line around a filled point or bubble (`stroke`, default `#ffffff`) and the opacity of its fill (`opacity`, default `1`). Outlined and hatched marks keep their look. The legend follows, and the value in a bubble takes its colour from the fill as it is seen.
- `bn-annotation-layer`: a `frame` with `to` or `toPoint` is one oval around both data points: the ellipse through the corners of their common box. Both ends must be data points, and a `text` of the item is not drawn. Before, a frame did not read `to`.

- `bn-chart-time`: a stacked area with `"by":"dimensions"` (`chart-mode="line"`) draws one layer per series, in the colours of `stackColors`. Each layer prints its value in its middle at each period, the total is a line with a marker and a value on top, and the names of the series stand next to the first or the last period, as `legend` says. A label that would lie on another one is left out, so a chart with many periods needs a smaller `scale` to print all of them. The labels of the first and the last period have the box of a plain label, as half of them lies beside the area. A period where no series has a value has no total, and the area ends at the first and the last period with a value. A 100 % stack has no total line, and its labels are percent values. Before, such a chart drew one area with the sum of the series. A dataset without categories stays one area.
- `bn-chart-time`: `period-lines` draws a thin line at every n-th period of a stacked area, from the axis to the top of the stack. With it the dashed line at the change of the year is not drawn.
- `bn-chart-time`: `point-position="end"` puts the points of a stacked area on the right border of their period, for values at the end of a period.
- `bn-chart-time`: `axis-labels-mode="two-row"` and `axis-labels-step` work in line mode. With a step, the dashed line at the change of the year stays, and in smart mode the label that carries the year.

- `bn-chart-structure`: `order-mark` also marks an order by a dimension, with the arrow above the names, and it works in a chart with a bridge: for the variance of the walk the arrow stands beside the first step, for a scenario behind the bars of the first row.
- `bn-chart-structure`: in a chart with a bridge the axis of the bars ends at the total row, and the axis of another variance has a piece of its own at the total: no axis runs through the room of the variance of the total. The line from the reference total is black along the rows. The variance of the total has a regular label and a bar of half the bar width (before: bold, a quarter).
- `bn-chart-structure`: `row-lines` draws a thin line after every n-th row, over all segments of the chart (`row-lines="5"`). The count starts again behind a sum row, and a sum row keeps its own line. A list draws a line after each of these rows, counted from the first row, for blocks of different sizes (`row-lines="4,9,14"`).
- `bn-chart-structure`: `order-mark` marks the column the rows are sorted by with an arrow: beside the name of the scenario, or beside the title of the variance, that comes first in `order`. None with `stack`.
- `bn-chart-time`: `scenarios` in `totals` names scenarios that are drawn at a total only, not in the periods, for example `{"by":"all","scenarios":["pp1"]}`. The chart adds them up from its dataset over the periods the total counts. A scenario with a gap in these periods has no value, like a reference, and a scenario of the chart itself is ignored. With `dataset` every scenario column of a row that the chart does not draw is such a scenario, and the list limits them. In a bridge it is one more total column before the reference total, with its value and its name, and its variance to the total of the series is a thin bar right of the variance of the total. Without a bridge it is a column behind the total column, and with `by: all` its variance stands right of the total column. Four at most.
- `bn-chart-structure`: `sum-scenarios` names scenarios that are shown at the total row only (`sum-scenarios="pl1"`), added up from the dataset. `sum-dataset` names a dataset with the values of the total row: the chart then adds up no total, and every scenario column that the chart does not draw is shown at the total only. In a bridge such a scenario is a bar above the reference total, and its variance to the total of the series is a thin bar below the variance of the total. Else its number stands in the total row with the others. A bridge needs a positive total for each of them. Not with `stack`: the chart warns.
- `bn-chart-structure`: `variance-waterfall` draws each absolute variance as a walk down the rows: a bar starts where the bar of the row before ended, thin lines join the bars, and a row without a value keeps the level. A sum row is a bar from the axis, and the rows after the sum row of a group start again. Relative variances stay pins. A walk has no break marks. With `sums="total"` and a fixed `unit-scaling` the first absolute variance is a bridge in the base chart: the reference total is a bar above the first row with a bold value and the name of its scenario, the total of the series is a bar in the total row, both at the scale of the rows, the walk runs from the end of the one to the end of the other, and the variance of the total is a thin bar below the total row. The bars then carry no scenario names, and the segment of the variance is not drawn. The chart draws the walk in its own segment and warns when the bridge is not possible: `sums` is not `total`, the chart has more than the series and its reference, the reference is not the second scenario, a total is missing or not positive, the reference total plus the variances is not the total of the series, or the walk would cross the bars of the rows. No effect with `stack`.
- `bn-chart-structure`: `order` takes a variance like `dac1_pp1` or `drac1_pp1`, with or without a sentiment. Its scenarios need not be in `scenarios`. A variance sorts before the other columns of the list, and a row without a value comes last.
- `bn-chart-structure`: `data-format-percent-sign="false"` prints the labels of relative variances without the percent sign (`+22`).
- `bn-chart-structure`: the elements of a sum row have `row` in their point key: `total` for the row over all rows, `subtotal` for the row of a group. So an annotation can point at the total without its title.
- `bn-chart-time`: `variance-waterfall` draws each row of absolute variances as a walk: a column starts where the column before ended, thin lines join the columns, and a period without a value keeps the level. Relative variances stay pins. A walk has no break marks. With `totals` of `by: all`, aggregation `sum` and the scale of the chart, the first row of absolute variances is a bridge in the base chart: the reference total stands before the first period with its value and its name, the total of the series behind the last one, the walk runs from the end of the one to the end of the other, and the variance of the total is a thin bar between the two levels right of the total column. The row itself is not drawn then. The chart draws the walk in its own row and warns when the bridge is not possible: the totals have another scale, `by` or `aggregation` differ, the total has no reference, the reference total plus the variances is not the total of the series, the variances are not the series against the reference of the total, `sync-space-left` is set, or the walk would cross the columns of the periods. Behind a total column on the axis (`by` other than `all`) a walk starts again. Bar mode, plain columns.
- `bn-chart-time`: `unitScaling` in `totals` is optional. Left out, the total columns use the scale of the chart.
- `bn-chart-time`: `reference-column` with `scenario-switch` draws the reference (the first scenario that is not part of the series) as a column behind the series in every period, in place of the marker. Further scenarios stay markers. The default is the marker.
- `bn-chart-time`: `totals` adds total columns at their own scale: `{"by":"all","aggregation":"sum","unitScaling":280,"label":"2025","width":1.6}`. `by` says what a total covers: `all` is one column right of the last period for all periods, with its own axis; `year`, `quarter`, `month` or `week` put one column behind the periods of each of them on the axis, and the periods after it move on. `aggregation` is `sum`, `average` or `last`. With `sum` a column stacks one part per scenario of the series (with `scenario-switch` the first scenario and the ones that follow it, each in its look), with the value of each part and the total above. Else it is one column, hatched when a forecast is in its value and outlined for a plan. `dataset` names a dataset with one row per total (`date` and the scenario columns): the chart then takes the values from it. The first other scenario is the reference behind a column. Each variance row gets the variance of each total, at the scale of the row, so the tiers of a total line up with the tiers of the periods. With `scaling-indicator` a column has its own band, and with `by: all` a line links it to the band of the periods and the names of the parts stand at the right. The elements of a column have `row: "total"` in their point key, and with `by` other than `all` the start of their period as `date`. Plain columns only: not with `stack` and not in line mode. The chart needs a fixed `unit-scaling`, and every part of a total must be positive: else there are no total columns. A total, its reference and its variance count the same periods: the ones where the series has a value, with `last` the last of them. A reference that misses a value in one of them is no reference for that total, and the total has no variance then. A group without a value of the series has no total, and a `by` that is not coarser than the periods of the chart gives none. A chart with `scenarios="none"` draws no totals. This replaces `total-column` of v1.0.0-next.61.
- `bn-chart-time`: `scaling-indicator` draws a light band behind the columns from the axis up to a value, and prints the value at its right end. Two charts with different scales that show the same value make the difference visible. Bar mode only, not in a 100 % stack.
- `bn-chart-time`: `data-format-percent-sign="false"` prints the labels of relative variances without the percent sign (`+11.6`).
- `bn-chart-time`: a stack by dimensions with `scenario-switch` can mix scenarios in one period. A series without a value in the scenario of the period takes the scenario that has its value, for example a forecast part on top of an actual part, in the look of that scenario with `"notation":"scenario"`. A scenario that has values for the same series as the visible one is the reference: it is drawn as a column behind the stack, from the total of its period. Before, such scenarios were not drawn and the chart warned. A 100 % stack has no reference.
- `bn-chart-time`: with `scenario-switch`, the variances of a forecast are hatched in the colour of the variance, and the head of a forecast pin is hatched. A single variance takes the notation of its scenario too, not only variances that share a row.
- `bn-chart-structure`: `value-suffix` prints a text right after every value label, for example `%` when each row shows the unit. Variance labels do not get it.
- Component style `bn-annotation`: `markerStyle: "outlined"` draws the numbered circles of `bn-annotation-layer` and `bn-annotation-list` as a white circle with a ring and a number in the colour. The default `"filled"` is the look so far.
- Component style `bn-chart-structure`: `titleBold: true` prints the title above the axis in bold: the chart title, and the name of the variance in a variance chart.
- `bn-annotation-layer`: `textPosition: "above"` on a `frame` item puts its text above the value label and not right of it.
- `bn-chart-structure`: `sums` adds sum rows. `groups` adds a row below the rows of each `rowGroup` (level `category`) and keeps the rows of a group together, `total` adds a row over all rows, `all` does both. `sum-title` names the row over all rows. A sum row is bold with a line above it and has no bar, so it does not count for the scale: a chart with plain bars prints the number, or with several scenarios one number per scenario with a small square in its look, a stack prints one number per series with a small square in the colour of the series and then the total, and a 100 % stack draws a bar of shares. In a variance chart the sum row is a bar like the others, with a bold number. When a sum row follows the last bar of a chart with plain bars, the name of the scenario stands right below that bar, beside the axis, and the chart leaves one row of room for it. The total of a sum row has the name of the row as `category` in its point key.
- `bn-chart-structure`: new `stack` keys. `"percentMark":true` prints the shares of a 100 % stack as plain numbers and draws one `100%` mark at the end of the bars. `"labels":"value"` prints the value of each segment of a 100 % stack and the total of the bar. `"thickness":"total"` makes a bar as thick as the total of its row is large, with the same chart height. A row is at least one line of text high. It is not used together with variances: the rows then keep one height and the chart warns. `"totalTitle"` puts a name above the totals.
- `bn-chart-structure`: `reference-line` draws a line across the bars at one value, with an optional label. In a 100 % stack the value is a percent. The line ends at the last row from the top that reaches it.
- `bn-chart-structure`: `scenario-label-position="top"` puts the name of the scenario of a chart with plain bars above the first bar.
- `bn-chart-structure`: `italic-categories` prints rows in italics, for example the rest rows.
- `bn-annotation-layer`: new mark `pointer`, a thick arrow that points down at the end of a bar or at the top of a column.
- `bn-annotation-layer`: new mark `bracket` for a chart with bars from left to right. It marks the rows from `target` to `to` with a line, and prints `text` in a frame, or with `percent` the share of these rows in all rows.
- `bn-annotation-layer`: the mark `difference` works on a chart with bars from left to right. Bars and stack segments of `bn-chart-structure` carry their value in `data-bn-value` for it.
- `bn-context`: `group-separator` replaces the group separator of the locale in every number of the document: `thin-space`, `space`, `none`, or the separator itself. It holds for the whole page: with several contexts the last one that declares a separator wins, and when that one leaves, the one before it. When the separator changes, the numbers of every context are drawn again.
- `bn-layout-card`: `card-overlay-area` puts the child after the last slot of the layout on top of the grid, in a CSS `grid-area` given in line numbers. For a text or a comment list in the free part of a chart.
- `bn-chart-time`: `stack` with `"by":"dimensions"` now stacks one segment per value of the `category` column of the dataset. The order comes from `categoryIndex`, else from the first appearance. There is no limit of four series, and a series keeps its colour in every period, also when a value is missing. Before, this mode drew one segment per period.
- `bn-chart-time`: `scenario-switch` works with a stack by dimensions. The scenario that has values in a period is stacked, so one axis can go from AC to FC to PL, with the line at the change and the names under the axis.
- `bn-chart-time`: new `stack` keys. `"notation":"scenario"` gives a segment the look of its scenario: forecast hatched over the shade of the series, plan outlined, and the first series with the fill of the scenario. `"legend"` (`left`, `right`, `both`, `none`) sets where the series names stand. `"percentMark":true` prints the shares of a 100 % stack as plain numbers and adds one `100%` mark on the side of the names.
- `bn-chart-time`: `axis-labels-mode="two-row"` prints short labels and puts the parent period (the year of a month) in a second row, under the first period and where it changes. With `scenario-switch` the scenario names stand in the same row, for example `2025 AC`.
- `bn-annotation-layer`: new mark `difference`. It shows the difference of two values of a chart: a thin line from each level to a bar behind the second value, and the label `to` minus `target`. `percent` adds the relative difference in brackets, `highlight` frames it, `digits` sets the digits and `sentiment` (`good-up`, `good-down`) picks the colour `positive` or `negative`. A point of a stack without a category means the sum of the stack. Stack segments and columns of `bn-chart-time` carry their value in `data-bn-value` for this, and a bar in the layout state has a `value`.
- `bn-annotation-layer`: a `frame` item can bring a `text`. The text is printed on the target with the frame around it.
- `bn-chart-time`: a segment of a stack by dimensions has the `category` in its point key, so an annotation can address one series of one period.
- `bn-chart-time`: a warning when a stack by dimensions with `scenario-switch` has a scenario that is not drawn, because it has values in periods of the first scenario or because the chart is a stacked area.
- `bn-chart-time`: a warning when a stack by scenarios gets more than four scenarios. The fifth and later ones were dropped without a message.

- `bn-chart-time` and `bn-chart-structure`: `data-format-digits-decimal` and `data-format-digits-percent` set the digits of the value and percent labels, like on `bn-table`. Defaults stay 1 and 2.
- `bn-chart-time` and `bn-chart-structure`: `scenarios="none"` draws no scenario. The chart shows only its variances, and the first variance carries the category labels. `bn-grid` then aligns such a chart on its variance axis.
- `bn-chart-time`: `scenario-switch` is for a series that changes its scenario along the time axis, for example AC up to this year and PL after it. A scenario that only has values where the first scenario has none is drawn in its place, as a full column with value labels. A vertical line marks the change, and the scenario names stand under the axis. Variances of one type over the same reference share one row, and plan variances are outlined.
- `bn-chart-time`: `axis-labels-step` prints only every n-th category label. In smart mode a label that carries the year or month is always printed.
- `bn-chart-time`: `axis-title-position` (`left`, `right`, `none`) moves or hides the axis title.
- `bn-chart-time`: the translation key `date-format-short-year` sets the pattern of the short year label, for example `’yy`.

### Changed

- `bn-chart-structure`: with a fixed `unit-scaling` (and a fixed `percentage-scaling` when the chart has a relative variance) the segments share the width of the chart. A segment that needs less than its equal share leaves the rest to the others. Before, each segment had its share only, so long bars got break marks while the chart had room. A segment that fits its room as it is gets no break marks.
- `bn-chart-structure`: the value of a longer reference bar is printed whenever the label of the front bar fits between the two bar ends. In a chart with break marks only the rows whose bars are cut lose it. Before, it needed more room, and one break mark in the chart removed all of them.
- `bn-chart-structure`: with `scenario-label-position="top"` and a reference bar in the first row, the name of the first scenario stands at the end of its bar, on the line of the name of the reference. Before, it stood at the axis, on the start of the reference bar. A chart with one scenario keeps the name at the axis.
- `bn-chart-structure`: in a chart with several segments the line above a sum row runs over all segments. Before, it ended behind the numbers of the row.
- `bn-chart-time`: with `totals.dataset`, a scenario column of a row that the chart does not draw is now drawn at the total (see `scenarios` in `totals`). Before, such a column was ignored. `"scenarios"` in `totals` limits them.
- `bn-chart-structure`: a row with the category `REST` stays last under every order, as in `bn-table`. Before, a `REST` row from the data was sorted like any other row.
- `bn-chart-structure`: a reference bar that is much longer than the bar in front of it prints its value at its end, when the row has no marker.
- `bn-chart-time`: with `scenario-switch`, the row of a variance is named by its reference only (`ΔPY`), also when the first variance of the row is not one of the actual values. Before, a row that started with a forecast was named `Δ(FC - PY)`.
- `bn-chart-structure`: the triangle of the `100%` mark of a stack is larger.
- `bn-annotation-layer`: a mark on a value label of a chart takes the box of the text, not of the group with its background. A frame around a total is as wide as the number now.
- `bn-annotation-layer`: the text of a `bracket` stands beside the rows at half their height. It stood above the first row.
- `bn-chart-structure`: a stack by dimensions orders its series by the index column of the stack dimension (`categoryIndex`, `subCategoryIndex`), else by first appearance, and every bar has a place for every series. Before, the order came from the rows, and a bar without a value for a series moved the following series to another place and colour. The `REST` row of a `limit` now has the segments of the rows it stands for. Before, it was one plain bar.
- `bn-chart-structure`: the room a segment label of a stack needs gets smaller with the font: 0.375 em, at most 6 px as before. With a scaled-down chart more small segments show their label.
- `bn-annotation-layer`: a marker on a value label of a chart (`part` `label` or `total`) sits right of the label. Before, it sat on the label and hid it. The text of a `frame` on such a label stands right of the label too.
- `bn-annotation-layer`: a marker on a segment of a stack of `bn-chart-structure` sits in the segment, right of its middle, or on its upper edge when the segment is narrow. Before, it sat on the upper right corner and could touch the total.
- `bn-chart-time`: with `scenario-switch`, a chart with exactly one scenario now prints the name of that scenario under the axis. Such a chart gets one text row higher.
- `bn-annotation-layer`: a marker on a segment of a stack sits on the upper right corner of the segment. Before, it sat in the middle and hid the value label.
- `bn-chart-time`: the background box of a centred label is centred on its text. It was 1 px too far left.
- `bn-chart-time`: the value label of a stack segment needs a segment height of 18 px, or of 1.15 times the font size when that is less. With a font below 15.6 px some small segments now get their label.

- `bn-chart-time`: a relative variance above 145 % is no longer always cut. With a fixed `percentage-scaling` the pin is drawn in full length when it fits into the available height. It is still cut when it does not fit, and always with an automatic percentage scale. A chart with a fixed scale, long pins and enough room gets higher by this.

- `bn-table`: the variance cells of a `partof` row ("in % of") now show how the share changed. Before, they showed the variance divided by the variance of the sum, which is no useful number. An absolute variance prints the difference of the two shares in percentage points with a `%p` behind it (for example 129% against 187% gives `-58%p`). A relative variance prints the change of the share in percent, before it was always `-`. These cells have no sentiment color and never a bar or pin. In a table with percent values (`scenariosDataFormat: percent`) the cells print `-`, like the scenario cells of the row.

- Variance columns are now grouped by their reference, as IBCS shows them: ΔPY, ΔPY%, ΔPL, ΔPL% instead of ΔPY, ΔPL, ΔPY%, ΔPL%. Each relative variance comes right after the absolute variance against the same scenario. This holds in every interval block of `bn-table` and also in `bn-title`, `bn-chart-time` and `bn-chart-structure`, which use the same rule set. The built-in `sortIndex` of `drpp`/`drpy`, `drpl`/`drbu`, `drfc` and `drac` is now 1105, 1205, 1305 and 1405 (was 2100 to 2400). A table that mixes references can change order too: `drac1_pp1` now comes before `dpp1_ac1`. To keep the old order, set the old values in a `bn-ruleset`. A rule set that moves only `dpl` should now move `drpl` as well.

- `bn-table`: a cut relative variance pin now shows its label as IBCS does. The label stands on the pin line, directly behind the arrow head on the axis side, on a light band (white at half opacity) that keeps it readable. This holds when the line is long enough for the measured label, the band padding and a short piece of full line on each side. On a shorter line the label stays after the arrow tip, as before, so it never leaves the cell. The arrow head is now 1.2 times the square pin head in length and height. The tip stays where it was, and the space the column reserves for labels does not change.

- `bn-table` looks more like the IBCS tables. This changes every table a little, and a table gets a bit wider.
  - Column blocks stand further apart. The row header, the scenarios of one interval block and each pair of variances (ΔPY with ΔPY%, ΔPL with ΔPL%) are blocks. The first column of a block has 0.6 em more room on its left, and no row line or header line is drawn in that gap. Such a cell has the class `block-start`. The baseline that `bn-grid` aligns on still is the visible start of the first value column.
  - In a grouped table that is no calculation scheme (`type` other than `opt` and `optnototal`), the room after a group sum row is 1 em instead of 0.5 em.
  - The row lines are solid, not dashed.
  - The labels of the interval blocks (for example the month and the year to date) are in regular weight, not bold.
  - The header of a bar or pin column is centered over the column.
  - The variances on sum rows print in the text color, not in teal or red. The rows above keep their color.
  - Bars take 60% of the row height (before about 78%). This holds for variance bars, scenario bars and waterfalls.
  - Hatching is finer: a line every 3 px instead of every 6 px at the default size.
  - The square pin head is 8 px instead of 10 px, and the arrow of a cut pin shrinks with it. The head of an FC variance is dark with thin light lines, before it was white with dark lines.
  - The axis of a variance against PL is two lines with a gap of the same width. Before, the two lines were thin and far apart.

### Fixed

- `bn-chart-scatter`, `bn-chart-bubble`: text widths were measured in the font of the page and not in the font of the chart. Where the two differ, the bold name of an axis title ran into its unit (`Net salesin mEUR`), and the room for the legend and the tick labels was off. The widths are measured in the font of the chart now, so legends, labels and the plot can move by a few px.
- `bn-chart-scatter`: the caption of the iso-lines stood directly on the highest value. It has half a line of distance now.

- `bn-chart-time`: `unit-scaling="auto"` gave a flat line chart or area when the chart had a change of the year: the dashed year line counted twice for the height. The same error made the layout state report a height overflow.
- `bn-chart-time`: the layout state reported a line chart and a stacked area as empty.
- `bn-chart-time`: the variance of a total from a `dataset` was hatched as a forecast when its row named a forecast that is no part of the value. It takes the notation of the scenarios in its value now.
- `bn-chart-time`: with `totals` from a `dataset`, a variance row gets a variance of the total only when the whole series stands on one side of its variances and none of it on the other. A row that sets parts of the series against each other got a value before.
- `bn-chart-time`: two more points of `totals` with a `dataset`. A variance that names the series second (`dpp1_ac1_neg`) is treated like one that names it first: the side with the series is added up, and a row for a part of the series gets no variance of the total. And a row of the dataset with the date of a week of the chart belongs to the total of that week, also when the week counts into another year than its first day.
- `bn-chart-time`: three points of `totals`. With a `dataset`, `aggregation` `average` or `last` now gives one column from the values of the row, as without a dataset. With a `dataset`, a variance row for a part of the series only gets no variance of the total: the reference of the row is the one of the whole total. And a week counts into the year, quarter or month of its Thursday, as its number does.
- `bn-chart-time`: three defects of the total column. A negative variance of the total did not count for the height of its row and ran out below the chart. In a row with cut variances the part above the break of the total could be far higher than the row. And the segment of a variance that is not valid drew the band of the scaling indicator.
- `bn-chart-time`: a column got a break mark although the chart had room. With a fixed `unit-scaling`, the columns and each variance row got the same share of the height, and a column was cut when it did not fit into its share. Now the columns also get the height that the variance rows do not use.
- `bn-chart-structure`: a 100 % stack kept room behind its bars for a total that it does not print. It now keeps half the width of the `100%` mark with `percentMark`, and nothing without it. The same holds for the room of `totalTitle` and for the total of a negative stack on the left side. The chart keeps room for a series name that is wider than its segment at the end of the bar. Such a chart gets narrower, so a chart next to it moves closer.
- `bn-chart-structure`: a label was measured in the default font of the browser (16 px) and not in the font of the chart when the chart was drawn before it was in the page. With a small chart font the number of a narrow stack segment was dropped although it fits, and label room was too wide. A label now carries the font of the chart itself. Charts with a scale below 1 can show more segment labels and get a little narrower.
- `bn-table` relative variance pins: the pin line now lies over the square head and ends visibly in its centre, and the axis lies over both, as in `bn-chart-time` and `bn-chart-structure`. Before, the head covered the end of the line, and a head near zero covered the axis. This also holds for the white PL head, which no longer hides the line.
- `bn-table` bar columns: the bars of a thereof, partof or share row now stand at the same place as the bars of the rows around them. Before, the whole bar graphic of such a row sat 0.1 em to the right (about 1.3 px at the default font size), so the axis line of a waterfall column had a step at every block of thereof rows and the dashed guide of the parent bar stood next to the axis instead of on it. The cell padding is in em and these rows have a smaller font, so the padding was smaller. Scenario bars, waterfalls, variance bars and pins are all in line now. The variance waterfall already had this correction.
- A variance that prints as zero no longer has a `+` and a sentiment color in the number cells of `bn-table`. Before, a variance of `0` printed as `+0.0` or `+0.0%` in teal or red, a value like `0.04` at one decimal digit also printed as `+0.0`, and `-0.04` printed as `0.0` in the color of a negative variance. Now every variance that rounds to zero at the displayed digits prints without a sign in the default text color, as IBCS shows it. This holds for absolute, relative and percentage point variances, on entry rows, group sum rows and the total row. A relative variance stays italic. Such a cell has the class `zero` instead of a class like `pos_pos` or `neg_pos`. The variance labels of `bn-chart-time` and `bn-chart-structure` follow the same rule: `0.0` and `0.0%` instead of `+0.0` and `+0.0%`. `bn-chart-structure` no longer keeps room for the `+` of such a label.
- `bn-table` variance bars and pins now follow IBCS. A pin ends in a square head instead of a round black dot, and its label sits next to the head on the side of the value, like the label of an absolute bar. The label of a zero pin goes to the side that has label space. Bar and pin labels always stay inside the cell, with their sign: before, the label of a long or cut pin could run past the cell edge, so `-27.3%` showed as `27.3%`. Each side of the axis reserves only the space its widest label needs, and the pins and bars get the rest. A pin column too narrow for its labels drops percent digits, then the `%`, for the whole column, and only then makes its pins shorter. With a fixed `percentage-scaling`, a pin that does not fit is cut at the end of the pin area and ends in an arrow. Auto `percentage-scaling` makes the longest pin, its head and its label fill the column and never cuts. One scaling per unit is still shared by all columns and interval blocks, so the column with the least room decides it. A zero variance prints `0` or `0.0%` without a `+`, as IBCS does. The bar takes the pattern of the minuend in the sentiment colour (FC hatched with an outline, PL outlined, AC and PY solid). The pin head takes the look of the minuend scenario: AC solid dark, PY solid grey, FC hatched, PL a white square with a dark outline that covers the pin line. The axis of variance bars and pins takes the look of the reference scenario: PY a thick grey line, AC a thick dark line, PL a double line, FC a dashed dark line. Bars start at the edge of the axis. Scenario bar columns and waterfalls do not change.
- `bn-table` waterfall columns: a line no longer runs through a value label. In a thereof or partof row, the dashed guide at the end of the parent bar is left out in a row where it would meet the label. The guide at the start of the parent bar stays in every row, and the end guide stays in rows with room, for example the last row of a block. The zero axis line is left out in a row the same way. The label room of a waterfall column now comes from the measured labels of all its rows, total rows in bold included, instead of a fixed 2.85 em on each side: each side keeps only what its labels need beyond the bars, so a long label like `1,031.2` stays inside the cell and a column whose bars all point right uses the whole left side for bars. The label room is taken at the scale of the bars, so a label whose bar ends inside the column needs less of it. The bars keep at least half the column: only label room beyond that shrinks, and a side whose labels fit the old fixed room keeps it. The column width does not change.
- `bn-table` waterfall columns on `opt` and `optnototal` tables with `limit`: the REST row now walks by the signed sum of the rows it holds. Before, a REST row of `-` rows walked to the right, so the walk did not end at the sum.
- `bn-table` measures the bar and pin labels in the browser with the font they are drawn in (family, size, italic for pins). Before, an estimate made the labels about 10 to 15 % wider than they are, so a pin column dropped percent digits that fit (`+16%` instead of `+16.1%`) and kept too much space for the labels. Digits now drop only when the measured labels do not fit. Without a canvas, for example in tests, the estimate is still used. The two sides of a pin column now share the pin room by the length of their longest pin at the shared scale, so a column with `+36%` and `-21%` moves the axis to the left and draws longer pins. When a fixed `percentage-scaling` cuts pins, a side that needs less than half the room gives the rest to the other side. A table measures its labels again when a web font finishes loading, and a font family the browser cannot parse falls back to the estimate.
- `bn-table` with `type="opt"` or `"optnototal"`: the variances on group sum rows and the total row now use the operation sign of the rows below, like the scenario values on the same rows. Before, a sum row showed correct AC and PY values but a wrong difference, and a wrong relative variance. Example: an operating result of 467.4 against 302.1 showed +240.1 instead of +165.3. A group made only of `-` rows now shows a negative variance, matching its negative total. A partof row divides by these signed group values, so a partof variance in such a group now has the sign of the group, like its scenario values already had.
- `bn-grid` with `baseline` alignment now aligns on the chart or table inside a `bn-layout-card` in a cell. Before, it took the card as the component, found no baseline and sent the cell to the bottom. The offset now moves the body of the card, so the card titles of a row stay on one line and a card with a taller title or a logo keeps its chart on the axis line. The card reads the offset from the CSS properties `--bn-baseline-offset-top`, `--bn-baseline-offset-left` and `--bn-baseline-offset-right`, which the grid sets.
- `bn-grid` with `cell-width="equal"` is now as wide as its container, and the data columns share that width. Before, the columns were only as wide as their content, so charts in them measured a small width and drew small. Grids without `cell-width="equal"` do not change.
- `bn-chart-time` and `bn-chart-structure` no longer report "Chart exceeds available width" when they are less than 300px wide. A hidden SVG that holds the fill patterns had no size and counted as 300px of chart content.

### Added

#### `bn-grid`: a cell over several rows or columns, and a cell background

The child of a cell can carry `row-span` and `column-span` (whole numbers, default 1): `<div slot="0-0" row-span="2">`. Its cell then also takes the positions right of it and below it, and those positions get no cell. The other cells keep the place of their slot name. Captions, the lines of `show-borders`, alignment and `cell-height="equal"` work as before. With `baseline` alignment a cell over several rows is left out of the rows and stays at the top, and a cell over several columns is left out of the columns. A span that is no whole number from 1 is `ERR_cellSpan`, a child in a covered position is `WARN_cellSpan`.

`cell-background` on the child of a cell is the background colour of that cell. The new style key `bn-grid.cellBackground` (default `transparent`) sets it for every cell, and the attribute wins.

#### `bn-layout-card`: font size of the title

The new style section `bn-layout-card` has one key, `titleFontSize` in px. Without it the title keeps the font size of `global.fontSizePx`. `bn-title` has the matching attribute `title-font-size`.

#### `bn-annotation-layer`: a target in one cell of a grid

A `data-bino-annotation-target` on the child of one `bn-grid` cell, or of a card in that cell, was already found. But the mark could stay where the chart was before the grid moved it onto the baseline. The layer now follows that move.

#### `bn-table`: variance waterfall

The new attribute `variance-waterfall` (property `varianceWaterfall`, default `false`) draws every absolute variance column listed in `bar-columns` as a waterfall down the rows, as IBCS shows the variances of a calculation scheme. Without it nothing changes: the column keeps single bars from the axis and no bar on sum rows. Relative variance columns stay pins.

Each row starts where the row above ended. On `opt` and `optnototal` tables the step is the operation sign times the printed variance, so a higher expense moves to the left while its label still reads `+`. Other table types use their signed values as they are. The label stands at the free end of the bar. The color is the sentiment of the cell, the pattern follows the minuend scenario and the axis has the look of the reference scenario, in every row. Sum rows and the total are bars from the axis with bold labels. Each row group starts at the axis again; with `running-sum` the walk goes on from the sum row. Thereof rows walk from the start of their parent bar by their own signed values, below or above the parent, and have no dashed guides. A partof row prints its number. Thin lines join the end of each bar to the start of the bar in the next row, also beside thereof rows and across the gap after a sum row. A row without a bar breaks the line only on the side it is printed on. Where the axis or a passing line meets a label, the line is interrupted over the height of the text. The REST row of a `limit` walks by the signed sum of the rows it holds, so the walk ends at the sum. A column where every variance is zero has no walk and prints its zeros as numbers.

The column scales to fit the whole walk and measures its labels, so `unit-scaling` does not apply to it. With `interval` or `columnthereof` the attribute has no effect.

```html
<bn-table
  type="optnototal"
  grouped="true"
  show-group-title="false"
  running-sum="true"
  scenarios="pl1,ac1"
  variances="dac1_pl1_op,drac1_pl1_op"
  bar-columns="dac1_pl1_op,drac1_pl1_op"
  variance-waterfall="true"
></bn-table>
```

#### `bn-table`: running results and thereof rows above their parent

Two new attributes build a calculation scheme such as an IBCS income statement. Both are off by default, so existing tables do not change.

`running-sum` (property `runningSum`, default `false`) turns the sum row of each row group into a running result: the sum of all rows from the first group down to its own group. The scenarios, the absolute variances and the relative variances of the row all follow, so a result of 467.4 against 302.1 shows +165.3 and +55%. It needs `grouped` and works with the types `sum`, `sumnototal`, `opt` and `optnototal`. The results add up in the order the groups are printed. The total row of `sum` and `opt` stays and repeats the last result, so `sumnototal` or `optnototal` is the usual choice. Interval columns add up per block. A variance without a reference value stays empty in a result until a group has one. `partof` shares still refer to the sum of their own group. In a scenario bar column the result is a bar from zero and the next rows walk on from its end, also across a group title. Not supported with `columnthereof`: there `running-sum` has no effect.

`thereof-position` (property `thereofPosition`, default `below`) takes `below` or `above`. With `above` the thereof rows stand before their parent row, in normal size and upright, with an indented label, without the thereof label and with an empty operation cell. The parent row looks like a subtotal (bold, a line above it) and keeps its operation sign and its value: a parent of `-` rows prints `-` and for example 602.6. The thereof rows keep the operation of the parent for the `op` sentiment and for the waterfall bars, and they keep the order they have below the parent. Use `above` only when the thereof rows are all subcategories of the parent (`"subCategory": ""`): with only some of them the parent looks like a subtotal that does not add up. Another value gives the warning `WARN_thereofPosition` and counts as `below`.

```html
<!-- = Sales revenue, + Other op. income, five expense rows, - Operating expenses, = Operating result, ... -->
<bn-table
  type="optnototal"
  grouped="true"
  show-group-title="false"
  running-sum="true"
  thereof='[{"rowGroup": "Operating result", "category": "Operating expenses", "subCategory": ""}]'
  thereof-position="above"
  scenarios="pp1,ac1"
></bn-table>
```

#### `bn-table`: order of the setname blocks and position of the category column

With `interval="setname"` the blocks were always in order of first appearance in the data. The new optional dataset column `setnameIndex` (a number) sets the order: the blocks are sorted ascending by it. If a setname has different indexes, the smallest one counts. Blocks without an index come last. Without the column nothing changes. A row with a `setnameIndex` and a blank `setname` gives the warning `WARN_intervalSetnameIndex`. The check runs only with `interval="setname"`, other tables do not read the field.

The new attribute `category-interval-position` (property `categoryIntervalPosition`, default `0`) is the number of interval blocks that stand left of the category column. `0` keeps the category column first, `1` puts one block left of it, the number of blocks puts it last. The operation column and the `attributes` columns move with it. It works with `setname` and with date intervals.

```html
<!-- Jan | Feb | Mar | category | YTD -->
<bn-table interval="setname" category-interval-position="3" scenarios="ac1,pl1"></bn-table>
```

A value greater than the number of blocks is used as the number of blocks, with the warning `WARN_categoryIntervalPositionRange`. A value without an active interval is ignored, with the warning `WARN_categoryIntervalPositionNoInterval`. A negative value or a value that is not a whole number counts as `0`, with the warning `WARN_categoryIntervalPosition`.

#### `bn-table`: sort by a variance or by one interval block

`order` now takes a variance, written like its column with or without the sentiment, for example `dac1_pp1` or `drfc1_pp1_pos`. Before, such a value sorted the rows by category name without a warning. With `interval="setname"`, a scenario or variance can name one block after `@`: `order="dac1_pp1_pos@_November"` sorts by the `_November` block only and draws the sort arrow on that block only. Without `@` the sum over all blocks is used, as before. A variance or a token with `@` sorts the rows inside each row group, and the groups keep their `rowGroupIndex` order. `limit` picks the top rows and the REST row by the same value. With a variance or `@`, rows without data and relative variances with a zero reference sort last in both directions. In an `opt` table a row sorts by the value printed in it. The sorted variance does not have to be a shown column; the arrow appears only when it is. `@` without `interval="setname"` gives a warning and is ignored, and so does a setname that is not in the data (a warning, and no sort by it). The order also accepts `subcategory` and `subcategoryindex` and spaces after the commas. Charts and `bn-title` do not take the new values.

#### Variance sentiments `op` and `opinv`

Variances take two new sentiment suffixes next to `pos`, `neg` and `neu`, for example `dac1_pl1_op`. With `op` the colour follows the contribution to the result: in a `type="opt"` or `"optnototal"` table a `-` row acts like `neg` and a `+` row or a sum row like `pos`, so a rising cost is red. This applies to numbers, bars and pins. Thereof rows use the operation of their parent, a REST row counts as `-` when all its rows are `-`. `opinv` is the inverse. In other table types and in `bn-chart-time` and `bn-chart-structure` the values carry their sign already, so `op` acts like `pos` and `opinv` like `neg`. `bn-chart-scatter` and `bn-chart-bubble` accept both and ignore the sentiment, as before.

#### `bn-grid`: equal cells, alignment, baselines and captions

A grid of small charts can now line up. All new attributes are optional and the grid looks as before without them.

- `cell-height="equal"` and `cell-width="equal"` give every data row the height of the highest one and every data column the width of the widest one. Title, header rows and the row-header column keep their size.
- `cell-vertical-align` (`top`, `center`, `bottom`, `baseline`) and `cell-horizontal-align` (`left`, `center`, `right`, `baseline`) place the content in its cell. `baseline` lines up the axes of the charts in a row (and the vertical axes in a column), also when one chart is taller or has negative values. A table aligns on the bottom of its header and its first value column. A component without a baseline goes to the bottom, or stays left. The grid counts as rendering until the cells are aligned, so a PDF never shows a half-aligned grid.
- `cell-captions` takes a JSON object from slot name to text, for example `{"0-0": "Berlin"}`, and draws the text top left in that cell. Alignment moves the content, never the caption. The style section `bn-grid` has new keys `captionFontSize`, `captionFontWeight`, `captionColor` and `captionGap`. See [doc/theming.md](doc/theming.md).

An unknown value is an `ERR_` item in `has-error` and renders as the default.

#### Charts and tables report a baseline

`bn-chart-time`, `bn-chart-structure`, `bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet` and `bn-table` have a new method `getBaseline()`, and `getLayoutState()` has the same value as `baseline`: the line the component wants to be aligned on (the axis of a chart, the bottom of a table header), in px from the top-left corner of the component. See [doc/layout-state.md](doc/layout-state.md#baseline-baseline).

#### Annotations: `bn-annotation-layer` and `bn-annotation-list`

A page can point at a number: a numbered circle on a bar or table cell, a rounded frame around a value, a straight arrow between two data points, and a numbered list of the texts. The layer sits in the new `annotations` slot of `bn-layout-page` and draws over the page, so the charts stay as they are. The numbers are given by the caller, the engine never counts. A point with no match or several matches draws nothing and does not fail the page, and its list entry loses the circle. The colours come from the new style section `bn-annotation`. See [doc/integration-contract.md](doc/integration-contract.md#annotations) and [doc/theming.md](doc/theming.md#annotations).

#### `getLayoutState()`: data points say which row they show

With `detail: "full"`, bars, labels, marks, table cells and table rows have a `point`: `{ rowGroup?, category?, subCategory?, date?, scenario?, row?, part }` with the raw data values. The rendered elements carry the same values as `data-bn-*` attributes. Nothing changes in how a report looks. See [doc/layout-state.md](doc/layout-state.md#data-points-point).

The result is also more complete: stack segments, stack totals, value labels of plain charts, line and scenario markers and bullet bars are now listed. They were missing before. `barCount` counts the stacks of a stacked chart, so `hasNoData` is no longer `true` for one.

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

The components already read these attributes, but did not declare them. They were missing from the generated docs and from the TypeScript types, and setting the JS property did nothing. They are props now: `datasets` on the table, the charts and `bn-text`, `selectedStyle` on every styled component, `i18nNamespace` on every component with translated text, `renderOrientation` on `bn-context`. Each one reflects to its attribute, so markup does not change. A change of `datasets` now drops the data of the names that are gone, and an empty value empties the component. Before, the old data stayed.

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
- `bn-datasource`, `bn-dataset`: `window.componentRegisterIsRenderedResult` became `true` while the first request for `src` was still running, so a PDF could be rendered with empty tables. The component now counts as rendering until that request has succeeded, failed or been cancelled. Polling requests (`refresh-interval`) do not hold the flag, and a poll tick that comes while the first request is still running is skipped instead of cancelling it. An element that is removed and attached again no longer counts as rendering forever.
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
