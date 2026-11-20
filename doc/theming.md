# Theming

bn-template-engine uses a three-layer styling system. Customize fonts, colors, chart styles, and more by providing a `<bn-component-style>` element inside your `<bn-context>`.

## Style Layers

Styles are resolved by merging three layers (later layers override earlier ones):

1. **`_system`** - Built-in IBCS-compliant defaults. Cannot be overridden directly.
2. **`_default`** - Global user-level overrides. Applied to all components.
3. **Named styles** - Component-specific overrides keyed by a custom name.

## Usage

Add a `<bn-component-style>` element with a JSON body:

```html
<bn-context locale="en">
  <!-- Global overrides (applied to everything) -->
  <bn-component-style name="_default">
    {
      "global": {
        "fontFamily": "Arial, sans-serif",
        "fontSizePx": 14,
        "fontColor": "#333333"
      }
    }
  </bn-component-style>

  <!-- your datasources, datasets, and visualizations -->
</bn-context>
```

The `name` prop determines the style layer:

| Name | Effect |
|------|--------|
| `_default` | Overrides applied globally |
| Any other string | Named style set (for selective use) |

## Style Properties

### Units

All lengths are plain numbers. Which unit a number has depends on where it stands:

| Key | Unit |
|-----|------|
| `fontSizePx` | px |
| every key in a `scaleFactors` group | multiple of the font size. `0.075` is 1 px at the default font size of 13.3333 px, and it follows `scale` |
| `width` in `barStyles` and `varianceStyles`, `dasharray` | px, does not follow `scale` |
| `padding` | px, does not follow `scale` |
| `bn-tree`: `edgeWidth`, `operatorCircleRadius` | px |
| `bn-tree`: `operatorFontSizeScale` | multiple of the font size |
| `bn-grid`: `borderWidth`, `cellPadding`, `captionFontSize`, `captionGap` | px |
| `bn-layout-card`: `titleFontSize` | px |

`fillpattern` in `barStyles` and `varianceStyles` is `solid`, `hatched` or `outlined`. The old value `fc` still works and means `hatched`.

The keys `ac`, `pp`, `fc` and `pl` of `barStyles` are style slots. A scenario uses the slot of its own name, unless a [`<bn-ruleset>`](../src/components/bn-ruleset/readme.md) gives it another `colorIndex`. The hatch pattern always takes its colours from the `fc` slot.

### Global

Typography settings inherited by all components:

```json
{
  "global": {
    "fontFamily": "'Noto Sans', sans-serif",
    "fontSizePx": 13.3333,
    "fontColor": "#000000",
    "fontBackgroundColor": "#ffffff"
  }
}
```

### Text

Override typography for `<bn-text>` components. Every key is optional:

```json
{
  "bn-text": {
    "fontFamily": "Georgia, serif",
    "fontSizePx": 16,
    "fontColor": "#222222",
    "fontBackgroundColor": "#ffffff",
    "leading": 1.5
  }
}
```

### Time Chart

Customize `<bn-chart-time>` appearance. The scale factors are multiples of the font size. The example shows the defaults:

```json
{
  "bn-chart-time": {
    "scaleFactors": {
      "scenarioOffset": 0.3,
      "scenarioLabelToColumn": 0.3,
      "labelToColumn": 0.3,
      "labelToAxis": 0.3,
      "needleWidth": 0.3,
      "needleHeadWidth": 0.6,
      "columnWidth": 2.0,
      "varianceAxisLineWidth": 0.3,
      "axisLineWidth": 0.1,
      "auxiliaryLineWidth": 0.1,
      "scenarioLineWidth": 0.2,
      "markerWidth": 0.7,
      "markerOffset": 0.0,
      "categoryWidth": 3.0,
      "axisTickLength": 0.3
    },
    "axisStyles": {
      "ac": { "stroke": "#121212", "fill": "#121212", "width": 0.1 },
      "fc": { "stroke": "#121212", "fill": "#ffffff", "width": 0.1, "dasharray": "10 5 5 5" },
      "pp": { "stroke": "#606060", "fill": "#606060", "width": 0.1 },
      "pl": { "stroke": "#121212", "fill": "#ffffff", "width": 0.1 }
    },
    "barStyles": {
      "ac": { "fill": "#404040", "stroke": "#404040" },
      "fc": { "fill": "#ffffff", "stroke": "#404040" },
      "pp": { "fill": "#A6A6A6", "stroke": "#A6A6A6" },
      "pl": { "fill": "#ffffff", "stroke": "#404040" }
    },
    "varianceStyles": {
      "pos": { "fill": "#008f96", "stroke": "#008f96" },
      "neg": { "fill": "#ff0000", "stroke": "#ff0000" },
      "neu": { "fill": "#808080", "stroke": "#808080" }
    },
    "stackColors": ["#000000", "#c0c0c0", "#808080"],
    "padding": { "top": 10, "left": 10, "right": 10, "bottom": 10 }
  }
}
```

### Structure Chart

Customize `<bn-chart-structure>` appearance. It has the same sections as the time chart, with its own scale factors (defaults shown):

```json
{
  "bn-chart-structure": {
    "scaleFactors": {
      "scenarioOffset": 0.3,
      "scenarioLabelToBar": 0.1,
      "labelToBar": 0.3,
      "labelToAxis": 0.3,
      "needleWidth": 0.3,
      "needleHeadWidth": 0.6,
      "barWidth": 1.2,
      "varianceAxisLineWidth": 0.3,
      "axisLineWidth": 0.1,
      "auxiliaryLineWidth": 0.1,
      "scenarioLineWidth": 0.2,
      "markerWidth": 0.7,
      "markerOffset": 0.0,
      "categoryWidth": 1.9,
      "axisTickLength": 0.3
    }
  }
}
```

### Other charts

`bn-chart-bullet`, `bn-chart-scatter` and `bn-chart-bubble` have a section of their own under their tag name, with `scaleFactors`, `axisStyles` and `padding`. The bullet chart also has `barStyles`, `varianceStyles` and `rangeColors`, the scatter and the bubble chart have `seriesColors` and `markStyles`: `{ "stroke": "#ffffff", "opacity": 1 }` is the line around a filled point or bubble and the opacity of its fill. `seriesFills` gives a series the fill `solid` or `outline`, one entry per series in the order of `seriesColors`: an outlined series is a line in its colour around a nearly clear fill. `shareColors` (bubble chart) sets the colour of the share slice per series.

### Tree

Customize `<bn-tree>` edge and operator styling:

```json
{
  "bn-tree": {
    "edgeColor": "#404040",
    "edgeWidth": 1,
    "operatorCircleRadius": 10,
    "operatorFontSizeScale": 0.9,
    "operatorColor": "#404040"
  }
}
```

### Grid

Customize `<bn-grid>` borders, cell spacing, the cell background and the cell captions (`cell-captions`). `cellBackground` is a CSS colour for every data cell; `cell-background` on the child of one cell wins:

```json
{
  "bn-grid": {
    "borderColor": "#A6A6A6",
    "borderWidth": 1,
    "cellPadding": 4,
    "cellBackground": "transparent",
    "captionFontSize": 12,
    "captionFontWeight": "bold",
    "captionColor": "#000000",
    "captionGap": 2
  }
}
```

### Card

Set the font size of the title of `<bn-layout-card>`. Without `titleFontSize` the title has the font size of `global.fontSizePx`:

```json
{
  "bn-layout-card": {
    "titleFontSize": 16
  }
}
```

### Annotations

Colours of the marks of `<bn-annotation-layer>` and the circles of `<bn-annotation-list>`:

```json
{
  "bn-annotation": {
    "color": "#0070c0",
    "colors": {
      "negative": "#ff0000",
      "positive": "#008f96"
    }
  }
}
```

| Key | Effect |
|-----|--------|
| `color` | The colour of a mark without a `color`, of a mark with a name that `colors` does not have, and of the circles of the list. |
| `colors` | The names a mark can use in its `color`, with their colours. Add your own, for example `"brand": "#7b1fa2"`. |

The section works like any other: in `_default` for all marks, or in a named style that the layer and the list select with `selected-style`. Both elements read it on their own, so give a named style to both.

A page can also set the custom properties `--bn-annotation-color` and `--bn-annotation-color-<name>`. They win over the style.

### Unknown keys

A key that is not part of the style is ignored. `<bn-component-style>` reports such keys in its `has-error` attribute as `ERR_keys`, for example `timeChart` (the section is `bn-chart-time`) or a misspelled scale factor. Checked are the section names, the keys of each section, and the keys of `scaleFactors` and `padding`.

## Reading the Style from Outside

A chart that is not part of this package can read the merged style with `getNotation()` on `<bn-context>`. It returns the values a chart needs to draw like the charts of this package:

```js
const notation = await document.querySelector("bn-context").getNotation("corporate");

notation.fontFamily; // global.fontFamily
notation.fontSizePx; // global.fontSizePx
notation.scenarios.ac.bar; // bn-chart-time.barStyles.ac: stroke, fill, width, fillpattern
notation.scenarios.fc.line; // { color, dashArray }: fixed look of a line series
notation.scenarios.fc.marker; // { fill, stroke }: fixed look of the line markers
notation.scenarios.fc.area; // { fill, opacity, lineColor, dashArray }: fixed look of a stacked area
notation.variance.pos; // bn-chart-time.varianceStyles.pos
notation.scalingGroups; // { revenue: 250000 }: every <bn-scaling-group>, by name
```

`scenarios` has the four style slots `ac`, `pp`, `fc` and `pl`. The style layers are merged as described above: `_system`, then `_default`, then the style with the given name. Without a name the result is `_system` and `_default`. The line, marker and area looks are fixed and not part of the style JSON.

The promise resolves after every `<bn-component-style>` and `<bn-scaling-group>` that is in the context at the time of the call has loaded. When one of them changes later, `<bn-context>` fires the event `bnNotationChange`. It has no detail, call `getNotation()` again.

The result has `apiVersion: 1`. Adding a field keeps the number. Removing or renaming a field, or changing its meaning, is a breaking change and raises it. See [`<bn-context>`](../src/components/bn-context/readme.md) for the full shape.

## IBCS Default Colors

The built-in system defaults follow IBCS standards:

| Element | Color | Hex |
|---------|-------|-----|
| Actual (AC) bars | Solid dark gray | `#404040` |
| Forecast (FC) bars | White with hatching | `#ffffff` |
| Previous Period (PP) bars | Light gray | `#A6A6A6` |
| Plan (PL) bars | Outlined dark gray | `#404040` |
| Positive variance | Teal | `#008f96` |
| Negative variance | Red | `#ff0000` |
| Neutral variance | Gray | `#808080` |
| Variance that prints as zero | Default font color, no sign | `#000000` |
| Default font | Noto Sans 13.3px | `#000000` |

## Full Example

```html
<bn-context locale="en">

  <bn-component-style name="_default">
    {
      "global": {
        "fontFamily": "Inter, sans-serif",
        "fontSizePx": 14
      },
      "bn-chart-time": {
        "varianceStyles": {
          "pos": { "fill": "#2e7d32", "stroke": "#2e7d32" },
          "neg": { "fill": "#c62828", "stroke": "#c62828" }
        }
      }
    }
  </bn-component-style>

  <!-- datasources, datasets, visualizations... -->

</bn-context>
```

This changes the base font to Inter at 14px and uses custom green/red variance colors instead of the IBCS defaults.
