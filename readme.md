# bn-template-engine

> [!NOTE]
> **About the history and the license of this repository.**
>
> All commits up to and including [`9629c1b`](https://github.com/bino-bi/bn-template-engine/commit/9629c1b534b70bb37305695e2565b1170eecb8da) come from an older, private project. That code was not written for the public, so please read it with a grain of salt.
>
> The code in this repository, old and current, is **source available**, not open source. You are welcome to:
>
> - read and study the code,
> - use the published library unchanged, for example from a CDN or from npm, for non-commercial purposes.
>
> Without our explicit written permission, you may not:
>
> - use the library or the code commercially,
> - modify the code or build your own version of it,
> - copy the code, in full or in parts, into other projects or products.
>
> If you would like to do any of this, just ask us at <sven@bino.bi>. With version 1.0 the project moves to an open source license.
>
> See [LICENSE](LICENSE) for the full terms.

IBCS-compliant web components for business intelligence visualizations.

[![License: Source Available](https://img.shields.io/badge/License-Source_Available-orange.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@bino-bi/bn-template-engine)](https://www.npmjs.com/package/@bino-bi/bn-template-engine)

**bn-template-engine** is a [Stencil.js](https://stenciljs.com/) web component library that renders tables and charts following [IBCS (International Business Communication Standards)](https://www.ibcs.com/). It supports multi-scenario comparisons (actual, forecast, plan, previous period), variance calculations, hierarchical data grouping, and more - all as standard Web Components that work in any HTML page or framework.

## Installation

```bash
npm install @bino-bi/bn-template-engine
```

See the [Installation Guide](doc/installation.md) for framework integration, ES Module import maps, and CDN script tag options.

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@bino-bi/bn-template-engine/dist/bn-template-engine/bn-template-engine.esm.js"></script>
</head>
<body>

<bn-context locale="en">

  <bn-datasource name="revenue_raw">
    [
      { "category": "Software", "ac1": 150, "pl1": 140 },
      { "category": "Services", "ac1": 90, "pl1": 100 },
      { "category": "Hardware", "ac1": 60, "pl1": 55 }
    ]
  </bn-datasource>

  <bn-dataset name="revenue" datasources="revenue_raw">
    SELECT category, SUM(ac1) as ac1, SUM(pl1) as pl1 FROM revenue_raw GROUP BY category
  </bn-dataset>

  <bn-page format="hd" orientation="landscape">
    <bn-title
      business-unit="ACME Corp"
      scenarios="ac1,pl1"
      measures='[{"name":"Revenue","unit":"mEUR"}]'>
    </bn-title>
    <bn-body>
      <bn-table datasets="revenue" scenarios="ac1,pl1" variances="dac1_pl1_pos"></bn-table>
    </bn-body>
  </bn-page>

</bn-context>
```

This renders an IBCS-compliant table comparing actual vs. plan revenue with an absolute variance column.

## Architecture

Data flows through three layers:

```
bn-datasource  →  bn-dataset  →  Visualization (bn-table, bn-chart-time, bn-chart-structure,
   (raw JSON)     (SQL query)       bn-chart-scatter, bn-chart-bubble - renders IBCS output)
```

1. **`<bn-datasource>`** - Receives raw JSON data and stores it by name
2. **`<bn-dataset>`** - Queries datasources using [AlaSQL](https://alasql.org/) and stores results
3. **Visualization components** - Subscribe to datasets and render tables or charts

All components must be wrapped in a **`<bn-context>`** element, which provides scoped state management and locale configuration.

```
<bn-context locale="en">
  ├── <bn-datasource>        Raw data input
  ├── <bn-dataset>           SQL query layer
  ├── <bn-component-style>   Theming (optional)
  ├── <bn-ruleset>           Scenario order, look and names (optional)
  ├── <bn-internationalization>  i18n (optional)
  ├── <bn-asset>             Images/resources (optional)
  │
  ├── <bn-page>              Page container
  │   ├── <bn-title>         IBCS title block
  │   ├── <bn-body>          Content area
  │   │   ├── <bn-table>     Data table
  │   │   ├── <bn-chart-time>      Time series chart
  │   │   ├── <bn-chart-structure>  Structure chart
  │   │   ├── <bn-chart-scatter>   XY scattergram (IBCS C09)
  │   │   ├── <bn-chart-bubble>    Bubble portfolio chart (IBCS C10)
  │   │   └── <bn-chart-bullet>    Bullet graph
  │   └── <bn-footer>        Footer
```

## Components

The `bn-*` elements listed below are the public API: their tags, attributes, properties and methods follow semantic versioning. Elements named `bn-*-renderer` are internal. A public element renders one of them in its shadow root, and their tags, props and markup can change in any release. Do not use them in a page.

### Core Data Flow

| Component | Description |
|-----------|-------------|
| [`<bn-context>`](src/components/bn-context/readme.md) | Root wrapper providing scoped stores and locale |
| [`<bn-datasource>`](src/components/bn-datasource/readme.md) | Ingests raw JSON data |
| [`<bn-dataset>`](src/components/bn-dataset/readme.md) | Queries datasources with AlaSQL |

### Visualization

| Component | Description |
|-----------|-------------|
| [`<bn-table>`](src/components/bn-table/readme.md) | IBCS data table with grouping, drill-down, and variances |
| [`<bn-chart-time>`](src/components/bn-chart-time/readme.md) | Time series bar/line chart |
| [`<bn-chart-structure>`](src/components/bn-chart-structure/readme.md) | Categorical/structural bar chart |
| [`<bn-chart-scatter>`](src/components/bn-chart-scatter/readme.md) | XY scattergram with iso-lines and highlight bands (IBCS C09) |
| [`<bn-chart-bubble>`](src/components/bn-chart-bubble/readme.md) | Area-true bubble chart with scenario overlay and pie shares (IBCS C10) |
| [`<bn-chart-bullet>`](src/components/bn-chart-bullet/readme.md) | Bullet graph: one row per KPI with actual bar and target marker |

### Layout

| Component | Description |
|-----------|-------------|
| [`<bn-page>`](src/components/bn-page/readme.md) | Page container with format and orientation |
| [`<bn-body>`](src/components/bn-body/readme.md) | Content area within a page |
| [`<bn-card>`](src/components/bn-card/readme.md) | Card container |
| [`<bn-grid>`](src/components/bn-grid/readme.md) | CSS Grid layout with headers and borders |
| [`<bn-layout-page>`](src/components/bn-layout-page/readme.md) | High-level page layout with card arrangements |
| [`<bn-layout-card>`](src/components/bn-layout-card/readme.md) | Card layout with grid patterns |

### Content

| Component | Description |
|-----------|-------------|
| [`<bn-title>`](src/components/bn-title/readme.md) | IBCS title block (business unit, scenarios, measures, dates) |
| [`<bn-text>`](src/components/bn-text/readme.md) | Template text with dataset interpolation |
| [`<bn-footer>`](src/components/bn-footer/readme.md) | Page footer with text and page numbers |
| [`<bn-image>`](src/components/bn-image/readme.md) | Image display |
| [`<bn-message>`](src/components/bn-message/readme.md) | Message display |
| [`<bn-asset>`](src/components/bn-asset/readme.md) | Asset/resource registration |

### Specialized

| Component | Description |
|-----------|-------------|
| [`<bn-tree>`](src/components/bn-tree/readme.md) | Hierarchical tree diagram with SVG edges |
| [`<bn-annotation-layer>`](src/components/bn-annotation-layer/readme.md) | Numbered markers, frames and arrows over the data points of a page |
| [`<bn-annotation-list>`](src/components/bn-annotation-list/readme.md) | The numbered texts of the annotations of a page |

### Configuration

| Component | Description |
|-----------|-------------|
| [`<bn-component-style>`](src/components/bn-component-style/readme.md) | Theme/style configuration |
| [`<bn-ruleset>`](src/components/bn-ruleset/readme.md) | Order, look and names of the scenarios |
| [`<bn-internationalization>`](src/components/bn-internationalization/readme.md) | Translation/locale configuration |
| [`<bn-scaling-group>`](src/components/bn-scaling-group/readme.md) | Named scaling value shared across charts and tables |

## Concept Guides

- [Data Model](doc/data-model.md) - Scenarios, variances, grouping fields, operations
- [Scaling](doc/scaling.md) - Units-per-em bar scaling, scaling groups, `scale`, `measure-scale`
- [Theming](doc/theming.md) - Colors, fonts, chart styles, style layers
- [Internationalization](doc/internationalization.md) - Locale setup, translations, scenario labels
- [Layout State](doc/layout-state.md) - `getLayoutState()`: machine-readable geometry, metadata and diagnostics of a rendered report
- [Integration Contract](doc/integration-contract.md) - What a tool can rely on in 1.x: readiness signals, layout state, `has-error` ids
- [Installation](doc/installation.md) - npm, CDN, framework integration

## Browser Support

bn-template-engine uses standard [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) (Custom Elements v1). Supported in all modern browsers:

- Chrome / Edge 79+
- Firefox 63+
- Safari 10.1+

## License

Source available: free to read, and free to use unchanged for non-commercial purposes. Commercial use, changes and reuse of the code need our explicit written permission. See [LICENSE](LICENSE). The project moves to an open source license with version 1.0.
