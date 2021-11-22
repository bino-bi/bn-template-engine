export default function flattenObject(ob, prefix: string | undefined = undefined, result = null) {
  result = result || {};
  prefix = prefix ? prefix + '.' : '';

  for (const i in ob) {
    if (Object.prototype.hasOwnProperty.call(ob, i)) {
      if (typeof ob[i] === 'object' && ob[i] !== null) {
        // Recursion on deeper objects
        flattenObject(ob[i], prefix + i, result);
      } else {
        result[prefix + i] = ob[i];
      }
    }
  }
  return result;
}
