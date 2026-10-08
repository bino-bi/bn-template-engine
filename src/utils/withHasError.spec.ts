// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

import { ErrorDispatcher, ErrorItem, reportOverflow } from "./withHasError";

/** A dispatcher over a plain list, as withHasError keeps it. */
const dispatcher = (): { errors: ErrorDispatcher; items: () => ErrorItem[] } => {
  let list: ErrorItem[] = [];
  const errors = {
    addOrReplace: (item: ErrorItem) => {
      list = [...list.filter((other) => other.id !== item.id), item];
      return item.id;
    },
    remove: (id: string) => {
      list = list.filter((item) => item.id !== id);
    },
  } as unknown as ErrorDispatcher;
  return { errors, items: () => list };
};

describe("reportOverflow", () => {
  it("reports a warning when the engine chose the size", () => {
    const { errors, items } = dispatcher();

    reportOverflow(errors, "too tall");

    expect(items()).toEqual([{ id: "WARN_overflow", type: "warning", message: "too tall" }]);
  });

  it("reports an error when the author fixed the size", () => {
    const { errors, items } = dispatcher();

    reportOverflow(errors, "too tall", true);

    expect(items()).toEqual([{ id: "ERR_overflow", type: "error", message: "too tall" }]);
  });

  it("keeps one item when the case changes", () => {
    const { errors, items } = dispatcher();

    reportOverflow(errors, "too tall", true);
    reportOverflow(errors, "still too tall");
    expect(items().map((item) => item.id)).toEqual(["WARN_overflow"]);

    reportOverflow(errors, "too tall again", true);
    expect(items().map((item) => item.id)).toEqual(["ERR_overflow"]);
  });

  it("clears both ids when the content fits", () => {
    const { errors, items } = dispatcher();
    reportOverflow(errors, "too tall", true);

    reportOverflow(errors, null);

    expect(items()).toEqual([]);
  });
});
