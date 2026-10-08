# Integration Contract

A tool that prints, embeds or checks a report needs three things from the engine: when the page is ready, where everything is, and what went wrong. This page describes these three interfaces. They keep working in every 1.x version.

## What is stable in 1.x

- The `bn-*` elements listed in the [README](../readme.md), with their attributes, properties and methods.
- The readiness values on `window` and the console line.
- `getLayoutState()`, versioned by `LAYOUT_STATE_VERSION`.
- The `has-error` attribute: the item shape, the id rule and the ids on this page.

Not stable: the `bn-*-renderer` elements, the markup and the CSS classes inside a shadow root, and the text of a message.

## Readiness

The engine tracks every component from the moment it connects. 500 ms after the last component changed its status, it publishes the result. If web fonts are still loading at that point, it waits for them and then for another 500 ms without a change.

| Value | Meaning |
|-------|---------|
| `window.componentRegisterIsRenderedResult` | `undefined` until the first result. Then `true` when every component has rendered, `false` when one is still working or has failed. |
| `window.componentRegisterFailures` | The components that threw, as `{ tag, id, message }`. Empty while a component is still working. |
| Console line `componentRegisterIsRendered: <true or false>` | Written with `console.log` each time the two values are written. |

Read them in this order:

1. The flag is `true`: the page is ready.
2. The failures list is not empty: the page has settled, but a component is broken. Do not wait any longer.
3. Otherwise: wait.

Details:

- `tag` is the element that threw. For a failure while drawing this is an internal element such as `bn-table-renderer`. `id` is the `id` attribute of that element or of the public element around it, or an empty string.
- A component that loads data from a URL (`bn-dataset` or `bn-datasource` with `src`) counts as working until the response is there.
- The values are not cleared when a later change starts a new render. They are written again 500 ms after that render has finished. After you change a page, wait for the next console line.
- A `has-error` item does not make the page "not rendered". It reports a problem with the input, see below.

## Layout state

`getLayoutState()` on `bn-context` returns the position, size and metadata of every rendered component as JSON. The package exports the constant `LAYOUT_STATE_VERSION` and the result types:

```ts
import { LAYOUT_STATE_VERSION, type LayoutState } from "@bino-bi/bn-template-engine";
```

A change that only adds fields keeps the version. A change that removes or renames a field, or changes its meaning, raises it. See [Layout State](layout-state.md) for the schema.

## Diagnostics: the `has-error` attribute

A component that has something to report sets the attribute `has-error` on itself. The value is a JSON array. The attribute is removed when there is nothing to report.

```html
<bn-table has-error='[{"id":"WARN_order","type":"warning","message":"order: invalid value(s) ..."}]'></bn-table>
```

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Names the finding. Stable. One element has at most one item per id. |
| `type` | `"error"` or `"warning"` | An error means the component could not draw what was asked: it shows nothing, an error state, or content that is cut off although the author fixed the size. A warning means it drew something, with a fallback or an automatic choice. |
| `message` | string | Text for a person. It can change between versions and some messages are translated. Do not parse it. |
| `description` | string, optional | More text for a person. Not used today. |

The order of the items has no meaning. `getLayoutState()` returns the same items as `diagnostics` of each component.

### The id rule

An id is a prefix, an underscore and a name. The prefix tells the type:

| Prefix | Type | Meaning |
|--------|------|---------|
| `ERR_` | `error` | Something failed. |
| `WARN_` | `warning` | An input was ignored or looks wrong. |
| `AUTO_` | `warning` | A value was not set, the engine chose one. |

The name is the property name in camelCase when the item is about one attribute (`WARN_orderDirection` for `order-direction`). Otherwise it is a short description in lower snake case (`WARN_value_path`).

### Errors

| Id | On | Meaning |
|----|----|---------|
| `ERR_body` | `bn-dataset`, `bn-datasource`, `bn-internationalization`, `bn-component-style`, `bn-ruleset` | The content of the element is not what the element needs, for example invalid JSON. |
| `ERR_src` | `bn-dataset`, `bn-datasource` | Loading `src` failed. |
| `ERR_name` | `bn-dataset`, `bn-datasource` | The name is used by more than one dataset or datasource. |
| `ERR_sql` | `bn-dataset`, table and charts | A query failed. The table or chart draws nothing. |
| `ERR_filter` | table and charts | The `filter` was rejected. |
| `ERR_keys` | `bn-component-style` | The style has keys that no component reads. |
| `ERR_edges` | `bn-tree` | `edges` is not valid. |
| `ERR_rowHeaders`, `ERR_columnHeaders` | `bn-grid` | The header list is not valid. |
| `ERR_overflow` | `bn-table`, `bn-chart-time`, `bn-chart-structure` | The content is larger than its cell and the author fixed the size (`scale`, `unit-scaling` or `percentage-scaling`). |
| `ERR_xy_json_<prop>`, `ERR_xy_measure_<prop>` | `bn-chart-scatter`, `bn-chart-bubble` | The JSON attribute `<prop>` (`x`, `y`, `size`, `share`, `iso`, `facet`, `labels`, `legend`) cannot be read, or its measure is not valid. |
| `ERR_xy_family`, `ERR_xy_level_order`, `ERR_xy_scale_group`, `ERR_xy_compare_variance`, `ERR_xy_compare_family` | `bn-chart-scatter`, `bn-chart-bubble` | The attributes do not fit together. |
| `ERR_bullet_json_<prop>`, `ERR_bullet_measure_<prop>`, `ERR_bullet_measure_same` | `bn-chart-bullet` | The JSON attribute `<prop>` (`actual`, `target`, `ranges`, `labels`) cannot be read, or the measures are not valid. |

### Warnings about one attribute

`WARN_<property>`: the attribute has a value the component cannot use. The component ignores it and uses its default.

`WARN_aspect`, `WARN_attributes`, `WARN_axisLabelsMode`, `WARN_barColumns`, `WARN_barColumnWidth`, `WARN_cardCustomTemplate`, `WARN_categoryWidth`, `WARN_chartMode`, `WARN_columnthereof`, `WARN_compareWith`, `WARN_dataFormat`, `WARN_dataFormatDigitsDecimal`, `WARN_dataFormatDigitsPercent`, `WARN_dateEnd`, `WARN_dateFormat`, `WARN_dateInterval`, `WARN_dateLink`, `WARN_dateStart`, `WARN_direction`, `WARN_edgeStyle`, `WARN_format`, `WARN_interval`, `WARN_level`, `WARN_levelSpacing`, `WARN_limit`, `WARN_maxBars`, `WARN_measures`, `WARN_measureScale`, `WARN_measureType`, `WARN_nodeSpacing`, `WARN_normalize`, `WARN_order`, `WARN_orderDirection`, `WARN_orientation`, `WARN_pageCustomTemplate`, `WARN_partof`, `WARN_percentageScaling`, `WARN_scale`, `WARN_scenarios`, `WARN_seriesLevel`, `WARN_stack`, `WARN_syncSpaceLeft`, `WARN_thereof`, `WARN_type`, `WARN_unitScaling`, `WARN_variances`.

### Other warnings

| Id | On | Meaning |
|----|----|---------|
| `WARN_overflow` | table, charts, `bn-text`, `bn-tree` | The content is larger than its cell, although the engine chose the size. |
| `WARN_datasets` | table, charts, `bn-text` | `datasets` names a datasource (`$name`) and not a dataset. |
| `WARN_inherited_<prop>` | table, charts, `bn-title` | The keyword `inherited-closest` or `inherited-page` found no value. `<prop>` is `scenarios`, `variances`, `order` or `orderDirection`. |
| `WARN_value`, `WARN_value_path` | `bn-text` | `value` is empty, or a placeholder in it does not resolve. |
| `WARN_blankRowGroup`, `WARN_intervalConflict`, `WARN_intervalNoDate`, `WARN_intervalSetname` | `bn-table` | Rows without a row group, or `interval` does not fit the other attributes or the data. |
| `WARN_variances_scenario` | `bn-chart-time` | A variance uses a scenario that is not drawn. |
| `WARN_stack_dimensions_scenarios` | `bn-chart-time`, `bn-chart-structure` | `stack` by dimensions with more than one scenario. |
| `WARN_xy_fields_<prop>`, `WARN_xy_domain_<prop>` | `bn-chart-scatter`, `bn-chart-bubble` | Fields of a JSON attribute were ignored, or its `min` is not smaller than its `max`. |
| `WARN_xy_duplicate_point`, `WARN_xy_point_clipped`, `WARN_xy_variance_nodata`, `WARN_xy_iso_domain`, `WARN_xy_label_unknown`, `WARN_xy_series_overflow`, `WARN_xy_point_budget` | `bn-chart-scatter`, `bn-chart-bubble` | Findings in the data of the chart. |
| `WARN_bubble_size_negative`, `WARN_bubble_share_range`, `WARN_bubble_scale_overflow` | `bn-chart-bubble` | Findings in the data of the chart. |
| `WARN_bullet_fields_<prop>`, `WARN_bullet_ranges`, `WARN_bullet_ranges_ignored`, `WARN_bullet_target_unavailable` | `bn-chart-bullet` | Fields of a JSON attribute were ignored, or attributes that do not fit together. |
| `WARN_bullet_target_missing`, `WARN_bullet_target_invalid`, `WARN_bullet_actual_negative`, `WARN_bullet_mixed_operation`, `WARN_bullet_target_none` | `bn-chart-bullet` | Findings in the data of the chart. |
| `WARN_reserved_name`, `WARN_empty_name`, `WARN_numeric_name`, `WARN_invalid_value`, `WARN_duplicate_group` | `bn-scaling-group` | The group has no usable name or value, or its name is used twice. |

### Automatic choices

| Id | Meaning |
|----|---------|
| `AUTO_scale` | The component was scaled to fit its cell. |
| `AUTO_unitScaling`, `AUTO_percentageScaling` | The bar scaling was not set or not usable. The message has the value that was chosen. |
| `AUTO_scenarios`, `AUTO_level`, `AUTO_order`, `AUTO_dateInterval`, `AUTO_actual`, `AUTO_target` | The attribute was not set. The value was taken from the dataset. |

A new version can add ids. It does not rename or remove one of these, and it does not change the type of one.
