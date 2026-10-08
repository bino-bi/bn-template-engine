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

### Single Components

To load only the components a page uses, import them one by one. Each module exports a `defineCustomElement()` function. Call it to register the element and the elements it renders:

```js
import { defineCustomElement as defineContext } from '@bino-bi/bn-template-engine/components/bn-context';
import { defineCustomElement as defineDatasource } from '@bino-bi/bn-template-engine/components/bn-datasource';
import { defineCustomElement as defineDataset } from '@bino-bi/bn-template-engine/components/bn-dataset';
import { defineCustomElement as defineTable } from '@bino-bi/bn-template-engine/components/bn-table';

defineContext();
defineDatasource();
defineDataset();
defineTable();
```

An import alone registers nothing. These modules bring their own runtime, no other package is needed.

### Package Entry Points

| Import | Content |
|--------|---------|
| `@bino-bi/bn-template-engine` | `LAYOUT_STATE_VERSION` and the TypeScript types of the elements and of the layout state |
| `@bino-bi/bn-template-engine/loader` | `defineCustomElements()` for lazy loading |
| `@bino-bi/bn-template-engine/components/<tag>` | one element with `defineCustomElement()` |
| `@bino-bi/bn-template-engine/schemas/<name>.schema.json` | JSON Schemas for `theme`, `ruleset`, `i18n`, `thereof`, `partof`, `stack` and `axis` |

A TypeScript project needs `moduleResolution` `bundler`, `node16` or `nodenext` for the last two.

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
