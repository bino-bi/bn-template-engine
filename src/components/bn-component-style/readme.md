# bn-component-style

Loads a JSON style configuration and stores it in the scoped style store. See the [Theming Guide](../../../doc/theming.md) for full documentation on available style properties and the three-layer styling system.

## Usage

```html
<bn-component-style name="_default">
  {
    "global": {
      "fontFamily": "Arial, sans-serif",
      "fontSizePx": 14,
      "fontColor": "#333333"
    }
  }
</bn-component-style>
```

The `name` prop controls the style layer:

- `"_default"` - Global overrides applied to all components
- Any other name - Named style set for selective use

The JSON body is provided as text content inside the element. See the [Theming Guide](../../../doc/theming.md) for the full list of configurable properties.

<!-- Auto Generated Below -->


## Properties

| Property | Attribute | Description | Type     | Default      |
| -------- | --------- | ----------- | -------- | ------------ |
| `name`   | `name`    |             | `string` | `"_default"` |


----------------------------------------------

developed by Bino Bi
