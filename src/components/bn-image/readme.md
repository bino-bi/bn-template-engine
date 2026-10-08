# bn-image

Displays an image from a URL or a registered [`<bn-asset>`](../bn-asset/readme.md).

## Usage

```html
<!-- From URL -->
<bn-image source="https://example.com/logo.png"></bn-image>

<!-- From a registered asset -->
<bn-asset name="logo">data:image/png;base64,...</bn-asset>
<bn-image source="logo"></bn-image>
```

If `source` is an HTTP/HTTPS URL, it is used directly. Otherwise, it is looked up in the asset store by name.

<!-- Auto Generated Below -->


## Properties

| Property        | Attribute        | Description                                                                                                                                                                                                                        | Type     | Default     |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `selectedStyle` | `selected-style` | Name of the component style to use (the `name` of a `<bn-component-style>`). Its values go on top of the default style.                                                                                                            | `string` | `undefined` |
| `source`        | `source`         | /**    Url of the image.    <br />    if not http it looks up the url in the components asset folder    <br />    If empty string (`''` or `null`) the image is omitted   <br /><br />    example:<br /> ```debug/concordia.png``` | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
