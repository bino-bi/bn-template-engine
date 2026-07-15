# ibcs-chart-bubble



<!-- Auto Generated Below -->


## Overview

Inner presentational element of `bn-chart-bubble`: owns the
{@link BubbleChart} orchestrator and emits its SVG string. All props
arrive validated and parsed from the facade.

## Properties

| Property              | Attribute            | Description                                                                               | Type                                        | Default      |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | ------------ |
| `aspect`              | `aspect`             | Plot aspect ratio, width/height.                                                          | `number`                                    | `16 / 9`     |
| `chartTitle`          | `chart-title`        |                                                                                           | `string`                                    | `""`         |
| `compareFamily`       | `compare-family`     | Comparison scenario family, or `null` (10D overlay).                                      | `string`                                    | `null`       |
| `containerWidth`      | `container-width`    |                                                                                           | `number`                                    | `0`          |
| `dataVersion`         | `data-version`       | Bumped by the facade when the dataset changes; triggers re-render.                        | `number`                                    | `0`          |
| `errors`              | --                   | The facade's error dispatcher — data warnings are synced through it (stable ids).         | `ErrorDispatcher`                           | `undefined`  |
| `facet`               | --                   |                                                                                           | `FacetConfig`                               | `null`       |
| `filter`              | `filter`             |                                                                                           | `string`                                    | `""`         |
| `i18n`                | --                   |                                                                                           | `Map<string, string>`                       | `new Map()`  |
| `labels` _(required)_ | --                   |                                                                                           | `LabelConfig`                               | `undefined`  |
| `legend` _(required)_ | --                   |                                                                                           | `LegendConfig`                              | `undefined`  |
| `limit`               | `limit`              |                                                                                           | `number`                                    | `0`          |
| `pointLevel`          | `point-level`        |                                                                                           | `"category" \| "rowGroup" \| "subCategory"` | `"category"` |
| `ruleSetConfig`       | --                   |                                                                                           | `RuleSetConfig`                             | `undefined`  |
| `seriesLevel`         | `series-level`       |                                                                                           | `"category" \| "rowGroup"`                  | `null`       |
| `share`               | --                   |                                                                                           | `ShareConfig`                               | `null`       |
| `size` _(required)_   | --                   |                                                                                           | `SizeConfig`                                | `undefined`  |
| `sizeAreaPerUnit`     | `size-area-per-unit` | Scaling-group mode: area px² per data unit (0 = local sizing).                            | `number`                                    | `0`          |
| `styles`              | --                   |                                                                                           | `XYChartStyle`                              | `undefined`  |
| `tableName`           | `table-name`         | Name of the dataset (table or view in the scoped alasql database).                        | `string`                                    | `""`         |
| `translate`           | --                   | Facade-bound translator for warning messages (resolves `.key` in the facade's namespace). | `(key: string, data?: object) => string`    | `undefined`  |
| `x` _(required)_      | --                   |                                                                                           | `AxisConfig`                                | `undefined`  |
| `y` _(required)_      | --                   |                                                                                           | `AxisConfig`                                | `undefined`  |


## Dependencies

### Used by

 - [bn-chart-bubble](.)

### Graph
```mermaid
graph TD;
  bn-chart-bubble --> ibcs-chart-bubble
  style ibcs-chart-bubble fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
