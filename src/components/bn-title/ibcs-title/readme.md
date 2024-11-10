# my-component



<!-- Auto Generated Below -->


## Properties

| Property            | Attribute             | Description | Type                            | Default                                                       |
| ------------------- | --------------------- | ----------- | ------------------------------- | ------------------------------------------------------------- |
| `businessUnit`      | `business-unit`       |             | `string`                        | `''`                                                          |
| `i18n`              | --                    |             | `Map<string, string>`           | `new Map<string, string>()`                                   |
| `i18nMode`          | `i18n-mode`           |             | `I18nMode.ALL \| I18nMode.META` | `I18nMode.ALL`                                                |
| `intervalSpanLimit` | `interval-span-limit` |             | `number`                        | `28`                                                          |
| `measures`          | --                    |             | `MeasureEntry[]`                | `[]`                                                          |
| `order`             | --                    |             | `Order`                         | `{     hierarchy: [],     direction: OrderDirection.ASC,   }` |
| `scenarios`         | --                    |             | `string[]`                      | `[]`                                                          |
| `timeperiod`        | --                    |             | `TimePeriod`                    | `undefined`                                                   |


## Methods

### `setBusinessUnit(businessUnit: string) => Promise<void>`



#### Parameters

| Name           | Type     | Description |
| -------------- | -------- | ----------- |
| `businessUnit` | `string` |             |

#### Returns

Type: `Promise<void>`



### `setProps(data: Partial<IbcsTitle>) => Promise<void>`



#### Parameters

| Name   | Type                                                                                                                                                                                                                                                                                                                                                                                                                                          | Description |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `data` | `{ businessUnit?: string; setBusinessUnit?: (businessUnit: string) => Promise<void>; setProps?: (data: Partial<IbcsTitle>) => Promise<void>; scenarios?: string[]; measures?: MeasureEntry[]; timeperiod?: TimePeriod; intervalSpanLimit?: number; order?: Order; i18n?: Map<string, string>; i18nMode?: I18nMode; render?: () => any; componentWillLoad?: () => void; componentWillUpdate?: () => void; componentWillRender?: () => void; }` |             |

#### Returns

Type: `Promise<void>`




## Dependencies

### Used by

 - [bn-title](..)
 - [test-runner-card](../../../test-runner)
 - [test-runner-title](../../../test-runner)

### Graph
```mermaid
graph TD;
  bn-title --> ibcs-title
  test-runner-card --> ibcs-title
  test-runner-title --> ibcs-title
  style ibcs-title fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
