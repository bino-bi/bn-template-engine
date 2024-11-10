# bn-chart-structure

**bn-structure**  is a report element and renderes data as structure-chart.
It supports the main chart with up to 4 scenarios and additonal variance charts (unlimited)

The **bn-chart-structure** can be used within the bn-content element

## Mixins
@withStyle
@withComponentStatus
@withDataset
@withTranslation

**Example**
```html
 <bn-body>
      <bn-chart-structure
        internationalisation = null
        internationalisationMode = 'meta'
        level='category'
        order='category'
        order-direction='asc'
        scenarios='ac1,py1'
        styles=''
        unit-scaling='10'
        datasets="$marktwert"
      >
      </bn-chart-structure>
</bn-body>
```
**Output**
![bn-chart example](./img/bn-chart-example.png)


**Custom BinoChartSyles Example**
```json
     {
      "scaleFactors": {
        barWidthYOffset: 0.95,
        fontNettoHeight: 0.7,
        needleWidthOffset: 0.7,
        barHeightOffset: 0.4,
        barWidthOffset: 0.3,
        pt2Px: 1.2,
        axisWidth: 0.1,
        rowHeight: 1.8,
      },
      "fontStyles": {
        font: "16px Calibri",
        size: 16,
        color: "#000000",
        backgroud: "#ffffff",
        leading: 1.8,
      },
      "axisStyles": {
        ac: {stroke: "#121212", fill: "#121212", width: 0.1},
        fc: {stroke: "#121212", fill: "#ffffff", width: 0.1, "dasharray": "10 5 5 5"},
        pp: {stroke: "#606060", fill: "#606060", width: 0.1},
        pl: {stroke: "#121212", fill: "#ffffff", width: 0.1},
      },
      "barStyles": {
        ac: {stroke: "#121212", fill: "#121212", width: 0.1},
        fc: {stroke: "#121212", fill: "#ffffff", width: 0.5, fillpattern: "fc"},
        pp: {stroke: "#606060", fill: "#606060", width: 0.1},
        pl: {stroke: "#121212", fill: "#ffffff", width: 0.1},
      },
      "varianceStyles": {
        pos: {stroke: "#AAFF00", fill: "#AAFF00", width: 0.1},
        neg: {stroke: "#FF0A0A", fill: "#FF0A0A", width: 0.1},
      },
      "padding": {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
      },
      "pattern": new Map([["marker-up", {foreground: "", background: "", bgOffset: 0}],
        ["marker-down", {foreground: "", background: "", bgOffset: 0}]]),
    }
```
<!-- Auto Generated Below -->


## Properties

| Property             | Attribute              | Description | Type                                                                                                                                                                                              | Default                                                       |
| -------------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `chartTitle`         | `chart-title`          |             | `string`                                                                                                                                                                                          | `""`                                                          |
| `data`               | --                     |             | `StructureChartDataRow[]`                                                                                                                                                                         | `[]`                                                          |
| `dataFormatDigits`   | --                     |             | `DataFormatDigits`                                                                                                                                                                                | `{ percent: 2, decimal: 1 }`                                  |
| `filter`             | `filter`               |             | `string`                                                                                                                                                                                          | `""`                                                          |
| `hideCategories`     | `hide-categories`      |             | `boolean`                                                                                                                                                                                         | `false`                                                       |
| `i18n`               | --                     |             | `Map<string, string>`                                                                                                                                                                             | `new Map()`                                                   |
| `level`              | `level`                |             | `AggregationLevel.CATEGORY \| AggregationLevel.CATEGORYINDEX \| AggregationLevel.ROWGROUP \| AggregationLevel.ROWGROUPINDEX \| AggregationLevel.SUBCATEGORY \| AggregationLevel.SUBCATEGORYINDEX` | `AggregationLevel.CATEGORY`                                   |
| `limit`              | `limit`                |             | `number`                                                                                                                                                                                          | `0`                                                           |
| `measureScale`       | `measure-scale`        |             | `string`                                                                                                                                                                                          | `"_"`                                                         |
| `measureUnit`        | `measure-unit`         |             | `string`                                                                                                                                                                                          | `""`                                                          |
| `order`              | --                     |             | `Order`                                                                                                                                                                                           | `{     hierarchy: [],     direction: OrderDirection.ASC,   }` |
| `pixelPerPercentage` | `pixel-per-percentage` |             | `number`                                                                                                                                                                                          | `50`                                                          |
| `pixelPerUnit`       | `pixel-per-unit`       |             | `number`                                                                                                                                                                                          | `10`                                                          |
| `scenarios`          | --                     |             | `string[]`                                                                                                                                                                                        | `[]`                                                          |
| `showMeasureScale`   | `show-measure-scale`   |             | `boolean`                                                                                                                                                                                         | `true`                                                        |
| `styles`             | --                     |             | `StructureChartStyle`                                                                                                                                                                             | `undefined`                                                   |
| `variances`          | --                     |             | `string[]`                                                                                                                                                                                        | `[]`                                                          |


## Dependencies

### Used by

 - [bn-chart-structure](.)
 - [test-runner-card](../../test-runner)
 - [test-runner-chart](../../test-runner)

### Graph
```mermaid
graph TD;
  bn-chart-structure --> ibcs-chart-structure
  test-runner-card --> ibcs-chart-structure
  test-runner-chart --> ibcs-chart-structure
  style ibcs-chart-structure fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
