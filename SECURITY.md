# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report through GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/bino-bi/bn-template-engine/security) of this repository
2. Click **"Report a vulnerability"**
3. Describe the issue, the steps to reproduce it and the impact you expect

If you cannot use GitHub, send the same information to <sven@bino.bi>.

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with an assessment and expected timeline
- **Fix or mitigation** as soon as practical, coordinated with you before public disclosure

## Trust Model

A report has two kinds of input, and the engine treats them differently.

**Report content is code.** Everything a report author writes is trusted like a script: element attributes, element bodies, dataset SQL, `filter` expressions and `bn-text` templates. Dataset SQL and `filter` run in [AlaSQL](https://alasql.org/), which can call JavaScript, load URLs and read elements of the page. HTML written by the author in `bn-text`, `bn-message`, `bn-annotation-list` and titles is rendered as markup. The engine does not sandbox report content.

**Row values are data.** Values that come out of a datasource or dataset never become markup or code:

- In SQL built by the engine, row values are bound as query parameters and are never written into the SQL text.
- In `bn-text` templates, every resolved `${data...}` and `${t(...)}` value is HTML-escaped before it is joined with the author's markup.
- In tables and charts, row values are written as text nodes and as escaped `data-bn-*` attribute values.

The engine also limits what report content can do by accident. These checks are guard rails, not a sandbox:

- Author HTML is reduced to an allowlist of formatting tags. It is parsed in a separate inert document, so nothing in it loads or runs. Scripts, event handlers and URLs other than `http:`, `https:`, `mailto:` and relative ones are removed (`src` also accepts `data:`). Relative URLs resolve against the page that embeds the report.
- `bn-text` templates accept `${data.<name>[<n>].<field>}`, `${data['<name>'][<n>].<field>}` and `${t('<key>')}` (with an optional object of values) only. Nothing in a template is evaluated as JavaScript.
- A `filter` or a dataset SQL body that contains a double backtick (AlaSQL's inline JavaScript syntax) is rejected with an `ERR_filter` / `ERR_sql` item in `has-error`. AlaSQL has other ways to reach JavaScript and the network (the `->` operator, `FROM JSON('...')`, `TXT('#id')`), so SQL stays code.
- Layout attributes (`width`, `height`, `top`, `grid-column` and the like) are parsed by the browser as one CSS value before they reach a stylesheet.
- The engine itself fetches only the URL in the `src` attribute of `bn-dataset` and `bn-datasource`. The element body is never read as a URL.

## What a Host Must Do

- Treat a report template like a script file. Whoever can edit a template can run JavaScript in every page that renders it.
- Do not render templates from people you do not trust in a page that holds anything worth protecting (session cookies, tokens, other users' data). If you must, render them in a sandboxed `<iframe>` on a separate origin.
- When you build templates on a server, write row data only into `bn-datasource` bodies (JSON, HTML-escaped) or serve it through `src`. Never write row values into attributes, SQL, filters or `bn-text` templates.

## Content Security Policy

The engine runs under this policy. Add the origins you load the engine, data, images and fonts from.

```
Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
```

| Directive | Why |
|-----------|-----|
| `script-src 'unsafe-eval'` | AlaSQL compiles every query with `new Function`. It has no mode without it. The engine needs no inline script. |
| `style-src 'unsafe-inline'` | The engine and the Stencil runtime add `<style>` elements to the document head. Table alignment in author HTML uses a `style` attribute. |
| `connect-src` | Origins used in `src` of `bn-dataset` and `bn-datasource`, and in AlaSQL file functions inside dataset SQL. |
| `img-src` | Origins of images and assets. `data:` when assets are embedded as data URLs. |

- Do not add a nonce or a hash to `style-src`. Browsers then ignore `'unsafe-inline'` and the engine's layout stylesheet is blocked.
- The engine is not compatible with `require-trusted-types-for 'script'`.
- With `'unsafe-eval'` this policy does not stop script injection on its own. It is one more reason to keep untrusted templates out of the page.

## Dependencies

We monitor dependencies for known vulnerabilities via GitHub Dependabot and `npm audit`. If you notice a dependency vulnerability that affects this package, report it using the process above.
