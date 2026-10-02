# bn-datasource

Ingests raw JSON data and makes it available for querying by [`<bn-dataset>`](../bn-dataset/readme.md).

Place a JSON array as the element's text content. The data is stored under the given `name` and can be referenced by one or more `<bn-dataset>` components.

## Usage

```html
<bn-datasource name="revenue">
  [
    { "category": "Software", "ac1": 150000, "pl1": 140000 },
    { "category": "Services", "ac1": 90000,  "pl1": 95000 },
    { "category": "Hardware", "ac1": 60000,  "pl1": 55000 }
  ]
</bn-datasource>
```

The JSON must be a valid array of objects. Each object represents one data row. See the [Data Model](../../../doc/data-model.md) for the full field reference.

### Referencing in Datasets

```html
<bn-dataset name="rev-summary" datasources="revenue">
  SELECT category, SUM(ac1) as ac1, SUM(pl1) as pl1
  FROM revenue GROUP BY category
</bn-dataset>
```

### Multiple Datasources

You can define multiple datasources and join them in a single dataset query:

```html
<bn-datasource name="revenue">...</bn-datasource>
<bn-datasource name="costs">...</bn-datasource>

<bn-dataset name="combined" datasources="revenue,costs">
  SELECT * FROM revenue UNION ALL SELECT * FROM costs
</bn-dataset>
```

<!-- Auto Generated Below -->


## Overview

Ingests data and writes it to the scoped `datasources` store.

Data can be provided in three ways:
1. **Inline JSON** - Place JSON text inside the element body (default).
2. **Compressed payload** - Set `raw="false"` and provide `<hash>:<base64_gzip>` format.
3. **URL** - Set the `src` attribute to fetch JSON from an HTTP endpoint.
   Set the `interval` prop (in seconds) to enable periodic re-fetching
   (polling).

The body is always inline data and is ignored while `src` is set.

Other components (e.g. `bn-dataset`) reference the stored data by the
`name` prop to run queries against it.

## Properties

| Property            | Attribute  | Description                                                                                                                                                                                                                 | Type      | Default     |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `interval`          | `interval` | Polling interval in **seconds** for `src`. When set together with `src`, the component re-fetches data at this interval. Has no effect for inline JSON or compressed content. Set to `0` or leave unset to disable polling. | `number`  | `0`         |
| `name` _(required)_ | `name`     | Unique (template scope) name of the datasource.                                                                                                                                                                             | `string`  | `undefined` |
| `raw`               | `raw`      | When true (default), body content is plain JSON text. When false, body content is a compressed payload (`<hash>:<base64_gzip>`). Ignored when `src` is set.                                                                 | `boolean` | `true`      |
| `src`               | `src`      | URL to fetch the JSON from. When set, the body is ignored.                                                                                                                                                                  | `string`  | `undefined` |


----------------------------------------------

developed by Bino Bi
