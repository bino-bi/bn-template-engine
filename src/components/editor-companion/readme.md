# editor-companion

> **Internal/Advanced** - This component is intended for editor integration and design-time tooling, not for end-user templates.

Headless helper component that exposes methods for querying i18n keys and distinct data values from datasources/datasets. Used by external editors for autocompletion and property pickers.

<!-- Auto Generated Below -->


## Overview

Headless helper component for editor integration.

Exposes public `@Method()` APIs so an external editor can query
i18n keys and distinct data values from datasources/datasets at
design time (e.g. for autocompletion or property pickers).

## Methods

### `getDistinctFromDataSource(dataSourceName: string, key: string) => Promise<unknown[]>`



#### Parameters

| Name             | Type     | Description |
| ---------------- | -------- | ----------- |
| `dataSourceName` | `string` |             |
| `key`            | `string` |             |

#### Returns

Type: `Promise<unknown[]>`



### `getDistinctFromDataset(datasetName: string, key: string) => Promise<unknown[]>`



#### Parameters

| Name          | Type     | Description |
| ------------- | -------- | ----------- |
| `datasetName` | `string` |             |
| `key`         | `string` |             |

#### Returns

Type: `Promise<unknown[]>`



### `internationalizationKeys() => Promise<string[]>`



#### Returns

Type: `Promise<string[]>`




----------------------------------------------

developed by Bino Bi
