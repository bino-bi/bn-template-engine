# bn-annotation-list



<!-- Auto Generated Below -->


## Overview

Prints the numbered texts of the annotations of a page: the number in a
circle like the ones on the page (always in the main colour of the style), the bold
title, then the text.

The numbers are given. An entry without a number has no circle, and neither
has an entry whose mark `bn-annotation-layer` could not place on this page.
The other entries keep their numbers: the list never counts again.

## Properties

| Property        | Attribute        | Description                                                                                                                              | Type     | Default     |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `items`         | `items`          | JSON array of the entries, each one `{ label?, title?, html? }`. `html` is inline markup and is sanitized before it is inserted.         | `string` | `undefined` |
| `selectedStyle` | `selected-style` | Name of the component style to use (the `name` of a `<bn-component-style>`). Its section `bn-annotation` sets the colour of the circles. | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
