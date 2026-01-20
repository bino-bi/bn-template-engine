# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

#### bn-chart-time: LineChart Visualization Mode

New properties for rendering time series data as line charts:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `chart-mode` | `'bar' \| 'line' \| 'auto'` | `'bar'` | Controls how the chart is rendered. When set to `'auto'`, the chart automatically switches to line mode when data points exceed `max-bars`. |
| `max-bars` | `number` | `28` | Threshold for auto-switching to line mode. Only applies when `chart-mode="auto"`. |

**Usage Examples:**

```html
<!-- Default bar chart -->
<bn-chart-time scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Force line chart mode -->
<bn-chart-time chart-mode="line" scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Auto-switch to line when data points exceed 28 -->
<bn-chart-time chart-mode="auto" max-bars="28" scenarios="ac1,pp1" ...></bn-chart-time>

<!-- Auto-switch with custom threshold -->
<bn-chart-time chart-mode="auto" max-bars="15" scenarios="ac1,pp1" ...></bn-chart-time>
```

**Line Chart Features:**
- Square markers (8x8px) at each data point
- Data values displayed above each marker
- Scenario labels positioned to the right of the last data point
- Smart X-axis labels showing only start, end, and year boundaries
- Vertical dashed separator lines at year transitions
- IBCS color schema:
  - AC (Actual): Black fill, black stroke, solid line
  - PP (Previous Period): Gray fill, gray stroke, solid line
  - FC (Forecast): White fill, black stroke, dashed line
  - PL (Plan): White fill, black stroke, solid line

---

### [0.1.2](https://github.com/bino-bi/bn-template-engine/compare/v0.1.1...v0.1.2) (2021-01-10)

### [0.1.1](https://github.com/bino-bi/bn-template-engine/compare/v0.1.0...v0.1.1) (2021-01-10)
