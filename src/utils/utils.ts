/** Concatenates name parts with spaces, skipping falsy segments. */
export function format(first: string, middle: string, last: string): string {
  return (first || "") + (middle ? ` ${middle}` : "") + (last ? ` ${last}` : "");
}

/**
 * Safely invokes `fn` if it is a function; otherwise does nothing.
 *
 * Used by every mixin to call the original lifecycle hook (e.g. `connectedCallback`)
 * that may or may not exist on the component before the mixin wrapped it.
 *
 * @param fn - The value to invoke (only called if `typeof fn === 'function'`)
 * @param context - Optional `this` context to bind before invocation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runIfExisits = (fn: unknown, context: any = undefined) => {
  if (typeof fn === "function") {
    if (context) {
      fn.bind(context)();
    } else {
      fn();
    }
  }
};

/**
 * Generates a v4-style UUID using a combination of `Date.now()` and
 * `performance.now()` for entropy. Used by {@link withComponentStatus}
 * to assign a stable identifier to each component instance.
 */
export function generateUUID() {
  let d = new Date().getTime(),
    d2 = (performance && performance.now && performance.now() * 1000) || 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = ((d + r) % 16) | 0;
      d = Math.floor(d / 16);
    } else {
      r = ((d2 + r) % 16) | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c == "x" ? r : (r & 0x7) | 0x8).toString(16);
  });
}

/**
 * Creates a reactive reference -- a lightweight value holder that fires an
 * `onChange` callback whenever the stored value changes (by reference equality).
 *
 * Provides `get`, `set`, `modify` (read-modify-write), and `getAndSet` (swap)
 * accessors. Used by {@link withHasError} to keep the host element's `has-error`
 * attribute in sync with the internal error list.
 *
 * @param value - The initial value
 * @param onChange - Callback fired after each change with the new value
 */
export const ref = <T>(value: T, onChange: (value: T | undefined) => void) => {
  let current = value;

  const get = () => current;
  const set = (value: T) => {
    const old = current;
    current = value;
    if (old !== value) onChange(current);
  };
  const setAndGet = (value: T) => {
    set(value);
  };
  const getAndSet = (value: T) => {
    const old = get();
    set(value);
    return old;
  };

  const modify = (handler: (value: T) => T) => {
    set(handler(get()));
  };

  return {
    get,
    set,
    setAndGet,
    getAndSet,
    modify,
  };
};
