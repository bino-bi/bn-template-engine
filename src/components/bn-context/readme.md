# bn-context

Root wrapper element for all bn-template-engine components. Every `<bn-*>` component must be placed inside a `<bn-context>`.

`<bn-context>` creates and owns a scoped set of reactive stores (datasources, datasets, styles, translations, assets). Components nested inside resolve their stores from the nearest `<bn-context>` ancestor.

## Usage

```html
<bn-context locale="en">
  <bn-datasource name="raw">...</bn-datasource>
  <bn-dataset name="sales" datasources="raw">...</bn-dataset>

  <bn-page format="hd" orientation="landscape">
    <bn-body>
      <bn-table datasets="sales" scenarios="ac1,pl1"></bn-table>
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

The locale also sets the number format of tables and charts: `en` prints `1,234.5`, `de` prints `1.234,5`, and an unknown locale falls back to the German format.

### Multiple Contexts

You can use multiple `<bn-context>` elements on the same page. Each one has its own isolated stores, so datasources and datasets defined in one context are not visible in another.

### Pages

`<bn-context>` numbers its pages by position and writes the number as `page-number` on each `<bn-layout-page>`, or on the `<bn-footer>` of a `<bn-page>`. A `page-number` that the author set is kept. Pages that are added later are numbered too, and a number that gets removed is written again.

The first `<bn-context>` of a document also writes the `@page` rule for printing, see [bn-page](../bn-page/readme.md). Set `render-orientation` (`landscape` or `portrait`) to the orientation the document is printed in: a `<bn-layout-page>` with the other orientation is turned onto the sheet.

### When a page has finished rendering

A tool that prints or captures a page has to know when all components are done. The engine publishes this on `window`, 500 ms after the last component changed its status and after web fonts have loaded:

| Value | Meaning |
|-------|---------|
| `window.componentRegisterIsRenderedResult` | `true` when every component has rendered. `false` while one is still working or has failed. |
| `window.componentRegisterFailures` | The components that threw in `render()`, in a lifecycle hook or in `connectedCallback` (for example an element outside of `<bn-context>`), as `{ tag, id, message }`. Empty while a component is still working. |

Read them like this: the flag is `true`, the page is ready. The failures list is not empty, the page has settled but is broken. Otherwise wait. Each time the values are written, the console also gets the line `componentRegisterIsRendered: <true|false>`.

A `has-error` item on a component is something else: it reports a problem with the input (a wrong attribute, a failing query), and the page still counts as rendered.

These values and the `has-error` ids are stable in 1.x, see the [Integration Contract](../../../doc/integration-contract.md).

### Notation for charts from outside

A chart that is not part of this package, for example a web component of your own, can ask the context how it draws. Then it uses the same scenario looks, font and scaling groups as the charts of this package, and it does not have to copy the values.

```js
const context = document.querySelector("bn-context");
const notation = await context.getNotation(); // or getNotation("my-style")

context.addEventListener("bnNotationChange", async () => {
  draw(await context.getNotation());
});
```

`getNotation(styleName?)` returns this object:

```ts
interface Notation {
  apiVersion: 1;
  fontFamily: string; // global.fontFamily
  fontSizePx: number; // global.fontSizePx
  scenarios: Record<"ac" | "pp" | "fc" | "pl", NotationScenario>;
  variance: Record<"pos" | "neg" | "neu", NotationShapeStyle>;
  scalingGroups: Record<string, number>; // name of a <bn-scaling-group> and its value
}

interface NotationScenario {
  bar: NotationShapeStyle;
  line: { color: string; dashArray?: string };
  marker: { fill: string; stroke: string };
  area: { fill: string; opacity: number; lineColor: string; dashArray?: string };
}

interface NotationShapeStyle {
  stroke: string;
  fill: string;
  width: number;
  fillpattern?: "solid" | "hatched" | "outlined";
  dasharray?: string;
}
```

Where the values come from:

- `fontFamily`, `fontSizePx`, `bar` and `variance` come from the style: `global`, `bn-chart-time.barStyles` and `bn-chart-time.varianceStyles`. The layers are merged like in every component: `_system`, then `_default`, then the style named `styleName`. Without a name, or with a name that no style has, the result is `_system` and `_default`. See [Theming](../../../doc/theming.md).
- `width` of `bar` and `variance` is a multiple of the font size, like in the style.
- `line`, `marker` and `area` are the fixed looks the time chart uses for its line series and stacked areas. A style can not change them.
- `scalingGroups` has the value of every [`<bn-scaling-group>`](../bn-scaling-group/readme.md) of the context as a number, so `250k` is `250000`.

The promise resolves after the context and every `<bn-component-style>` and `<bn-scaling-group>` that is inside it at the time of the call have loaded. So a call right after the page was built already has their values. The result is a copy: changing it has no effect.

`bnNotationChange` is fired on `<bn-context>` each time a scaling group or a component style is added, changed or removed after that. It has no detail, call `getNotation()` again. One change can fire more than one event.

`apiVersion` is `1`. A release that only adds fields keeps the number. Removing or renaming a field, or changing its meaning, is a breaking change and raises the number. The package exports the types `Notation`, `NotationScenario` and `NotationShapeStyle` and the constant `NOTATION_API_VERSION`.

<!-- Auto Generated Below -->


## Properties

| Property            | Attribute            | Description                                                                                                                                                                                                                                                                                                                                         | Type                        | Default     |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- |
| `i18nNamespace`     | `i18n-namespace`     | Default i18n namespace for every component inside this context. Resolved at runtime from the `i18n-namespace` attribute by the nearest ancestor lookup in `withTranslation`; a namespace set on a page, card, tree, grid, or the component itself wins. Declared so the attribute is part of the typed public API rather than a bare DOM attribute. | `string`                    | `undefined` |
| `locale`            | `locale`             |                                                                                                                                                                                                                                                                                                                                                     | `string`                    | `undefined` |
| `renderOrientation` | `render-orientation` | Orientation of the sheets the document is printed on: `landscape` or `portrait`. A `<bn-layout-page>` with the other orientation is turned onto the sheet. Without it no page is turned.                                                                                                                                                            | `"landscape" \| "portrait"` | `undefined` |


## Events

| Event              | Description                                                                                                                                                                                        | Type                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `bnNotationChange` | Fired when a `<bn-scaling-group>` or a `<bn-component-style>` of this context has changed, so the result of `getNotation()` may be different. The event has no detail: call `getNotation()` again. | `CustomEvent<void>` |


## Methods

### `getLayoutState(options?: LayoutStateOptions) => Promise<LayoutState>`

Lazily generates a JSON-serializable snapshot of the rendered report:
every visual descendant with its position and size (context- and
component-relative, CSS px), render metadata, diagnostics and - with
`detail: "full"` - per-element geometry (bars, labels, axes, cells).

Nothing is tracked during rendering; each call measures the DOM at that
moment. Call it after the report has settled (e.g. when
`window.componentRegisterIsRenderedResult` is true) for final geometry.

#### Parameters

| Name      | Type                 | Description                                              |
| --------- | -------------------- | -------------------------------------------------------- |
| `options` | `LayoutStateOptions` | - `{ detail: "summary" \| "full" }`, default `"summary"` |

#### Returns

Type: `Promise<LayoutState>`



### `getNotation(styleName?: string) => Promise<Notation>`

Returns how this context draws: font, the look of the scenarios `ac`,
`pp`, `fc` and `pl`, the variance colours and the scaling groups. A
chart that is not part of this package can use it to draw like the
charts that are.

The style values are merged like in every component: `_system`, then
`_default`, then the style named `styleName`.

The promise resolves after every `<bn-component-style>` and
`<bn-scaling-group>` that is inside the context at the time of the call
has loaded. Listen to `bnNotationChange` for later changes.

#### Parameters

| Name        | Type     | Description                                                              |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `styleName` | `string` | - name of a `<bn-component-style>`, like the `selected-style` of a chart |

#### Returns

Type: `Promise<Notation>`




----------------------------------------------

developed by Bino Bi
