# bn-internationalization

Loads translation overrides and stores them in the scoped i18n store. See the [Internationalization Guide](../../../doc/internationalization.md) for full documentation on translation keys, namespaces, and built-in labels.

## Usage

```html
<!-- Partial override of built-in labels; merges into the _system namespace -->
<bn-internationalization code="en">
  {
    "global": { "ac1": "Actual", "pl1": "Budget", "pp1": "Prior Year" },
    "bn-table": { "thereof": "of which", "SUM_TOTAL": "Grand Total" }
  }
</bn-internationalization>
```

### Props

- `code` - Language code (e.g., `"en"`, `"de"`); must match the `<bn-context>` locale to take effect
- `namespace` - Storage namespace, default `_system` (the bundle all components read). A named namespace is only consulted by elements carrying a matching `namespace` attribute.

The JSON body is provided as text content inside the element. Nested objects are flattened with dot-separated keys (`{"global": {"ac1": …}}` → `global.ac1`) - the namespace is a storage slot, **not** a key prefix. Payloads merge per key into the existing bundle for the same namespace and code. See the [Internationalization Guide](../../../doc/internationalization.md) for available keys.

<!-- Auto Generated Below -->


## Properties

| Property    | Attribute   | Description | Type     | Default     |
| ----------- | ----------- | ----------- | -------- | ----------- |
| `code`      | `code`      |             | `string` | `undefined` |
| `namespace` | `namespace` |             | `string` | `"_system"` |


----------------------------------------------

developed by Bino Bi
