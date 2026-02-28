# bn-text

Component to place Text

## Mixins
@withStyle
@withDataset

**Example**

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
| `scale`  | `scale`   | Controls font-size scaling relative to the available parent space. Scaling considers both width and height — the tighter constraint wins.  \| Value          \| Behavior                                                       \| \|----------------\|----------------------------------------------------------------\| \| not set / `""` \| Auto-scale to fit, emit `AUTO_scale` warning with applied factor \| \| `"none"`       \| No scaling; emit `WARN_overflow` warning if content overflows  \| \| `"auto"`       \| Auto-scale to fit, silent (no warning)                         \| \| `"0.5"`, `"1.2"`, … \| Apply `baseFontSize × factor`; emit `WARN_overflow` if still overflows \|  Invalid values (negative, non-numeric, non-keyword) fall back to the default (auto + warning) and emit an `ERR_scale` warning. | `string` | `undefined` |
| `value`  | `value`   | Template string rendered as HTML. Supports JavaScript template literal syntax — use `${data.<dataset>}` to interpolate dataset values and `${t('<key>')}` for translated strings.  The template is evaluated in a sandboxed scope (only `data` and `t` are accessible; globals like `window`/`document` are blocked) and the output is sanitized against XSS (only safe HTML tags and attributes are kept).                                                                                                                                                                                                                                                                                                                                                                                                                         | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
