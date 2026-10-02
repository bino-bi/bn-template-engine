# bn-text

Template-driven text block with dataset value interpolation and translation support. Output is sanitized against XSS.

## Usage

```html
<bn-text value="Revenue: ${data.sales[0].ac1}"></bn-text>
```

### Dataset Interpolation

Access dataset values using `${data.<datasetName>}`:

```html
<bn-text value="Total: ${data.revenue[0].ac1} EUR"></bn-text>
```

The `data` object contains all datasets keyed by name, each as an array of rows.

### Translations

Use the `t()` function to resolve translation keys:

```html
<bn-text value="${t('custom.labels.revenue')}: ${data.revenue[0].ac1}"></bn-text>
```

### HTML Content

The template output is rendered as HTML. Safe tags (`<b>`, `<i>`, `<br>`, `<span>`, etc.) are allowed; unsafe content is stripped:

```html
<bn-text value="<b>Revenue</b>: ${data.revenue[0].ac1}"></bn-text>
```

### Scaling

```html
<!-- Auto-scale to fit parent (silent) -->
<bn-text scale="auto" value="..."></bn-text>

<!-- No scaling -->
<bn-text scale="none" value="..."></bn-text>

<!-- Fixed scale factor -->
<bn-text scale="1.5" value="..."></bn-text>
```

<!-- Auto Generated Below -->


## Overview

Renders a template-driven text block with dataset interpolation.

The `value` prop is evaluated as a JavaScript template literal in a
sandboxed scope (`data` and `t` are available) and sanitized against
XSS before being injected as HTML. Supports auto-scaling to fit the
parent container.

## Properties

| Property | Attribute | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Type     | Default     |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `scale`  | `scale`   | Controls font-size scaling relative to the available parent space. Scaling considers both width and height - the tighter constraint wins.  \| Value          \| Behavior                                                       \| \|----------------\|----------------------------------------------------------------\| \| not set / `""` \| Auto-scale to fit, emit `AUTO_scale` warning with applied factor \| \| `"none"`       \| No scaling; emit `WARN_overflow` warning if content overflows  \| \| `"auto"`       \| Auto-scale to fit, silent (no warning)                         \| \| `"0.5"`, `"1.2"`, … \| Apply `baseFontSize × factor`; emit `WARN_overflow` if still overflows \|  Invalid values (negative, non-numeric, non-keyword) fall back to the default (auto + warning) and emit an `ERR_scale` warning. | `string` | `undefined` |
| `value`  | `value`   | Template string rendered as HTML. Supports JavaScript template literal syntax - use `${data.<dataset>}` to interpolate dataset values and `${t('<key>')}` for translated strings.  The template is evaluated in a sandboxed scope (only `data` and `t` are accessible; globals like `window`/`document` are blocked) and the output is sanitized against XSS (only safe HTML tags and attributes are kept).                                                                                                                                                                                                                                                                                                                                                                                                                         | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
