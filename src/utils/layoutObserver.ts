/**
 * Shared ResizeObserver utility for visualization components.
 *
 * Wraps ResizeObserver with debouncing and a size-stability check so
 * auto-scaling logic reacts to genuine container size changes (window
 * resizes, card relayouts, async sibling loads) without creating
 * feedback loops when the component's own scaling changes its content
 * dimensions.
 */

const DEFAULT_DEBOUNCE_MS = 80;
const SIZE_THRESHOLD_PX = 2;

export interface LayoutObserverHandle {
  /** Stop observing and clean up. Call in disconnectedCallback. */
  disconnect(): void;
}

/**
 * Observes the parent container of `element` for size changes.
 *
 * The callback only fires when the observed target's dimensions change
 * by more than {@link SIZE_THRESHOLD_PX} pixels compared to the last
 * time the callback was invoked. This prevents feedback loops where
 * auto-scaling → font-size change → content reflow → ResizeObserver
 * fires again → auto-scaling …
 *
 * @param element  The component's host element
 * @param callback Called when the observed parent genuinely resizes
 * @param debounceMs Debounce interval (default 80ms)
 */
export function observeParentResize(
  element: HTMLElement,
  callback: () => void,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): LayoutObserverHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disconnected = false;
  let lastWidth = -1;
  let lastHeight = -1;

  const target = findObservationTarget(element);
  if (!target) {
    return { disconnect() {} };
  }

  const observer = new ResizeObserver((entries) => {
    if (disconnected) return;

    // Use the first entry's contentBoxSize when available, fall back
    // to the target's clientWidth/clientHeight.
    let w: number;
    let h: number;
    const entry = entries[0];
    if (entry?.contentBoxSize?.length) {
      const box = entry.contentBoxSize[0];
      w = box.inlineSize;
      h = box.blockSize;
    } else {
      w = target.clientWidth;
      h = target.clientHeight;
    }

    // Only fire when the parent genuinely resized - not when the
    // child's own scaling caused a sub-pixel content reflow.
    if (Math.abs(w - lastWidth) <= SIZE_THRESHOLD_PX && Math.abs(h - lastHeight) <= SIZE_THRESHOLD_PX) {
      return;
    }

    lastWidth = w;
    lastHeight = h;

    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disconnected) callback();
    }, debounceMs);
  });

  observer.observe(target);

  return {
    disconnect() {
      disconnected = true;
      if (timer != null) clearTimeout(timer);
      observer.disconnect();
    },
  };
}

/**
 * Finds the best element to observe for size changes.
 * Prefers the slot wrapper inside the shadow DOM (the actual layout
 * container), falls back to the light DOM parent.
 */
function findObservationTarget(element: HTMLElement): HTMLElement | null {
  const lightParent = element.parentElement;
  if (lightParent?.assignedSlot?.parentElement) {
    return lightParent.assignedSlot.parentElement as HTMLElement;
  }
  return lightParent;
}
