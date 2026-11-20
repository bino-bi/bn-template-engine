# bn-annotation-layer



<!-- Auto Generated Below -->


## Overview

Draws annotation marks over a page: a numbered circle on a data point, a
rounded frame around a value, or a straight arrow between two data points.

The marks are an overlay and not part of the charts, because a chart
rewrites its SVG on every render. Positions come from `getLayoutState()` of
the components, and they are measured again when a component resizes or
draws again. A point with no match, or with more than one, draws nothing:
that is a finding in the data and not a broken page, so the layer does not fail.

Place it in the `annotations` slot of `bn-layout-page`. The numbers are given,
the layer never counts.

A target can sit anywhere in the page, also on the child of one `bn-grid`
cell or of a card in it. The mark then points at the first component in
that element.

## Properties

| Property        | Attribute        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Type     | Default     |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `items`         | `items`          | JSON array of the marks, each one `{ label?, mark?, color?, target, point?, to?, toPoint? }`. `mark` is `marker` (default), `frame` or `arrow`. `target` and `to` name a `data-bino-annotation-target` on this page. `point` and `toPoint` hold raw data values (`rowGroup`, `category`, `subCategory`, `date`, `scenario`, `row`) and a `part` (`element`, `label`, `total`). Without a field they mean the component as a whole. A `frame` with `to` or `toPoint` is one oval around both data points. | `string` | `undefined` |
| `selectedStyle` | `selected-style` | Name of the component style to use (the `name` of a `<bn-component-style>`). Its section `bn-annotation` sets the colours.                                                                                                                                                                                                                                                                                                                                                                               | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
