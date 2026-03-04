# Installation

## npm

```bash
npm install @bino-bi/bn-template-engine
```

### Framework Integration (Stencil Lazy-Loading)

The default `dist` output uses Stencil's lazy-loading. Import the loader in your app's entry point:

```js
import { defineCustomElements } from '@bino-bi/bn-template-engine/loader';

defineCustomElements();
```

This registers all `<bn-*>` custom elements. Components are loaded on demand when they appear in the DOM.

### Custom Elements Bundle

For bundlers that tree-shake (Vite, Webpack 5, Rollup), use the custom elements output:

```js
import { BnContext, BnDatasource, BnDataset, BnTable } from '@bino-bi/bn-template-engine/dist/custom-elements';
```

Each import registers the component as a custom element. Only import what you use.

## CDN / Script Tag

Load directly from a CDN without a build step:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@bino-bi/bn-template-engine/dist/bn-template-engine/bn-template-engine.esm.js"></script>
```

Or using unpkg:

```html
<script type="module" src="https://unpkg.com/@bino-bi/bn-template-engine/dist/bn-template-engine/bn-template-engine.esm.js"></script>
```

All components are automatically registered and available in your HTML.

## ES Module Import Map

For modern browsers, use an import map to resolve the package without a bundler:

```html
<script type="importmap">
{
  "imports": {
    "@bino-bi/bn-template-engine": "https://cdn.jsdelivr.net/npm/@bino-bi/bn-template-engine/dist/bn-template-engine/bn-template-engine.esm.js"
  }
}
</script>
<script type="module">
  import '@bino-bi/bn-template-engine';
</script>
```

## Minimal Example

Once loaded, use the components in plain HTML:

```html
<bn-context locale="en">

  <bn-datasource name="sales">
    [
      { "category": "North", "ac1": 120, "pl1": 100 },
      { "category": "South", "ac1": 80, "pl1": 90 }
    ]
  </bn-datasource>

  <bn-dataset name="sales" datasources="sales">
    SELECT category, SUM(ac1) as ac1, SUM(pl1) as pl1 FROM sales GROUP BY category
  </bn-dataset>

  <bn-page format="hd" orientation="landscape">
    <bn-body>
      <bn-table scenarios="ac1,pl1"></bn-table>
    </bn-body>
  </bn-page>

</bn-context>
```

All `<bn-*>` components must be placed inside a `<bn-context>` element. See the [main README](../readme.md) for a complete quick start example.
