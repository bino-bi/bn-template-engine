import { readDiagnostics } from "./diagnostics";

const makeElement = (hasError?: string): HTMLElement => {
  const el = document.createElement("bn-table");
  if (hasError !== undefined) el.setAttribute("has-error", hasError);
  return el;
};

describe("readDiagnostics", () => {
  it("returns an empty list without a has-error attribute", () => {
    expect(readDiagnostics(makeElement())).toEqual([]);
  });

  it("parses the serialized error items", () => {
    const items = [
      { id: "WARN_overflow", type: "warning", message: "content exceeds available width (612px > 540px)" },
    ];
    expect(readDiagnostics(makeElement(JSON.stringify(items)))).toEqual(items);
  });

  it("returns an empty list for malformed JSON", () => {
    expect(readDiagnostics(makeElement("{not json"))).toEqual([]);
  });

  it("returns an empty list for non-array JSON", () => {
    expect(readDiagnostics(makeElement('{"type":"error"}'))).toEqual([]);
  });
});
