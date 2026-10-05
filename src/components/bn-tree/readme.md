# bn-tree

Hierarchical tree diagram with SVG edge connections and optional operator labels between nodes. Useful for visualizing DuPont analysis trees, organizational structures, or any parent-child decomposition.

## Usage

```html
<bn-tree
  edges='[
    {"from": "roi", "to": "ros", "operator": "x", "label": "x"},
    {"from": "roi", "to": "turnover"}
  ]'
  direction="ltr"
  edge-style="orthogonal">

  <div slot="roi">ROI: 15%</div>
  <div slot="ros">ROS: 10%</div>
  <div slot="turnover">Capital Turnover: 1.5x</div>
</bn-tree>
```

### Node Slots

Each node is provided as a named slot matching the node ID used in `edges`:

```html
<bn-tree edges='[{"from":"a","to":"b"},{"from":"a","to":"c"}]'>
  <div slot="a">Parent</div>
  <div slot="b">Child 1</div>
  <div slot="c">Child 2</div>
</bn-tree>
```

### Edge Definition

Each edge object supports:

| Property | Type | Description |
|----------|------|-------------|
| `from` | `string` | Parent node ID |
| `to` | `string` | Child node ID |
| `operator` | `string` | Operator symbol between siblings (e.g., `"x"`, `"+"`, `"-"`) |
| `label` | `string` | Display label for the operator |
| `style` | `string` | Edge line style (e.g., `"dashed"`) |

The edges must form one tree below a single root. A node may have several
parents, but an edge must not lead back to a node above it. A cycle, or a node
that is not connected to the root, is reported as `ERR_edges` in `has-error`
and the tree is not drawn. A tree that is wider than its container, or cut
off at the bottom by a container that hides its overflow, sets
`WARN_overflow`.

### Layout Direction

| Value | Description |
|-------|-------------|
| `ltr` | Left to right (default) |
| `rtl` | Right to left |
| `ttb` | Top to bottom |
| `btt` | Bottom to top |

### Edge Style

| Value | Description |
|-------|-------------|
| `orthogonal` | Right-angle connector lines (default) |
| `straight` | Direct lines between nodes |
| `curved` | Smooth bezier curves |

<!-- Auto Generated Below -->


## Overview

Renders a hierarchical tree diagram with SVG edge connections.

Nodes are provided as named slots; the `edges` prop defines parent-child
relationships and optional arithmetic operators displayed between siblings.
Layout is computed via CSS Grid with an SVG overlay for edge paths.

## Properties

| Property             | Attribute        | Description                                                                                                                                                                                                                                                                                                                       | Type                                     | Default        |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------- |
| `direction`          | `direction`      | Layout direction of the tree. - 'ltr': left to right (root on left) - 'rtl': right to left (root on right) - 'ttb': top to bottom (root on top) - 'btt': bottom to top (root on bottom)                                                                                                                                           | `"btt" \| "ltr" \| "rtl" \| "ttb"`       | `"ltr"`        |
| `edgeStyle`          | `edge-style`     | Edge line style. - 'straight': direct line between nodes - 'orthogonal': right-angle lines (default) - 'curved': smooth bezier curves                                                                                                                                                                                             | `"curved" \| "orthogonal" \| "straight"` | `"orthogonal"` |
| `edges` _(required)_ | `edges`          | JSON string defining connections between nodes. Each edge specifies a source (from) and target (to) node ID, with optional operator and styling.  Example: ```json [   {"from":"roi","to":"ros","operator":"x"},   {"from":"roi","to":"capital-turnover"} ] ```                                                                   | `string`                                 | `undefined`    |
| `i18nNamespace`      | `i18n-namespace` | I18n namespace inherited by this tree's children (their own namespace wins). Resolved at runtime from the `i18n-namespace` attribute by the nearest ancestor lookup in `withTranslation`; the tree renders no translated text itself. Declared so the attribute is part of the typed public API rather than a bare DOM attribute. | `string`                                 | `undefined`    |
| `levelSpacing`       | `level-spacing`  | Spacing between hierarchy levels in pixels.                                                                                                                                                                                                                                                                                       | `number`                                 | `60`           |
| `nodeSpacing`        | `node-spacing`   | Spacing between sibling nodes in pixels.                                                                                                                                                                                                                                                                                          | `number`                                 | `20`           |
| `showOperators`      | `show-operators` | Show operator labels between sibling nodes.                                                                                                                                                                                                                                                                                       | `string`                                 | `"true"`       |


## Methods

### `getLayoutState(options?: LayoutStateOptions) => Promise<ComponentLayoutState>`

Lazily generates this tree's layout state: host box (context- and
component-relative, CSS px), the grid region and node/edge counts. With
`detail: "full"` every node (slotted content), edge path and operator is
listed with its geometry.

#### Parameters

| Name      | Type                 | Description                                              |
| --------- | -------------------- | -------------------------------------------------------- |
| `options` | `LayoutStateOptions` | - `{ detail: "summary" \| "full" }`, default `"summary"` |

#### Returns

Type: `Promise<ComponentLayoutState>`




----------------------------------------------

developed by Bino Bi
