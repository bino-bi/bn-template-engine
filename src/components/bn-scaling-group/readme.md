# bn-scaling-group



<!-- Auto Generated Below -->


## Overview

Defines a named scaling value that chart and table components can reference
via their `unit-scaling` or `percentage-scaling` attributes, or a bubble
chart via its `size` spec's `group` key.

Multiple components sharing the same group name will use the same scaling
value, allowing synchronized scaling across an entire page or section.

The reserved name `"auto"` is not allowed, and neither is a name that would
parse as a number/SI value (e.g. `"1M"`); both are rejected with a warning.

## Properties

| Property             | Attribute | Description                                                                                                                                                                                                                                                                                                                                                                                                  | Type               | Default     |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------- |
| `name` _(required)_  | `name`    | Unique name identifying this scaling group. Components reference this name in their `unit-scaling` or `percentage-scaling` attributes, or in a bubble chart's `size.group`.  The name `"auto"` is reserved, and names that parse as a number/SI value (`"100"`, `"1M"`) are rejected - they would be ambiguous with a literal scaling value.                                                                 | `string`           | `undefined` |
| `value` _(required)_ | `value`   | The scaling value: a positive number with optional SI suffix (`k`/`K` = 1e3, `M` = 1e6, `G` = 1e9, `T` = 1e12), e.g. `"250k"` or `2.5`.  The unit depends on which attribute references this group: - from `unit-scaling`: data units per 1 em of bar length - from `percentage-scaling`: percentage points per 1 em of pin length - from a bubble chart's `size.group`: data units per 1 em² of bubble area | `number \| string` | `undefined` |


----------------------------------------------

developed by Bino Bi
