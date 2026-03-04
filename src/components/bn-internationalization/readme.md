# bn-internationalization

Loads translation overrides and stores them in the scoped i18n store. See the [Internationalization Guide](../../../doc/internationalization.md) for full documentation on translation keys, namespaces, and built-in labels.

## Usage

```html
<!-- Override global scenario labels -->
<bn-internationalization code="en">
  {
    "ac1": "Actual",
    "pl1": "Budget",
    "pp1": "Prior Year"
  }
</bn-internationalization>

<!-- Override table-specific labels -->
<bn-internationalization code="en" namespace="bn-table">
  {
    "there_of": "of which",
    "SUM_TOTAL": "Grand Total"
  }
</bn-internationalization>
```

### Props

- `code` — Language code (e.g., `"en"`, `"de"`)
- `namespace` — Translation namespace. When set, all keys are prefixed with `"namespace."` (e.g., `"bn-table.there_of"`)

The JSON body is provided as text content inside the element. Nested objects are flattened automatically. See the [Internationalization Guide](../../../doc/internationalization.md) for available keys.

<!-- Auto Generated Below -->


## Properties

| Property    | Attribute   | Description | Type     | Default     |
| ----------- | ----------- | ----------- | -------- | ----------- |
| `code`      | `code`      |             | `string` | `undefined` |
| `namespace` | `namespace` |             | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
