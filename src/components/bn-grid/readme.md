# bn-grid

Layouelment to latout child componets in a static grid defined by columns and rows.

Check: https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column

## Mixins
@withStyle

**Example**
```html
 <bn-body>
  <bn-grid rows="1" columns="1" align="stretch" justify="stretch">
    ...
  </bn-grid>
</bn-body>
```

<!-- Auto Generated Below -->


## Properties

| Property            | Attribute             | Description                                                                                                                                                      | Type     | Default  |
| ------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| `cellGap`           | `cell-gap`            | Gap between cells. Accepts CSS values (e.g., '0px', '8px').                                                                                                      | `string` | `'0px'`  |
| `chartTitle`        | `chart-title`         | Title displayed at top-left of the grid.                                                                                                                         | `string` | `''`     |
| `columnHeaders`     | `column-headers`      | JSON array defining column headers. Simple format: '["Column 1", "Column 2"]' With IDs: '[{"label": "Column 1", "id": "c1"}, {"label": "Column 2", "id": "c2"}]' | `string` | `'[]'`   |
| `rowHeaderWidth`    | `row-header-width`    | Width of row header column. Accepts CSS values (e.g., 'auto', '100px', '20%').                                                                                   | `string` | `'auto'` |
| `rowHeaders`        | `row-headers`         | JSON array defining row headers. Simple format: '["Row 1", "Row 2"]' With IDs: '[{"label": "Row 1", "id": "r1"}, {"label": "Row 2", "id": "r2"}]'                | `string` | `'[]'`   |
| `showBorders`       | `show-borders`        | Whether to display divider lines between cells.                                                                                                                  | `string` | `'true'` |
| `showColumnHeaders` | `show-column-headers` | Whether to display column headers.                                                                                                                               | `string` | `'true'` |
| `showRowHeaders`    | `show-row-headers`    | Whether to display row headers.                                                                                                                                  | `string` | `'true'` |


----------------------------------------------

developed by Bino Bi
