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

Override typography for `<bn-text>` components:

```json
{
  "text": {
    "fontFamily": "Georgia, serif",
    "fontSizePx": 16,
    "fontColor": "#222222",
    "fontBackgroundColor": "#ffffff",
    "leading": 1.5
  }
}
```

### Time Chart

Customize `<bn-chart-time>` appearance:

```json
{
  "timeChart": {
    "scaleFactors": {
      "scenarioOffset": 0.3,
      "columnWidth": 2.0,
      "barWidth": 0.8,
      "chartTitleFontSizeScale": 1.2,
      "axisLabelFontSizeScale": 0.85,
      "measureFontSizeScale": 0.85,
      "varianceFontSizeScale": 0.75,
      "measureScaleWidth": 3.5,
      "varianceChartHeightFactor": 0.3,
      "pinnedScaleMinMaxFactor": 0.05,
      "overlayAvgWidth": 1.5
    },
    "axisStyles": {
      "ac": { "stroke": "#404040" },
      "fc": { "stroke": "#ffffff" },
      "pp": { "stroke": "#A6A6A6" },
      "pl": { "stroke": "#404040" }
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
    "padding": { "top": 10, "left": 0, "right": 10, "bottom": 0 }
  }
}
```

### Structure Chart

Customize `<bn-chart-structure>` appearance. Same structure as time chart but with structure-specific scale factors:

```json
{
  "structureChart": {
    "scaleFactors": {
      "scenarioOffset": 0.3,
      "rowHeight": 2.0,
      "barHeight": 0.8,
      "chartTitleFontSizeScale": 1.2,
      "axisLabelFontSizeScale": 0.85,
      "measureFontSizeScale": 0.85,
      "varianceFontSizeScale": 0.75,
      "measureScaleHeight": 3.5,
      "varianceChartWidthFactor": 0.3,
      "pinnedScaleMinMaxFactor": 0.05
    }
  }
}
```

### Tree

Customize `<bn-tree>` edge and operator styling:

```json
{
  "tree": {
    "edgeColor": "#404040",
    "edgeWidth": 1.5,
    "operatorCircleRadius": 12,
    "operatorFontSizeScale": 0.85,
    "operatorColor": "#404040"
  }
}
```

### Grid

Customize `<bn-grid>` borders and headers:

```json
{
  "grid": {
    "headerBackground": "transparent",
    "borderColor": "#A6A6A6",
    "borderWidth": 1,
    "cellPadding": 4
  }
}
```

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
      "timeChart": {
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
