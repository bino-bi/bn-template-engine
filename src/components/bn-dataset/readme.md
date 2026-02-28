# bn-dataset

@Internal
Maps data-columns between DataSource and report components.
The SQL for the transformation is in the db-dataset body.


**Example**
```html
<bn-dataset datasources="examplesource" name="example">
  SELECT * from examplesource;
</bn-dataset>
```
<!-- Auto Generated Below -->


## Overview

Queries data from one or more `bn-datasource` entries via AlaSQL and
writes the result to the `datasets` store (+ computed `DatasetMeta`).

The SQL query is provided as text inside the element body (observed via
`withBodyObserver`). When any referenced datasource changes, the query
is re-executed automatically. Set `static="true"` to bypass the SQL
engine and treat the body content as raw JSON data directly.

## Properties

| Property            | Attribute     | Description                                                                                                                     | Type      | Default     |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `datasources`       | `datasources` | Commaseperated list of datasourcees <br /><br />  example: <br />  ```source1,source2```                                        | `string`  | `""`        |
| `name` _(required)_ | `name`        | Unique (template scope) name of the datasource                                                                                  | `string`  | `undefined` |
| `static`            | `static`      | When true, bypasses the AlaSQL query engine and parses the body content as raw JSON, writing it directly to the datasets store. | `boolean` | `false`     |


----------------------------------------------

developed by Bino Bi
