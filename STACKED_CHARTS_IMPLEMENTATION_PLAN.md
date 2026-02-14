# Implementation Plan: Stacked Charts for `bn-chart-time` and `bn-chart-structure`

## 1. Goal

Add a `stack` attribute to `bn-chart-time` and `bn-chart-structure` that enables stacked bars, stacked columns, and stacked area charts (when in line mode). Follow IBCS notation standards. Support stacking by scenario (ac1–ac4) or by data dimension (category, subcategory, rowgroup).

---

## 2. Existing Architecture (Context for Agent)

### Key files

| File | Role |
|------|------|
| `src/components/bn-chart-time/utils/model/TimeChartComponentConfig.ts` | Config class + adapter — maps HTML attrs to internal config |
| `src/components/bn-chart-time/utils/TimeChart.ts` | Main render orchestrator — `drawScenarios()`, `drawLineScenarios()` |
| `src/components/bn-chart-time/utils/factories/ScenarioFactory.ts` | Creates `Column`, `Marker`, `LineSeries` elements per data point |
| `src/components/bn-chart-time/utils/elements/Column.ts` | Single bar/column element |
| `src/components/bn-chart-time/utils/elements/LineSeries.ts` | Line + markers for one scenario |
| `src/components/bn-chart-time/utils/elements/Line.ts` | Legacy single-segment line (kept for reference) |
| `src/components/bn-chart-time/utils/helper/ElementPositions.ts` | All x/y/width/height calculations |
| `src/components/bn-chart-structure/utils/StructureChart.ts` | Structure chart render orchestrator |
| `src/utils/constants.ts` | All enums: `Scenarios`, `ChartMode`, `AggregationLevel`, etc. |
| `src/utils/validate.ts` | All validation functions for props |

### Existing prop patterns

- Simple strings: `level="category"`, `chartMode="bar"`
- Comma-separated lists: `scenarios="ac1,ac2"`, `variances="dpp1_ac1_neg"`
- JSON strings: `measures='[{"name":"Revenue","unit":"EUR"}]'` — validated by functions like `validateMeasureList()`

### Data model

- `TimeChartDataRow` has fields: `rowGroup`, `category`, `subCategory` (grouping dimensions) + `ac1`–`ac4`, `pp1`–`pp4`, `fc1`–`fc4`, `pl1`–`pl4` (16 scenario measures)
- `TimeChart.populateModel()` runs an alasql `GROUP BY` on the date column, summing scenario values
- `StructureChart.populateModel()` runs alasql `GROUP BY` on the `level` dimension
- The result is mapped to `scenario1`–`scenario4` slots as `DataPoint` instances
- `chartMode` enum: `BAR = "bar"`, `LINE = "line"`, `AUTO = "auto"`

### Rendering pipeline

1. `populateModel()` → SQL query → flat row array
2. `createDataRows()` → `[{scenario1: DataPoint, scenario2: DataPoint, ...}]`
3. `drawScenarios()` (bar) or `drawLineScenarios()` (line) → SVG elements via `ScenarioFactory`

---

## 3. New Prop: `stack`

A single JSON-string attribute added to **both** `bn-chart-time` and `bn-chart-structure`.

### TypeScript interface (internal parsed representation)

```typescript
interface StackConfig {
  by: "scenario" | "category" | "subcategory" | "rowgroup";
  mode?: "absolute" | "relative" | "absolute-relative"; // default: "absolute"
  order?: "asc" | "desc" | "dataset";                   // default: "dataset"
}
```

### HTML usage examples

```html
<!-- Stack scenarios on top of each other -->
<bn-chart-time
  scenarios="ac1,ac2,ac3,ac4"
  level="category"
  stack='{"by":"scenario"}'
></bn-chart-time>

<!-- Stack by subcategory, relative within absolute total -->
<bn-chart-time
  scenarios="ac1"
  level="category"
  stack='{"by":"subcategory","mode":"absolute-relative"}'
></bn-chart-time>

<!-- 100% stacked structure chart by category -->
<bn-chart-structure
  scenarios="ac1"
  level="rowgroup"
  stack='{"by":"category","mode":"relative"}'
></bn-chart-structure>

<!-- Stacked area chart (line mode + stack) -->
<bn-chart-time
  scenarios="ac1,ac2,ac3"
  chart-mode="line"
  stack='{"by":"scenario","mode":"absolute"}'
></bn-chart-time>
```

---

## 4. Three Stacking Modes

### 4a. `mode: "absolute"` (default)

Values are stacked additively. The total bar height equals the **sum** of all segments. The y-axis shows absolute units. This is the standard IBCS stacked bar.

```
         ┌───────┐
    120  │  C=30 │
         ├───────┤
         │  B=50 │
         ├───────┤
         │  A=40 │
         └───────┘
         Total=120
```

- Axis: absolute scale (uses `pixelPerUnit`)
- Segment labels: show each segment's own absolute value
- Total label: shown above the topmost segment, shows the sum

### 4b. `mode: "relative"`

Each column/bar is normalized to **100%**. Segment heights represent proportions. The y-axis shows 0%–100%.

```
  100%  ┌───────┐
        │ C=25% │
        ├───────┤
        │ B=42% │
        ├───────┤
        │ A=33% │
   0%   └───────┘
```

- Axis: percentage scale (uses `pixelPerPercentage`)
- Segment labels: show percentages
- Total label: omitted (always 100%)

### 4c. `mode: "absolute-relative"` (combined)

The **total bar height** represents the **absolute** value (just like a normal non-stacked bar). The **segments inside** are divided **proportionally** (relative). This mode answers two questions at once: "How big is the total?" and "What is the composition?"

```
              Total = 120 (absolute height on axis)
         ┌───────────┐
         │  C  25%   │  ← height = 25% of 120 = 30 px-equivalent
         ├───────────┤
         │  B  42%   │  ← height = 42% of 120 = 50 px-equivalent
         ├───────────┤
         │  A  33%   │  ← height = 33% of 120 = 40 px-equivalent
         └───────────┘
```

- Axis: **absolute** scale (uses `pixelPerUnit`) — the bar's total height is its real value
- Segment labels: show **percentages** (proportion of the total)
- Total label: shown above the topmost segment, shows the **absolute** sum
- Visual effect: bars across the chart have different heights (reflecting different totals), but each bar's internal segments are proportionally divided

**Implementation note**: This mode does NOT change the bar height calculation — it is identical to `absolute`. The only difference is in **label formatting**: segment labels display `value / total * 100` as a percentage string, while the total label displays the absolute sum.

---

## 5. Two Stacking Dimensions

### 5a. `by: "scenario"` — Stack scenarios

The scenarios from the `scenarios` prop become additive layers.

- **Data flow**: No change to the SQL aggregation. The existing `scenario1`–`scenario4` `DataPoint` values are rendered as cumulative layers instead of side-by-side.
- **Interaction with `level`**: Unchanged — `level` determines x-axis grouping (TimeChart) or y-axis grouping (StructureChart).
- **Rendering**: Each scenario slot draws its segment starting at `baseline = sum of all previous scenario values`.

### 5b. `by: "category" | "subcategory" | "rowgroup"` — Stack by data dimension

A single scenario is decomposed by the stacking dimension into segments.

- **Data flow change**: The SQL `GROUP BY` must include **both** the display-level dimension **and** the stacking dimension. The query groups by `level, stack.by` instead of just `level`. This produces multiple sub-rows per display group.
- **Rendering**: Within each display group (e.g. one time period or one structure-chart row), the sub-rows become stacked segments.

**Hierarchy constraint**:

```
rowgroup  →  category  →  subcategory
(coarsest)                (finest)
```

`stack.by` must be **finer** than `level`:

| `level` | Valid `stack.by` values |
|---------|----------------------|
| `rowgroup` | `category`, `subcategory` |
| `category` | `subcategory` |
| `subcategory` | _(none — already finest level)_ |
| any | `scenario` _(always valid)_ |

If the combination is invalid, log a warning and fall back to non-stacked rendering.

---

## 6. Interaction with `chartMode`

| `chartMode` | Without `stack` | With `stack` |
|-------------|-----------------|-------------|
| `bar` | Side-by-side bars (current) | **Stacked bars/columns** |
| `line` | Line chart with markers (current) | **Stacked area chart** |
| `auto` | Auto-switch by `maxBars` threshold | Auto-switch stacked-bar ↔ stacked-area |

### Stacked Area Chart (line mode + stack)

When `chartMode="line"` and `stack` is set:

1. Compute cumulative y-values per x-position (bottom-up)
2. Draw SVG `<path>` fills between consecutive cumulative lines
3. Draw the line on top of each area boundary
4. Markers on the topmost line only (to avoid clutter)
5. IBCS area styling: semi-transparent fills using scenario or grayscale palette

```
Stacked Area (by scenario):

      ╱‾‾╲              ← ac2 line
    ╱░░░░░░╲             ← ac2 area fill (between ac1 line and ac2 line)
   ╱▓▓▓▓▓▓▓▓╲            ← ac1 area fill (between baseline 0 and ac1 line)
  ╱▓▓▓▓▓▓▓▓▓▓╲           ← ac1 line
────────────────────
```

**For `mode: "relative"` area chart**: Normalize all layers to sum to 100% at each x-position. The topmost line is always flat at 100%.

**For `mode: "absolute-relative"` area chart**: Area heights are absolute (like `absolute`), but segment labels between areas show percentages.

---

## 7. IBCS Styling Rules for Segments

### When `by: "scenario"`

Reuse existing IBCS scenario notation:

| Layer | Bar Fill | Area Fill | Line/Border |
|-------|----------|-----------|-------------|
| AC (ac1–ac4) | Solid black | Black, opacity 0.3 | Solid line |
| PP (pp1–pp4) | Solid gray `#999` | Gray, opacity 0.3 | Solid gray line |
| FC (fc1–fc4) | Hatched pattern (existing) | Dashed boundary, opacity 0.2 | Dashed line |
| PL (pl1–pl4) | White fill, black border | Thin line boundary, opacity 0.1 | Solid thin line |

When multiple variants of the same type are stacked (e.g. ac1, ac2, ac3, ac4), differentiate by **decreasing opacity/lightness** per variant number.

### When `by: "category" | "subcategory" | "rowgroup"`

Use a sequential **grayscale palette** (IBCS avoids color for categorical distinction):

| Segment Index | Bar Fill | Area Fill |
|---------------|----------|-----------|
| 1 | `#000000` (black) | Black, opacity 0.3 |
| 2 | `#555555` | Dark gray, opacity 0.25 |
| 3 | `#999999` | Medium gray, opacity 0.2 |
| 4 | `#bbbbbb` | Light gray, opacity 0.15 |
| 5+ | Lighter grays / hatched | Lighter, opacity 0.1 |

---

## 8. Label Strategy

| Mode | Segment Labels | Total Label |
|------|---------------|-------------|
| `absolute` | Absolute value (if segment tall enough, min-height threshold) | Sum, above topmost segment |
| `relative` | Percentage value (if segment tall enough) | Omitted (always 100%) |
| `absolute-relative` | **Percentage** value (if segment tall enough) | **Absolute** sum, above topmost segment |
| Area chart (any mode) | Only on topmost series data points | Omitted to avoid clutter |

**Min-height threshold**: A segment label is only rendered if the segment is at least `~18px` tall (approximately 1.5x the font size). This prevents label overlap inside thin segments.

---

## 9. Implementation Steps

### Step 1: Enums and Validation

**File: `src/utils/constants.ts`**

Add:

```typescript
export enum StackBy {
  SCENARIO = "scenario",
  CATEGORY = "category",
  SUBCATEGORY = "subcategory",
  ROWGROUP = "rowgroup",
}

export enum StackMode {
  ABSOLUTE = "absolute",
  RELATIVE = "relative",
  ABSOLUTE_RELATIVE = "absolute-relative",
}

export enum StackOrder {
  ASC = "asc",
  DESC = "desc",
  DATASET = "dataset",
}
```

**File: `src/utils/validate.ts`**

Add `validateStackConfig(value: string): string[]` — follows existing pattern (see `validateMeasureList`). Validates JSON structure, checks `by` against `StackBy`, `mode` against `StackMode`, `order` against `StackOrder`.

### Step 2: Internal Config Model

**File: `src/components/bn-chart-time/utils/model/TimeChartComponentConfig.ts`**

Add:

```typescript
export interface StackConfigParsed {
  by: StackBy;
  mode: StackMode;     // default: ABSOLUTE
  order: StackOrder;   // default: DATASET
}
```

Add field `public stackConfig: StackConfigParsed | null = null;` to `TimeChartComponentConfig`.

In the adapter: parse `data.stack` JSON string → `StackConfigParsed`, with defaults.

Do the same for `StructureChartComponentConfig`.

### Step 3: Component Prop

**Files: `bn-chart-time.tsx`, `bn-chart-structure.tsx`**

Add `@Prop() stack: string = '';` with `@Watch` and validation.

**IMPORTANT — JSDoc requirement**: Every `@Prop()` in both components **must** have an exhaustive JSDoc comment. This applies to the new `stack` prop and to all existing props. The JSDoc must include:

- A clear one-line summary
- A detailed description of the prop's behavior
- Valid values / enum references
- Default value
- Example usage with the HTML attribute
- Interaction notes with other props (where relevant)

Example for the new prop:

```typescript
/**
 * Stacking configuration for the chart as a JSON string.
 *
 * When set, bars/columns are drawn stacked (additive layers) instead of
 * side-by-side. In line mode (`chart-mode="line"`), stacking produces a
 * stacked area chart with filled regions between cumulative lines.
 *
 * **JSON schema:**
 * ```json
 * {
 *   "by": "scenario" | "category" | "subcategory" | "rowgroup",
 *   "mode": "absolute" | "relative" | "absolute-relative",
 *   "order": "asc" | "desc" | "dataset"
 * }
 * ```
 *
 * - `by` (required): The dimension to stack.
 *   - `"scenario"` — stack the scenarios from the `scenarios` prop as layers.
 *   - `"category"` / `"subcategory"` / `"rowgroup"` — decompose a single
 *     scenario by this data dimension. Must be finer than `level`.
 * - `mode` (optional, default `"absolute"`):
 *   - `"absolute"` — additive stacking, axis shows absolute units.
 *   - `"relative"` — 100% stacking, axis shows 0%–100%.
 *   - `"absolute-relative"` — bar height is absolute (real value), but
 *     segment labels inside show percentages. Combines "how big" with
 *     "what composition".
 * - `order` (optional, default `"dataset"`): Segment order within each stack.
 *   `"asc"` / `"desc"` sort segments by value; `"dataset"` preserves the
 *   original data/scenario order.
 *
 * @default '' (empty — no stacking, current side-by-side behavior)
 *
 * @example
 * // Stack scenarios
 * stack='{"by":"scenario"}'
 *
 * @example
 * // Stack by category, relative mode
 * stack='{"by":"category","mode":"relative"}'
 *
 * @example
 * // Absolute-relative: absolute total height, percentage segment labels
 * stack='{"by":"subcategory","mode":"absolute-relative"}'
 */
@Prop() stack: string = '';
```

### Step 4: Data Query Changes

**Files: `TimeChart.ts` → `populateModel()`, `StructureChart.ts` → `populateModel()`**

When `stackConfig.by` is a data dimension (not `"scenario"`):

- Modify the SQL `GROUP BY` to include **both** the level dimension and the stacking dimension
- Return multiple sub-rows per display group
- Tag each sub-row with its segment key (the value of the stacking dimension)

When `stackConfig.by === "scenario"`: No query change needed.

### Step 5: New Rendering Elements

| New File | Purpose |
|----------|---------|
| `src/components/bn-chart-time/utils/elements/StackedColumn.ts` | Draws a single stacked segment (bar with a given baseline offset). Wraps/extends `Column` logic. |
| `src/components/bn-chart-structure/utils/elements/StackedBar.ts` | Same for horizontal structure chart bars. |
| `src/components/bn-chart-time/utils/elements/AreaFill.ts` | SVG `<path>` element filling the area between two cumulative polylines. Accepts upper/lower point arrays. |
| `src/components/bn-chart-time/utils/factories/StackedScenarioFactory.ts` | Orchestrates segment creation: tracks cumulative baselines, creates `StackedColumn` or `AreaFill` instances per layer. |

### Step 6: Rendering Pipeline Changes

**`TimeChart.ts`**:

- In the main draw flow, check `stackConfig`:
  - `null` → existing `drawScenarios()` / `drawLineScenarios()`
  - set → new `drawStackedScenarios()` / `drawStackedAreaScenarios()`
- `drawStackedScenarios()`: iterate layers bottom-to-top, compute cumulative baselines, call `StackedScenarioFactory`
- `drawStackedAreaScenarios()`: compute cumulative y-values per x-position, draw `AreaFill` per layer, then draw boundary lines

**`StructureChart.ts`**:

- Same branching: `drawScenarios()` vs `drawStackedScenarios()`
- Horizontal stacking: cumulative x-offsets instead of y-offsets

**`ElementPositions.ts`** (both charts):

- Add `getStackedColumnBaselineY(cumulativeValue: number): number`
- Add `getStackedBarBaselineX(cumulativeValue: number): number` (structure chart)

### Step 7: Labels for Stacked Mode

- Modify or extend `Label` to support conditional formatting:
  - `absolute` → format as number (existing)
  - `relative` → format as percentage
  - `absolute-relative` → segment labels as percentage, total label as absolute number
- Add min-height check: skip segment label if segment pixel height < threshold (~18px)
- Total label: new `Label` placed above the topmost segment

---

## 10. Files Changed (Summary)

| File | Change Type |
|------|-------------|
| `src/utils/constants.ts` | Add `StackBy`, `StackMode`, `StackOrder` enums |
| `src/utils/validate.ts` | Add `validateStackConfig()` |
| `src/components/bn-chart-time/bn-chart-time.tsx` | Add `@Prop() stack` with JSDoc, watch, validation |
| `src/components/bn-chart-structure/bn-chart-structure.tsx` | Add `@Prop() stack` with JSDoc, watch, validation |
| `src/components/bn-chart-time/utils/model/TimeChartComponentConfig.ts` | Add `StackConfigParsed` interface, field, adapter |
| `src/components/bn-chart-structure/utils/model/StructureChartComponentConfig.ts` | Add `StackConfigParsed` interface, field, adapter |
| `src/components/bn-chart-time/utils/TimeChart.ts` | Add `drawStackedScenarios()`, `drawStackedAreaScenarios()` |
| `src/components/bn-chart-structure/utils/StructureChart.ts` | Add `drawStackedScenarios()` |
| `src/components/bn-chart-time/utils/helper/ElementPositions.ts` | Add stacked baseline helpers |
| `src/components/bn-chart-structure/utils/helper/ElementPositions.ts` | Add stacked baseline helpers |
| **New:** `src/components/bn-chart-time/utils/elements/StackedColumn.ts` | Stacked segment element |
| **New:** `src/components/bn-chart-structure/utils/elements/StackedBar.ts` | Stacked horizontal segment |
| **New:** `src/components/bn-chart-time/utils/elements/AreaFill.ts` | SVG area path between cumulative lines |
| **New:** `src/components/bn-chart-time/utils/factories/StackedScenarioFactory.ts` | Factory for stacked segment creation |

---

## 11. JSDoc Requirement

**All** `@Prop()` declarations in `bn-chart-time.tsx` and `bn-chart-structure.tsx` — both new and existing — must have complete JSDoc with:

1. One-line summary
2. Detailed behavior description
3. Valid values (reference enums where applicable)
4. Default value (`@default`)
5. At least one `@example` showing HTML attribute usage
6. Notes on interaction with other props (if applicable)

This is a hard requirement for this feature branch.

---

## 12. Testing Guidance

- Unit tests for `validateStackConfig()` — valid configs, invalid `by`/`mode`/`order`, malformed JSON, empty string
- Unit tests for cumulative baseline calculation in `ElementPositions`
- Visual/integration test cases:
  - `by: "scenario"`, `mode: "absolute"` with 2, 3, 4 scenarios (bar + line)
  - `by: "category"`, `mode: "relative"` (bar)
  - `by: "subcategory"`, `mode: "absolute-relative"` (bar + line)
  - Edge cases: single segment (should look like normal bar), all-zero values, negative values
  - Invalid `level` / `stack.by` combinations → fallback to non-stacked
