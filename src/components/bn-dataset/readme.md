# bn-dataset

Queries data from one or more [`<bn-datasource>`](../bn-datasource/readme.md) elements using [AlaSQL](https://alasql.org/) and stores the results for visualization components.

The SQL query is provided as the element's text content. When any referenced datasource changes, the query is re-executed automatically.

## Usage

```html
<bn-dataset name="sales" datasources="revenue">
  SELECT category, SUM(ac1) as ac1, SUM(pl1) as pl1
  FROM revenue GROUP BY category
</bn-dataset>
```

### Multiple Datasources

Reference multiple datasources by listing them comma-separated:

```html
<bn-dataset name="combined" datasources="revenue,costs">
  SELECT * FROM revenue UNION ALL SELECT * FROM costs
</bn-dataset>
```

### Static Mode

Bypass the SQL engine and provide raw JSON data directly:

```html
<bn-dataset name="static-data" static="true">
  [
    { "category": "North", "ac1": 100 },
    { "category": "South", "ac1": 200 }
  ]
</bn-dataset>
```

### URL Mode

Place an `http://` or `https://` URL inside the body to fetch the dataset
JSON from a remote endpoint. The fetched payload is written directly to the
`datasets` store (the `static` and `raw` props are ignored in this mode).

```html
<bn-dataset name="remote-data">
  https://example.com/api/sales.json
</bn-dataset>
```

Set the `interval` prop (in seconds) to enable periodic re-fetching:

```html
<bn-dataset name="live-data" interval="30">
  https://example.com/api/sales.json
</bn-dataset>
```

Polling stops automatically when the component is removed from the DOM or
when the body content is changed back to inline SQL/JSON.

### Connecting to Visualizations

Visualization components (`<bn-table>`, `<bn-chart-time>`, `<bn-chart-structure>`) automatically subscribe to datasets. By default they use the first available dataset, or you can specify one explicitly:

```html
<bn-dataset name="revenue" datasources="source1">
  SELECT category, SUM(ac1) as ac1 FROM source1 GROUP BY category
</bn-dataset>

<bn-table datasets="$revenue" scenarios="ac1"></bn-table>
```

### AlaSQL Query Reference

The SQL dialect supports standard SELECT, WHERE, GROUP BY, ORDER BY, UNION, JOIN, and aggregate functions (SUM, COUNT, AVG, MIN, MAX). See the [AlaSQL documentation](https://github.com/AlaSQL/alasql/wiki) for the full syntax reference.

<!-- Auto Generated Below -->


## Overview

Queries data from one or more `bn-datasource` entries via AlaSQL and
writes the result to the `datasets` store (+ computed `DatasetMeta`).

The body content is observed via `withBodyObserver` and may be:
1. **SQL** (default) - AlaSQL query against referenced `datasources`.
2. **Static JSON** - set `static="true"` to bypass SQL and write the
   parsed body directly to the `datasets` store.
3. **URL** - place an `http://`/`https://` URL or a same-origin path
   starting with `/` in the body to fetch JSON from an HTTP endpoint and
   write it to the `datasets` store. Set the `interval` prop (in seconds)
   to enable periodic re-fetching.

## Properties

| Property            | Attribute     | Description                                                                                                                                                                                                                                   | Type      | Default     |
| ------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `datasources`       | `datasources` | Commaseperated list of datasourcees <br /><br />  example: <br />  ```source1,source2```                                                                                                                                                      | `string`  | `""`        |
| `interval`          | `interval`    | Polling interval in **seconds** for URL mode. When set and the body content is a URL, the component re-fetches data at this interval. Has no effect for SQL, inline JSON or compressed content. Set to `0` or leave unset to disable polling. | `number`  | `0`         |
| `name` _(required)_ | `name`        | Unique (template scope) name of the datasource                                                                                                                                                                                                | `string`  | `undefined` |
| `raw`               | `raw`         | When true (default), body content is plain text (SQL or JSON). When false, body content is a compressed payload (`<hash>:<base64_gzip>`).                                                                                                     | `boolean` | `true`      |
| `static`            | `static`      | When true, bypasses the AlaSQL query engine and parses the body content as raw JSON, writing it directly to the datasets store.                                                                                                               | `boolean` | `false`     |


----------------------------------------------

developed by Bino Bi
