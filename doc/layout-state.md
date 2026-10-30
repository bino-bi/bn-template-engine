# Layout State

`getLayoutState()` generates a JSON-serializable snapshot of a rendered
report: where every component sits, how big it is, the geometry of its inner
elements (bars, labels, axes, table cells, tree nodes, grid cells), and
render metadata (counts, scenarios, resolved scaling). It is designed for
debugging tools, embedding hosts (e.g. drawing overlays over a report) and
AI agents that need to "read" a report technically.

Nothing is tracked while rendering - every call measures the live DOM at
that moment.

## Quick start

```js
// Whole report, compact:
const state = await document.querySelector("bn-context").getLayoutState();

// Whole report, every element:
const full = await document.querySelector("bn-context").getLayoutState({ detail: "full" });

// A single component:
const table = await document.querySelector("bn-table").getLayoutState({ detail: "full" });
```

The method exists on `bn-context` (aggregates every visual descendant) and
on the rich components (`bn-table`, `bn-chart-time`, `bn-chart-structure`,
`bn-chart-scatter`, `bn-chart-bubble`, `bn-chart-bullet`, `bn-tree`,
`bn-grid`). All other visual components appear in the `bn-context` result
with a generic entry (box, identity, em context, diagnostics).

### When to call

Charts auto-fit and re-scale asynchronously after load. A call always
returns a self-consistent snapshot of what is currently on screen, but for
final geometry call it after the report has settled - the renderer signal
`window.componentRegisterIsRenderedResult === true` is the recommended
trigger.

## Coordinate spaces

Every rect is reported in **both** coordinate spaces at once, in CSS px,
rounded to 2 decimals:

```json
{
  "context":   { "x": 120, "y": 340.5, "width": 200, "height": 80 },
  "component": { "x": 0,   "y": 12.5,  "width": 200, "height": 80 }
}
```

- `context` - offset from the `bn-context` host's top-left corner.
- `component` - offset from the owning component host's top-left corner.

The root `context.viewport` rect anchors the whole snapshot to the viewport
(`getBoundingClientRect()` of the `bn-context` host at capture time), so an
embedding host can convert context coordinates to page coordinates.

When a component's `getLayoutState()` is called standalone without a
`bn-context` ancestor, the component's own host is the context origin
(`context` rects equal `component` rects).

Each component also reports its **em context** - `em.fontSizePx` (effective
font size, including auto-fit scaling) and `em.appliedScaleFactor` - so
px values can be related to the em-based scaling system (see
[scaling.md](./scaling.md)).

## Identity

Each component entry carries a stable `id`:

1. the element's `id` attribute, if set;
2. otherwise the `name` attribute, if set;
3. otherwise a generated `tag[index]` path (per-tag document-order index,
   e.g. `bn-table[1]` = the second `bn-table` in the report). Indexes count
   all instances of the tag, so giving one instance an explicit id does not
   shift its siblings' generated ids.

Components slotted into `bn-grid` cells or `bn-tree` nodes appear as their
own top-level entries carrying their `slot` attribute; the grid/tree entries
expose their cells' slot names - join on those to reconstruct nesting.

## Schema

Exported TypeScript interfaces (from the package root): `LayoutState`,
`ComponentLayoutState`, `LayoutRect`, `DualRect`, `EmContext`,
`LayoutRegion`, `LayoutElement` (union), `TableDetail`, `ScalingInfo`,
`LayoutDiagnosticItem`, `ComponentMetadata`, `LayoutStateOptions`,
`LAYOUT_STATE_VERSION`.

### Root (`LayoutState`)

| Field | Description |
| --- | --- |
| `version` | Schema version (currently `1`). |
| `generatedAt` | ISO 8601 timestamp of the snapshot. |
| `detail` | `"summary"` or `"full"`. |
| `context.viewport` | Viewport-relative box of the `bn-context` host. |
| `context.locale` | Active locale of the context. |
| `components` | One `ComponentLayoutState` per visual component, document order. |

### Component (`ComponentLayoutState`)

| Field | Description |
| --- | --- |
| `tag`, `id`, `slot?` | Identity (see above). |
| `rect` | Host box (`DualRect`). |
| `em` | `{ fontSizePx, appliedScaleFactor }`. |
| `regions` | Named sub-areas: `canvas:base` / `canvas:<variance>` (charts), `canvas` (xy charts), `header` / `body` (table), `grid` (tree/grid). |
| `metadata` | Counts and semantics - see the matrix below. |
| `diagnostics` | The component's current `has-error` items (warnings/errors, incl. `AUTO_*` auto-fit notices and `WARN_overflow` / `ERR_overflow`). |
| `scaling?` | Resolved value scaling - see below. |
| `elements?` | Per-element geometry, only with `detail: "full"`. |
| `table?` | Row/column model, only with `detail: "full"` on `bn-table`. |
| `error?` | Set when collecting this component's state threw; box and identity are still filled. |

### Elements (`LayoutElement` union, `detail: "full"`)

Every element has `rect: DualRect` and an optional `id` (the DOM id when the
rendered element carries one).

| `kind` | Emitted by | Key fields |
| --- | --- | --- |
| `bar` | time/structure charts, bullet chart | `segment` (`"base"` or variance name), `scenario` (`"scenario1"`-`"scenario4"`, `"stack:<key>"` for a stack segment, the measure on a bullet bar), `index` (category ordinal), `point?` |
| `label` | charts, tree | `role`: `data`, `scenario`, `category`, `axisLabel`, `title`, `footer`, `legend`, `operator`; `text`; `point?` |
| `axis` | time/structure charts | `style` (`ac`/`pp`/`fc`/`pl`/`default`), `orientation` |
| `point` | scatter/bubble/bullet, line and scenario markers of a time/structure chart | `index`, `series?`, `text?`, `point?` (xy marks carry no ids: tag-classified) |
| `cell` / `headerCell` | table | `row`, `column`, `key` (column identity), `colSpan`, `value` (model value), `text` (rendered), `type`, `bar?` (in-cell bar: `variant` `absolute`/`relative`/`waterfall` + rect), `point?` |
| `node` | tree | `nodeId` (slot name) |
| `edge` | tree | `from`, `to`, `operator?`, `path?` (SVG path data) |
| `gridCell` / `gridHeader` / `gridTitle` | grid | `rowId?`, `columnId?`, `slot?`, `label?` |

### Data points (`point`)

An element that shows a data row says which one, in `point`:

```json
{ "date": "2024-01-01", "scenario": "pl1", "part": "element" }
```

| Field | Value |
| --- | --- |
| `rowGroup`, `category`, `subCategory` | The raw dataset value, not the translated or formatted label. Only the dimensions the element is known to show are set. |
| `date` | Time charts and the date columns of a table with `interval`: the first day of the bucket, `YYYY-MM-DD`. With `date-interval="year"` a row of `2024-03-15` is in the bucket `2024-01-01`. A bucket that does not start at midnight also has the time: `2024-01-01T09:00:00`. |
| `scenario` | A slot (`ac1`), a variance (`dac1_pl1_pos`), or the column key of a table cell. |
| `row` | `subtotal` or `total` on a table row and its cells. |
| `part` | `element`: the bar, mark, row or cell. `label`: its value label. `total`: the total label of a stack. |

Per component:

- **Time chart**: `date` and `scenario`. The chart adds up the rows of a bucket, so it knows no other dimension. A stack total has `date` only. When a stack overlays scenario families (`ac` and `pl`), each family has its own total and `scenario` is the family.
- **Structure chart**: the dimension of `level` and `scenario`. With `stack` by dimensions, a segment also has the next lower dimension, and a total has the dimension of `level` only.
- **Scatter, bubble**: the dimensions of the point level, the series level and the facet level, no `scenario`. A name label is the `label` of its mark. A bubble's share slice and its comparison bubble have no `point`.
- **Bullet chart**: the dimension of `level` and the actual measure as `scenario`, on the bar and its value label. Target marks and variance bars have no `point`.
- **Table**: `rowGroup`, `category` and `subCategory` on body rows and thereof rows, `row` and the parent `rowGroup` on a subtotal, `row` alone on the total. A cell adds its scenario column as `scenario`, and the bucket as `date` in a column of a date `interval`. Header rows and group headers have no `point`, and neither have part-of rows: they would repeat the key of the row they belong to. All columns of one scenario with `columnthereof`, or with `interval="setname"`, have the same key: a point cannot tell them apart.

An element without a value has no `point`: an empty bucket draws a bar of height 0, a stack segment without a value draws nothing, a table cell without a value is blank or shows `-`. An area chart (`chart-mode="line"` with `stack`) has no data-point elements.

The same values are on the elements as `data-bn-row-group`, `data-bn-category`, `data-bn-sub-category`, `data-bn-date`, `data-bn-scenario`, `data-bn-row` and `data-bn-part`. These sit inside shadow roots and are not API: read `point`.

### Table detail (`table`, `bn-table` only)

- `rows`: `{ section: "header" | "body", index, type, rect, point? }` - `type` is the
  model row type (`HEADER`, `SEPERATORLINE`, `GROUPHEAD`, `SUM`, `STANDARD`,
  `DRILLELEMENT`, `PARTELEMENT`, …).
- `columns`: `{ index, key, group?, type?, bucket? }` - the effective column
  definitions (category/operation + attributes + scenarios × interval
  buckets), in render order. `CellElement.column` is the ordinal into a row's
  cells; on body rows it aligns with this list.

### Scaling (`ScalingInfo`)

Reported by `bn-table`, `bn-chart-time` and `bn-chart-structure`:

| Field | Description |
| --- | --- |
| `unitMode` / `percentageMode` | `"fixed"` (attribute/group resolved) or `"auto"` (auto-fitted). |
| `unitsPerEm` / `percentagePointsPerEm` | Attribute-form value (see [scaling.md](./scaling.md)); for `auto`, the last auto-fitted result - including silent explicit-`auto` fits. |
| `unitPxPerUnit` / `percentagePxPerPoint` | The same value as effective px. |

## Per-component detail matrix

| Component | summary | full adds |
| --- | --- | --- |
| `bn-table` | header/body regions, row/column/cell counts, scenarios, scaling | every cell (+ in-cell bar SVGs), row rects, column definitions |
| `bn-chart-time` / `bn-chart-structure` | canvas region per segment, bar count (stacks in a stacked chart), scenarios/variances, scaling | every bar, stack segment, stack total, marker, data/scenario label, category label, axis, title, footer per segment |
| `bn-chart-scatter` / `bubble` / `bullet` | canvas region, point count | tag-classified marks, bullet bars and text labels (xy SVGs carry no ids/classes, `point` names the data row) |
| `bn-tree` | grid region, node/edge counts | node boxes (slotted content), edge paths, operators |
| `bn-grid` | grid region, row/column counts | title, headers, data cells with slot names |
| all other visual components | box, identity, em, diagnostics | - |

## Caveats

- **Snapshot semantics** - each call re-measures; two calls during an
  animation or auto-fit iteration can differ. Wait for settle (see above).
- **Size** - `detail: "full"` on a large table lists *every cell*; on a
  1000-row × 20-column table that is ~20k cell entries (several MB of JSON).
  `summary` is the default for a reason.
- **Spec/JSDOM environments** - `getBoundingClientRect` returns zeros in
  DOM emulators without layout; structure and metadata remain correct.
- **Versioning** - additive changes keep `version: 1`; breaking shape
  changes bump `LAYOUT_STATE_VERSION`.
