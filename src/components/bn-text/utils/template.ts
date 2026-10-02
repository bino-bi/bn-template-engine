const NAME = "[A-Za-z_$\\u00C0-\\uFFFF][\\w$\\u00C0-\\uFFFF]*";
const STRING = `'[^'\\\\]*'|"[^"\\\\]*"`;
/** Groups: name in dot form, name as quoted string, row index, field. */
const PATH = `(?:this\\.)?data(?:\\.(${NAME})|\\[\\s*(${STRING})\\s*\\])\\[\\s*(\\d+)\\s*\\]\\.(${NAME})`;

/**
 * The bn-text placeholders. Groups 1-4: see PATH, 5: quoted translation key,
 * 6: text between the braces of the optional t() parameter object.
 *   ${data.<name>[<n>].<field>}
 *   ${data['<name>'][<n>].<field>}
 *   ${t('<key>')}
 *   ${t('<key>', { <name>: '<text>' | <number> | <data path>, ... })}
 */
const PLACEHOLDER = new RegExp(
  `\\$\\{\\s*(?:${PATH}|t\\(\\s*(${STRING})\\s*(?:,\\s*\\{([^{}]*)\\}\\s*)?\\))\\s*\\}`,
  "g",
);

/** One `name: value` entry of the t() parameter object. Groups 1-2: name, 3: string, 4: number, 5-9: data path. */
const PARAM = new RegExp(
  `\\s*(?:(${NAME})|(${STRING}))\\s*:\\s*(?:(${STRING})|(-?\\d+(?:\\.\\d+)?)|(${PATH}))\\s*(?:,|$)`,
  "y",
);

// Whitespace is escaped too: it would end an attribute value the author wrote without quotes.
const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"'\t\n\f\r ]/g, (char) => `&#${char.charCodeAt(0)};`);

// Own properties only, so a template cannot reach `constructor` or `__proto__`.
const own = (obj: unknown, key: string): unknown =>
  typeof obj === "object" && obj !== null && Object.prototype.hasOwnProperty.call(obj, key)
    ? (obj as Record<string, unknown>)[key]
    : undefined;

const unquote = (quoted: string): string => quoted.slice(1, -1);

/**
 * Replaces the placeholders of a bn-text template. Nothing is evaluated: a
 * placeholder is a lookup in `data` or a call of `t`, everything else is
 * literal text. Resolved values are HTML-escaped. Paths that do not resolve
 * render empty and are returned in `unknown`.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  t: (key: string, params?: object) => string,
): { html: string; unknown: string[] } {
  const unknown: string[] = [];
  const report = (expression: string) => {
    if (!unknown.includes(expression)) unknown.push(expression);
  };

  const lookup = (path: string, dotName: string, quotedName: string, index: string, field: string): unknown => {
    const value = own(own(own(data, dotName ?? unquote(quotedName)), String(Number(index))), field);
    if (value === undefined) report(path);
    return value;
  };

  /** Parses the t() parameter object, or returns null when the text is not one. */
  const parseParams = (text: string): Record<string, unknown> | null => {
    const params: Record<string, unknown> = {};
    PARAM.lastIndex = 0;
    while (text.slice(PARAM.lastIndex).trim() !== "") {
      const entry = PARAM.exec(text);
      if (!entry) return null;
      const [, name, quotedName, str, num, path, dotName, quotedDataset, index, field] = entry;
      params[name ?? unquote(quotedName)] =
        str !== undefined
          ? unquote(str)
          : num !== undefined
            ? Number(num)
            : lookup(path, dotName, quotedDataset, index, field);
    }
    return params;
  };

  // One pass: the output of a replacement is never scanned again, so a value that looks like a placeholder stays text.
  const html = template.replace(PLACEHOLDER, (match, dotName, quotedName, index, field, key, paramsText) => {
    const expression = match.slice(2, -1).trim();
    try {
      if (key === undefined) {
        const value = lookup(expression, dotName, quotedName, index, field);
        return value == null ? "" : escapeHtml(value);
      }
      const params = paramsText === undefined ? undefined : parseParams(paramsText);
      if (params === null) return match;
      return escapeHtml(t(unquote(key), params));
    } catch {
      // t() throws for a non-string translation, String() for a value without a usable toString
      report(expression);
      return "";
    }
  });

  return { html, unknown };
}
