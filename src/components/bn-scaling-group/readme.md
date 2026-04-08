# bn-scaling-group



<!-- Auto Generated Below -->


## Overview

Defines a named scaling value that chart and table components can reference
via their `unit-scaling` or `percentage-scaling` attributes.

Multiple components sharing the same group name will use the same scaling
value, allowing synchronized scaling across an entire page or section.

The reserved name `"auto"` is not allowed and will be ignored with a warning.

## Properties

| Property             | Attribute | Description                                                                                                                                                                               | Type     | Default     |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `name` _(required)_  | `name`    | Unique name identifying this scaling group. Components reference this name in their `unit-scaling` or `percentage-scaling` attributes.  The name `"auto"` is reserved and cannot be used. | `string` | `undefined` |
| `value` _(required)_ | `value`   | The scaling value (pixels per data unit or pixels per percentage point, depending on which attribute references this group).                                                              | `number` | `undefined` |


----------------------------------------------

developed by Bino Bi
