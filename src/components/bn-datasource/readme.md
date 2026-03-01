# bn-datasource

@Internal 
In bn-datasource body a json array object stores the data 

<!-- Auto Generated Below -->


## Overview

Ingests raw JSON data and writes it to the scoped `datasources` store.

Data is provided as JSON text inside the element body (observed via
`withBodyObserver`). Other components (e.g. `bn-dataset`) reference
the stored data by the `name` prop to run queries against it.

## Properties

| Property            | Attribute | Description                                    | Type     | Default     |
| ------------------- | --------- | ---------------------------------------------- | -------- | ----------- |
| `name` _(required)_ | `name`    | Unique (template scope) name of the datasource | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
