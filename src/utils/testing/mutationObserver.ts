/**
 * Recording stand-in for `MutationObserver`.
 *
 * Spec-only. mock-doc has no `MutationObserver`, so a spec that needs a
 * change to reach an observer installs this fake and reports the change
 * itself with `notifyAttributeChange` or `notifyChildListChange`.
 */
interface AttributeRecord {
  target: Node;
  attributeName?: string;
}

interface Watch {
  target: Node;
  attributeFilter?: string[];
  childList?: boolean;
  subtree?: boolean;
}

const covers = (watch: Watch, target: Node): boolean =>
  watch.target === target || (watch.subtree === true && watch.target.contains(target));

const active = new Set<FakeMutationObserver>();

class FakeMutationObserver {
  private watches: Watch[] = [];

  constructor(private readonly callback: (records: AttributeRecord[]) => void) {}

  observe(target: Node, options?: { attributeFilter?: string[]; childList?: boolean; subtree?: boolean }) {
    this.watches.push({ target, ...options });
    active.add(this);
  }

  disconnect() {
    this.watches = [];
    active.delete(this);
  }

  takeRecords() {
    return [];
  }

  watchesAttribute(target: Node, attributeName: string): boolean {
    return this.watches.some(
      (watch) => covers(watch, target) && (!watch.attributeFilter || watch.attributeFilter.includes(attributeName)),
    );
  }

  watchesChildList(target: Node): boolean {
    return this.watches.some((watch) => watch.childList === true && covers(watch, target));
  }

  deliver(records: AttributeRecord[]) {
    this.callback(records);
  }
}

export const installMutationObserverFake = () => {
  (globalThis as { MutationObserver: unknown }).MutationObserver = FakeMutationObserver;
};

/** Calls every observer that watches `attributeName` on `target`. */
export const notifyAttributeChange = (target: Node, attributeName: string) => {
  // Snapshot first: a callback may disconnect and observe again.
  [...active]
    .filter((observer) => observer.watchesAttribute(target, attributeName))
    .forEach((observer) => observer.deliver([{ target, attributeName }]));
};

/** Calls every observer that watches the child list of `target`, or of an ancestor with its subtree. */
export const notifyChildListChange = (target: Node) => {
  [...active]
    .filter((observer) => observer.watchesChildList(target))
    .forEach((observer) => observer.deliver([{ target }]));
};
