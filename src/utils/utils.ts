export function format(first: string, middle: string, last: string): string {
  return (
    (first || '') +
    (middle ? ` ${middle}` : '') +
    (last ? ` ${last}` : '')
  );
}

export const runIfExisits = (fn: unknown, context: any = undefined) => {
  if (typeof fn === 'function') {
    if (context) {
      fn.bind(context)();
    } else {
      fn();
    }
  }
}

export function generateUUID() {
  let
    d = new Date().getTime(),
    d2 = (performance && performance.now && (performance.now() * 1000)) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
  });
};

export const ref = <T>(value: T, onChange: (value: T | undefined) => void) => {
  var current = value;

  const get = () => (current)
  const set = (value: T) => {
    const old = current
    current = value
    if (old !== value)
      onChange(current)
  }
  const setAndGet = (value: T) => {
    set(value)
  }
  const getAndSet = (value: T) => {
    const old = get()
    set(value)
    return old;
  }

  const modify = (handler: (value: T) => T) => {
    set(handler(get()))
  }

  return {
    get, set, setAndGet, getAndSet, modify
  }
}
