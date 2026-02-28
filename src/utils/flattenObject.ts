/**
 * Recursively flattens a nested object into a single-depth object with
 * dot-separated keys.
 *
 * Used by the i18n store to convert hierarchical locale files into a flat
 * lookup map, e.g. `{ a: { b: "hello" } }` becomes `{ "a.b": "hello" }`.
 *
 * @param ob - The nested object to flatten
 * @param prefix - Internal accumulator for the current key path (omit on initial call)
 * @param result - Internal accumulator for the output object (omit on initial call)
 * @returns A flat object with dot-separated keys mapping to leaf values
 */
export default function flattenObject(ob, prefix: string | undefined = undefined, result = null) {
  result = result || {};
  prefix = prefix ? prefix + "." : "";

  for (const i in ob) {
    if (Object.prototype.hasOwnProperty.call(ob, i)) {
      if (typeof ob[i] === "object" && ob[i] !== null) {
        // Recursion on deeper objects
        flattenObject(ob[i], prefix + i, result);
      } else {
        result[prefix + i] = ob[i];
      }
    }
  }
  return result;
}
