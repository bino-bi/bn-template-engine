# bn-layout-page



<!-- Auto Generated Below -->


## Properties

| Property                  | Attribute                    | Description | Type                                                                                                                                                       | Default             |
| ------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `footerDisplayPageNumber` | `footer-display-page-number` |             | `boolean`                                                                                                                                                  | `true`              |
| `footerText`              | `footer-text`                |             | `string`                                                                                                                                                   | `undefined`         |
| `layout`                  | `layout`                     |             | `"1-over-2" \| "1-over-3" \| "2-over-1" \| "2x2" \| "3-over-1" \| "3x3" \| "4x4" \| "custom-template" \| "full" \| "split-horizontal" \| "split-vertical"` | `'full'`            |
| `layoutCustomTemplate`    | `layout-custom-template`     |             | `string`                                                                                                                                                   | `"\"a b\" \"c d\""` |
| `layoutFitToContent`      | `layout-fit-to-content`      |             | `boolean`                                                                                                                                                  | `true`              |
| `layoutGridGap`           | `layout-grid-gap`            |             | `string`                                                                                                                                                   | `"0"`               |
| `pageFormat`              | `page-format`                |             | `string`                                                                                                                                                   | `undefined`         |
| `pageOrientation`         | `page-orientation`           |             | `string`                                                                                                                                                   | `undefined`         |
| `styles`                  | `styles`                     |             | `string`                                                                                                                                                   | `undefined`         |
| `titleBusinessUnit`       | `title-business-unit`        |             | `string`                                                                                                                                                   | `''`                |
| `titleDateEnd`            | `title-date-end`             |             | `string`                                                                                                                                                   | `undefined`         |
| `titleDateFormat`         | `title-date-format`          |             | `string`                                                                                                                                                   | `'none'`            |
| `titleDateLink`           | `title-date-link`            |             | `string`                                                                                                                                                   | `'none'`            |
| `titleDateStart`          | `title-date-start`           |             | `string`                                                                                                                                                   | `undefined`         |
| `titleMeasures`           | `title-measures`             |             | `string`                                                                                                                                                   | `undefined`         |
| `titleOrder`              | `title-order`                |             | `string`                                                                                                                                                   | `'category'`        |
| `titleOrderDirection`     | `title-order-direction`      |             | `string`                                                                                                                                                   | `'asc'`             |
| `titleScenarios`          | `title-scenarios`            |             | `string`                                                                                                                                                   | `undefined`         |
| `titleVariances`          | `title-variances`            |             | `string`                                                                                                                                                   | `undefined`         |


## Methods

### `getNumberOfSlot(name: string) => Promise<number>`



#### Returns

Type: `Promise<number>`




## Dependencies

### Depends on

- [bn-page](../bn-page)
- [bn-title](../bn-title)
- [bn-body](../bn-body)
- [bn-footer](../bn-footer)

### Graph
```mermaid
graph TD;
  bn-layout-page --> bn-page
  bn-layout-page --> bn-title
  bn-layout-page --> bn-body
  bn-layout-page --> bn-footer
  bn-title --> ibcs-title
  style bn-layout-page fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
