# bn-title

The header element **bn-title** used in the top of the page is placed in front of <bn-body></bn-body> element.

**Example**
```html
    <bn-title
      business-unit='Beispiel Report'
      scenarios='ac1, fc1, pp1,dac1_pp1_neg'
      order='dac1_pp1_neg'
      date-start='2019-12-31'
      date-end='2020-12-31'
      date-format=''
      date-link='interval'
      measures='[{"name": "Marktwert2", "unit": "mEUR"},{"name": "Marktwert", "unit": "%"}]'
    >
    </bn-title>
```
**Output**

![bn-title example](./img/bn-title-example.png)


## Mixins
@withStyle
@withComponentStatus
@withTranslation


<!-- Auto Generated Below -->


## Overview

Composes an IBCS-compliant report title block.

Renders business unit, scenario labels, measure names with units, a
formatted date/time period, and sort-order indicators as a structured
header. Delegates the actual layout to the inner `ibcs-title` element.

## Properties

| Property         | Attribute         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Type     | Default      |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| `businessUnit`   | `business-unit`   | Name of the business unit displayed in card header. If empty string (`''` or `null`) the business unit row is omitted                                                                                                                                                                                                                                                                                                                                                                                                                              | `string` | `""`         |
| `dateEnd`        | `date-end`        | String of end date <br /><br /> format:<br /> ``` yyyy-MM-dd ```                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `string` | `undefined`  |
| `dateFormat`     | `date-format`     | Date format <br /><br /> values:<br /> ``` year // quarter // month // week // day // hour // auto // none ``` <br /><br />  detail:<br /> ```year: "YYYY"```<br /> ```quarter:  "Q[Q] YYYY"```<br /> ```month: "MMM YYYY"```<br /> ```week: "[KW]WW YYYY"```<br /> ```day: "DD.MM.YYYY"```<br /> ```time: "DD.MM.YYYY HH:mm:ss"```<br /> ```none: "DD.MM.YYYY"```<br />                                                                                                                                                                           | `string` | `"none"`     |
| `dateLink`       | `date-link`       | Format in which the start and end date are linked. <br /><br /> If empty string (`''` or `null`) the date row is omitted <br /><br /> values:<br /> ``` avg // interval // cum // start // end // ytd // ytg // cum // mat // none // null``` <br /><br />  detail:<br /> ```avg: "Ø[DATE]"```<br /> ```interval: "[DATE]..[DATE2]"```<br /> ```start: ".[DATE]"```<br /> ```end: "[DATE]."```<br /> ```ytd: "_[DATE]"```<br /> ```ytg: "[DATE]_"```<br /> ```cum: "[DATE]_[DATE2]"```<br /> ```mat: "~[DATE]"```<br /> ```none: "[DATE]"```<br /> | `string` | `"none"`     |
| `dateStart`      | `date-start`      | String of start date <br /><br /> format:<br /> ``` yyyy-MM-dd ```                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `string` | `undefined`  |
| `measures`       | `measures`        | Stringified Array of measure objects {name: string, unit: string} <br /><br /> If all units are the same the redundant units will be reduced and names concatenated.<br /> If unit is empty string (`''` or `null`) the row is omitted <br /><br /> example:<br /> ``` [{"name": "Bruttoumsatz", "unit": "mEUR"}] ```                                                                                                                                                                                                                              | `string` | `undefined`  |
| `order`          | `order`           | List of the primary scenarios on which the order direction are applied. <br /><br /> If order is set to a scenario it has also exists in scenariolist.<br /> If order is empty string (`''` or `null`) the order arrow is omitted <br /><br /> values:<br /> ``` category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac // fc // py // pl // null ```                                                                                                                                                                            | `string` | `"category"` |
| `orderDirection` | `order-direction` | Sets sorting order directon <br /><br /> values:<br /> ``` asc // desc ```                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `string` | `"asc"`      |
| `scenarios`      | `scenarios`       | List of scenarios displayed in card header. <br /><br /> If scenarios is empty string (`''` or `null`) the scenarios are omitted <br /><br /> values:<br /> ```ac // fc // py // pl // null```                                                                                                                                                                                                                                                                                                                                                     | `string` | `undefined`  |
| `variances`      | `variances`       | <br /> <br /> List of Variances The additonal variances which are calculated form the given scenarios. the scenarios used in the variances have also be defined in the *scenarios* property. <br /> <br /> the variance is defiend as  (Scenario A -  ScenarioB) neu. neg and pos post fix defines which value is *good* a negative or a positive value. <br /> <br /> if empty variance charts are hidden <br /> <br /> each variance creates a chart <br /> <br /> pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```                  | `string` | `undefined`  |


## Dependencies

### Used by

 - [bn-layout-card](../bn-layout-card)
 - [bn-layout-page](../bn-layout-page)

### Depends on

- [ibcs-title](ibcs-title)

### Graph
```mermaid
graph TD;
  bn-title --> ibcs-title
  bn-layout-card --> bn-title
  bn-layout-page --> bn-title
  style bn-title fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

developed by Bino Bi
