# my-component



<!-- Auto Generated Below -->


## Properties

| Property            | Attribute             | Description                                                   | Type                            | Default                                                       |
| ------------------- | --------------------- | ------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `businessUnit`      | `business-unit`       |                                                               | `string`                        | `""`                                                          |
| `i18n`              | --                    |                                                               | `Map<string, string>`           | `new Map<string, string>()`                                   |
| `i18nMode`          | `i18n-mode`           |                                                               | `I18nMode.ALL \| I18nMode.META` | `I18nMode.ALL`                                                |
| `intervalSpanLimit` | `interval-span-limit` |                                                               | `number`                        | `28`                                                          |
| `locale`            | `locale`              | Locale used to format the date-link labels (e.g. "en", "de"). | `string`                        | `"de"`                                                        |
| `measures`          | --                    |                                                               | `MeasureEntry[]`                | `[]`                                                          |
| `order`             | --                    |                                                               | `Order`                         | `{     hierarchy: [],     direction: OrderDirection.ASC,   }` |
| `ruleSetConfig`     | --                    |                                                               | `RuleSetConfig`                 | `undefined`                                                   |
| `scenarios`         | --                    |                                                               | `string[]`                      | `[]`                                                          |
| `timeperiod`        | --                    |                                                               | `TimePeriod`                    | `undefined`                                                   |


## Dependencies

### Used by

 - [bn-title](..)

### Graph
```mermaid
graph TD;
  bn-title --> ibcs-title
  style ibcs-title fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
