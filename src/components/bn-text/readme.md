# bn-text

Text block with dataset and translation placeholders. The template is never evaluated: placeholders are looked up, resolved values are HTML-escaped and the output is sanitized.

## Usage

```html
<bn-text datasets="sales" value="Revenue: ${data.sales[0].ac1}"></bn-text>
```

### Placeholders

| Placeholder | Result |
| ----------- | ------ |
| `${data.<dataset>[<row>].<field>}` | Value of a field in a row of a dataset listed in `datasets` |
| `${data['<name>'][<row>].<field>}` | Same, for names that are not plain identifiers, for example the datasource reference `$revenue` |
| `${t('<key>')}` | Translation of the key |
| `${t('<key>', { name: 'text', count: 3, value: data.sales[0].ac1 })}` | Translation with values for its `{{name}}` placeholders (text, number or a data path) |

```html
<bn-text datasets="revenue" value="Total: ${data.revenue[0].ac1} EUR"></bn-text>
```

The `data` object contains all datasets keyed by name, each as an array of rows. `this.data` is accepted as another spelling of `data`.

Anything else, including any other `${...}` expression, is printed as written. A placeholder that points to a missing dataset, row or field renders empty and adds a `WARN_value_path` warning to `has-error`.

### Translations

Use the `t()` function to resolve translation keys:

```html
<bn-text datasets="revenue" value="${t('custom.labels.revenue')}: ${data.revenue[0].ac1}"></bn-text>
```

### HTML Content

Markup written in the template is rendered as HTML. Basic formatting, lists, tables, links and images are allowed. Any other element is removed together with its content. Values that come from a dataset or a translation are always shown as text:

```html
<bn-text datasets="revenue" value="<b>Revenue</b>: ${data.revenue[0].ac1}"></bn-text>
```

### Scaling

```html
<!-- Auto-scale to fit parent (silent) -->
<bn-text scale="auto" value="..."></bn-text>

<!-- No scaling -->
<bn-text scale="none" value="..."></bn-text>

<!-- Fixed scale factor -->
<bn-text scale="1.5" value="..."></bn-text>
```

<!-- Auto Generated Below -->


## Overview

Renders a text block from a template with dataset and translation
placeholders.

The `value` prop is markup with `${...}` placeholders. Placeholders are
looked up, never evaluated. Resolved values are HTML-escaped and the
result is sanitized before it is inserted. Supports auto-scaling to fit
the parent container.

## Properties

| Property        | Attribute        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Type     | Default     |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `datasets`      | `datasets`       | Names of the datasets the template can read, separated by commas without spaces. Each one is available as `data.<name>`. A name that starts with `$` reads a `<bn-datasource>` directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string` | `undefined` |
| `i18nNamespace` | `i18n-namespace` | Namespace of the translations to use (the `namespace` of a `<bn-internationalization>`). Without it the component takes the `i18n-namespace` of the nearest ancestor that has one, then the built-in texts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `string` | `undefined` |
| `scale`         | `scale`          | Controls font-size scaling relative to the available parent space. Scaling considers both width and height - the tighter constraint wins.  \| Value          \| Behavior                                                       \| \|----------------\|----------------------------------------------------------------\| \| not set / `""` \| Auto-scale to fit, emit `AUTO_scale` warning with applied factor \| \| `"none"`       \| No scaling; emit `WARN_overflow` warning if content overflows  \| \| `"auto"`       \| Auto-scale to fit, silent (no warning)                         \| \| `"0.5"`, `"1.2"`, … \| Apply `baseFontSize × factor`; emit `WARN_overflow` if still overflows \|  Invalid values (negative, non-numeric, non-keyword) fall back to the default (auto + warning) and emit an `ERR_scale` warning. | `string` | `undefined` |
| `selectedStyle` | `selected-style` | Name of the component style to use (the `name` of a `<bn-component-style>`). Its values go on top of the default style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `string` | `undefined` |
| `value`         | `value`          | Template string rendered as HTML. These placeholders are replaced: `${data.<dataset>[<row>].<field>}`, `${data['<name>'][<row>].<field>}` (for names such as the datasource reference `$revenue`), `${t('<key>')}` and `${t('<key>', { <name>: <text, number or data path> })}`. Any other text, including any other `${...}`, is printed as written. Nothing is evaluated.  Resolved values are HTML-escaped, so dataset values and translations are shown as text. Markup written in the template is kept if it is on the allowlist; other elements are removed with their content. A placeholder that does not resolve renders empty and adds a `WARN_value_path` warning.                                                                                                                                                       | `string` | `undefined` |


----------------------------------------------

developed by Bino Bi
