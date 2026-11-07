/** Spec-only. mock-doc has no layout: give an element a fixed viewport box. */
export function place(
  el: Element | null | undefined,
  box: { left: number; top: number; width: number; height: number },
) {
  if (!el) throw new Error("place: no element");
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top,
      toJSON: () => box,
    }) as DOMRect;
}
