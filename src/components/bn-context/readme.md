# bn-context

Root wrapper element for all bn-template-engine components. Every `<bn-*>` component must be placed inside a `<bn-context>`.

`<bn-context>` creates and owns a scoped set of reactive stores (datasources, datasets, styles, translations, assets). Components nested inside resolve their stores from the nearest `<bn-context>` ancestor.

## Usage

```html
<bn-context locale="en">
  <bn-datasource name="sales">...</bn-datasource>
  <bn-dataset name="sales" datasources="sales">...</bn-dataset>

  <bn-page format="hd" orientation="landscape">
    <bn-body>
      <bn-table scenarios="ac1,pl1"></bn-table>
    </bn-body>
  </bn-page>
</bn-context>
```

### Locale

Set the `locale` prop to control which built-in translation bundle is used:

```html
<bn-context locale="de">
  <!-- German labels for scenarios, table headings, etc. -->
</bn-context>
```

Supported built-in locales: `"en"` (English), `"de"` (German). Custom translations can be added via [`<bn-internationalization>`](../bn-internationalization/readme.md).

### Multiple Contexts

You can use multiple `<bn-context>` elements on the same page. Each one has its own isolated stores, so datasources and datasets defined in one context are not visible in another.

<!-- Auto Generated Below -->


## Properties

| Property        | Attribute        | Description                                                                                                                                                                                                                                                                                                                                         | Type     | Default     |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `i18nNamespace` | `i18n-namespace` | Default i18n namespace for every component inside this context. Resolved at runtime from the `i18n-namespace` attribute by the nearest ancestor lookup in `withTranslation`; a namespace set on a page, card, tree, grid, or the component itself wins. Declared so the attribute is part of the typed public API rather than a bare DOM attribute. | `string` | `undefined` |
| `locale`        | `locale`         |                                                                                                                                                                                                                                                                                                                                                     | `string` | `undefined` |


## Methods

### `getLayoutState(options?: LayoutStateOptions) => Promise<LayoutState>`

Lazily generates a JSON-serializable snapshot of the rendered report:
every visual descendant with its position and size (context- and
component-relative, CSS px), render metadata, diagnostics and — with
`detail: "full"` — per-element geometry (bars, labels, axes, cells).

Nothing is tracked during rendering; each call measures the DOM at that
moment. Call it after the report has settled (e.g. when
`window.componentRegisterIsRenderedResult` is true) for final geometry.

#### Parameters

| Name      | Type                 | Description                                              |
| --------- | -------------------- | -------------------------------------------------------- |
| `options` | `LayoutStateOptions` | - `{ detail: "summary" \| "full" }`, default `"summary"` |

#### Returns

Type: `Promise<LayoutState>`




----------------------------------------------

developed by Bino Bi
