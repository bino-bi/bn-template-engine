# bn-chart-tree



<!-- Auto Generated Below -->


## Properties

| Property             | Attribute        | Description                                                                                                                                                                                                                                                     | Type                                     | Default        |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------- |
| `direction`          | `direction`      | Layout direction of the tree. - 'ltr': left to right (root on left) - 'rtl': right to left (root on right) - 'ttb': top to bottom (root on top) - 'btt': bottom to top (root on bottom)                                                                         | `"btt" \| "ltr" \| "rtl" \| "ttb"`       | `'ltr'`        |
| `edgeStyle`          | `edge-style`     | Edge line style. - 'straight': direct line between nodes - 'orthogonal': right-angle lines (default) - 'curved': smooth bezier curves                                                                                                                           | `"curved" \| "orthogonal" \| "straight"` | `'orthogonal'` |
| `edges` _(required)_ | `edges`          | JSON string defining connections between nodes. Each edge specifies a source (from) and target (to) node ID, with optional operator and styling.  Example: ```json [   {"from":"roi","to":"ros","operator":"x"},   {"from":"roi","to":"capital-turnover"} ] ``` | `string`                                 | `undefined`    |
| `levelSpacing`       | `level-spacing`  | Spacing between hierarchy levels in pixels.                                                                                                                                                                                                                     | `number`                                 | `60`           |
| `nodeSpacing`        | `node-spacing`   | Spacing between sibling nodes in pixels.                                                                                                                                                                                                                        | `number`                                 | `20`           |
| `showOperators`      | `show-operators` | Show operator labels between sibling nodes.                                                                                                                                                                                                                     | `string`                                 | `'true'`       |


----------------------------------------------

developed by Bino Bi
