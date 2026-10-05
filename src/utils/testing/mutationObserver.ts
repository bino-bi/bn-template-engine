/**
 * Recording stand-in for `MutationObserver`.
 *
 * Spec-only. mock-doc has no `MutationObserver`, so a spec that needs an
 * attribute change to reach an observer installs this fake and reports the
 * change itself with `notifyAttributeChange`.
 */
interface AttributeRecord {
  target: Node;
  attributeName: string;
}

interface Watch {
  target: Node;
  attributeFilter?: string[];
}

const active = new Set<FakeMutationObserver>();

class FakeMutationObserver {
  private watches: Watch[] = [];

  constructor(private readonly callback: (records: AttributeRecord[]) => void) {}

  observe(target: Node, options?: { attributeFilter?: string[] }) {
    this.watches.push({ target, attributeFilter: options?.attributeFilter });
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
      (watch) => watch.target === target && (!watch.attributeFilter || watch.attributeFilter.includes(attributeName)),
    );
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
