/** Stand-in for a svg.js group: records the calls on itself, every group() gives a new stand-in. */
export interface FakeGroup {
  calls: [string, unknown[]][];
  groups: FakeGroup[];
  node: unknown;
}

export const fakeGroup = (): FakeGroup => {
  const fake: FakeGroup = { calls: [], groups: [], node: undefined };
  fake.node = new Proxy(() => undefined, {
    get: (_target, name) => {
      if (typeof name === "symbol") return undefined;
      if (name === "toString" || name === "valueOf") return () => "g";
      return (...args: unknown[]) => {
        fake.calls.push([name, args]);
        if (name !== "group") return fake.node;
        const child = fakeGroup();
        fake.groups.push(child);
        return child.node;
      };
    },
  });
  return fake;
};

export const callNames = (group: FakeGroup): string[] => group.calls.map(([name]) => name);
