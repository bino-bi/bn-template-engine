# bn-grid

CSS Grid layout with optional row/column headers and configurable borders. Child components are placed into named slots using a `row-col` naming convention.

## Usage

```html
<bn-grid
  column-headers='["2023", "2024"]'
  row-headers='["Revenue", "Costs"]'
  show-borders="true">

  <bn-chart-time slot="1-1" scenarios="ac1" ...></bn-chart-time>
  <bn-chart-time slot="1-2" scenarios="ac1" ...></bn-chart-time>
  <bn-chart-time slot="2-1" scenarios="ac1" ...></bn-chart-time>
  <bn-chart-time slot="2-2" scenarios="ac1" ...></bn-chart-time>
</bn-grid>
```

### Slot Naming

Slots follow the pattern `row-col` (1-indexed). For a 2x3 grid:

```
slot="1-1"  slot="1-2"  slot="1-3"
slot="2-1"  slot="2-2"  slot="2-3"
```

### Headers with IDs

Use object headers to assign custom slot IDs:

```html
<bn-grid
  column-headers='[{"label":"Q1","id":"q1"}, {"label":"Q2","id":"q2"}]'
  row-headers='[{"label":"Revenue","id":"rev"}, {"label":"Costs","id":"cost"}]'>

  <bn-chart-time slot="rev-q1" ...></bn-chart-time>
  <bn-chart-time slot="rev-q2" ...></bn-chart-time>
  <bn-chart-time slot="cost-q1" ...></bn-chart-time>
  <bn-chart-time slot="cost-q2" ...></bn-chart-time>
</bn-grid>
```

### Grid Title

```html
<bn-grid chart-title="Revenue Overview" column-headers='["Q1","Q2"]' row-headers='["North","South"]'>
  ...
</bn-grid>
```

The title is displayed in the top-left corner cell.

<!-- Auto Generated Below -->


## Overview

CSS Grid layout container with optional row/column headers.

Child components are placed into named slots (`row-col` convention).
Supports configurable borders, title, and header visibility.

## Properties

| Property            | Attribute             | Description                                                                                                                                                                                                                                                                                                                       | Type      | Default     |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `cellGap`           | `cell-gap`            | Gap between cells. Accepts CSS values (e.g., '0px', '8px').                                                                                                                                                                                                                                                                       | `string`  | `"0px"`     |
| `chartTitle`        | `chart-title`         | Title displayed at top-left of the grid.                                                                                                                                                                                                                                                                                          | `string`  | `""`        |
| `columnHeaders`     | `column-headers`      | JSON array defining column headers. Simple format: '["Column 1", "Column 2"]' With IDs: '[{"label": "Column 1", "id": "c1"}, {"label": "Column 2", "id": "c2"}]'                                                                                                                                                                  | `string`  | `"[]"`      |
| `i18nNamespace`     | `i18n-namespace`      | I18n namespace inherited by this grid's children (their own namespace wins). Resolved at runtime from the `i18n-namespace` attribute by the nearest ancestor lookup in `withTranslation`; the grid renders no translated text itself. Declared so the attribute is part of the typed public API rather than a bare DOM attribute. | `string`  | `undefined` |
| `rowHeaderWidth`    | `row-header-width`    | Width of row header column. Accepts CSS values (e.g., 'auto', '100px', '20%').                                                                                                                                                                                                                                                    | `string`  | `"auto"`    |
| `rowHeaders`        | `row-headers`         | JSON array defining row headers. Simple format: '["Row 1", "Row 2"]' With IDs: '[{"label": "Row 1", "id": "r1"}, {"label": "Row 2", "id": "r2"}]'                                                                                                                                                                                 | `string`  | `"[]"`      |
| `selectedStyle`     | `selected-style`      | Name of the component style to use (the `name` of a `<bn-component-style>`). Its values go on top of the default style.                                                                                                                                                                                                           | `string`  | `undefined` |
| `showBorders`       | `show-borders`        | Whether to display divider lines between cells.                                                                                                                                                                                                                                                                                   | `boolean` | `true`      |
| `showColumnHeaders` | `show-column-headers` | Whether to display column headers.                                                                                                                                                                                                                                                                                                | `boolean` | `true`      |
| `showRowHeaders`    | `show-row-headers`    | Whether to display row headers.                                                                                                                                                                                                                                                                                                   | `boolean` | `true`      |


## Methods

### `getLayoutState(options?: LayoutStateOptions) => Promise<ComponentLayoutState>`

Lazily generates this grid's layout state: host box (context- and
component-relative, CSS px), the grid region and row/column counts. With
`detail: "full"` the title, every header and every data cell (with its
slot name) is listed with its geometry.

#### Parameters

| Name      | Type                 | Description                                              |
| --------- | -------------------- | -------------------------------------------------------- |
| `options` | `LayoutStateOptions` | - `{ detail: "summary" \| "full" }`, default `"summary"` |

#### Returns

Type: `Promise<ComponentLayoutState>`




----------------------------------------------

developed by Bino Bi
