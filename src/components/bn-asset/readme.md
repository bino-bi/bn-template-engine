# bn-asset

Registers a named asset (image, icon, etc.) that can be referenced by other components like [`<bn-image>`](../bn-image/readme.md), [`<bn-footer>`](../bn-footer/readme.md), and [`<bn-message>`](../bn-message/readme.md).

## Usage

```html
<bn-asset name="company-logo">
  data:image/png;base64,iVBORw0KGgoAAAANSUhEU...
</bn-asset>

<!-- Reference the asset by name -->
<bn-image source="company-logo"></bn-image>
```

The element body should contain a data URL (base64-encoded) or a file path. The asset is stored by `name` in the scoped asset store and can be resolved by any component within the same `<bn-context>`.

<!-- Auto Generated Below -->


## Properties

| Property            | Attribute | Description                               | Type     | Default     |
| ------------------- | --------- | ----------------------------------------- | -------- | ----------- |
| `name` _(required)_ | `name`    | Unique (template scope) name of the asset | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
