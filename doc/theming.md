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

`bn-chart-bullet`, `bn-chart-scatter` and `bn-chart-bubble` have a section of their own under their tag name, with `scaleFactors`, `axisStyles` and `padding`. The bullet chart also has `barStyles`, `varianceStyles` and `rangeColors`, the scatter and the bubble chart have `seriesColors`.

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

Customize `<bn-grid>` borders and cell spacing:

```json
{
  "bn-grid": {
    "borderColor": "#A6A6A6",
    "borderWidth": 1,
    "cellPadding": 4
  }
}
```

### Unknown keys

A key that is not part of the style is ignored. `<bn-component-style>` reports such keys in its `has-error` attribute as `ERR_keys`, for example `timeChart` (the section is `bn-chart-time`) or a misspelled scale factor. Checked are the section names, the keys of each section, and the keys of `scaleFactors` and `padding`.

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
