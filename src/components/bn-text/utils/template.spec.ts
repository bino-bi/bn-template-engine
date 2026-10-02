import { renderTemplate } from "./template";

const data = {
  kpi: [
    {
      ac1: 12.5,
      name: "<b>x</b>",
      note: null,
      quote: `Men's "Wear" & Co`,
      tpl: "${t('title')}",
      größe: 7,
      broken: { toString: 1 },
    },
  ],
  $rev: [{ name: "Ada" }],
};

const calls: [string, object | undefined][] = [];
const t = (key: string, params?: object): string => {
  calls.push([key, params]);
  if (key === "title") return "R&D <draft>";
  if (key === "greet") return `Hello ${(params as Record<string, unknown>).name}`;
  if (key === "throws") throw new Error("not a string");
  return key;
};
const render = (template: string) => renderTemplate(template, data, t);

describe("renderTemplate", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("replaces a data path", () => {
    expect(render("Revenue: ${data.kpi[0].ac1} EUR")).toEqual({ html: "Revenue: 12.5 EUR", unknown: [] });
    expect(render("${ data.kpi[ 0 ].ac1 }").html).toBe("12.5");
    expect(render("${data.kpi[0].größe}").html).toBe("7");
  });

  it.each([
    "${data['$rev'][0].name}",
    '${data["$rev"][0].name}',
    "${data.$rev[0].name}",
    "${this.data['$rev'][0].name}",
  ])("reads the dataset name from %s", (template) => {
    expect(render(template).html).toBe("Ada");
  });

  it("replaces a translation key", () => {
    expect(render("<b>${t('x')}</b>").html).toBe("<b>x</b>");
    expect(calls).toEqual([["x", undefined]]);
  });

  it("passes text, numbers and data values to the translation", () => {
    expect(render("${t('greet', { name: 'Ada' })}").html).toBe("Hello&#32;Ada");
    expect(render("${t('greet', { name: data.kpi[0].name })}").html).toBe("Hello&#32;&#60;b&#62;x&#60;/b&#62;");
    render(`\${t('k', { a: 'x, y', "b": -1.5, c: data.$rev[0].name, })}`);
    expect(calls.pop()).toEqual(["k", { a: "x, y", b: -1.5, c: "Ada" }]);
  });

  it("escapes every resolved value", () => {
    expect(render("${data.kpi[0].name}").html).toBe("&#60;b&#62;x&#60;/b&#62;");
    expect(render("${data.kpi[0].quote}").html).toBe("Men&#39;s&#32;&#34;Wear&#34;&#32;&#38;&#32;Co");
    expect(render("${t('title')}").html).toBe("R&#38;D&#32;&#60;draft&#62;");
  });

  it("does not scan a resolved value again", () => {
    expect(render("${data.kpi[0].tpl}").html).toBe("${t(&#39;title&#39;)}");
    expect(calls).toEqual([]);
  });

  it.each([
    "${t['constr'+'uctor']('return this')().__pwned=1}",
    "${(function(){return this})().__pwned=1}",
    "C:\\users\\report",
    "a `b` c",
    "${1+1}",
    "${data.kpi.length}",
    "${data.kpi[0].ac1.toFixed(1)}",
    "${t('k')()}",
    "${t('k', {a: window})}",
    "${t('k', 1)}",
    "${data.revenue.ac1}",
    "$& $1 $$",
  ])("leaves %s as it is", (template) => {
    expect(render(template)).toEqual({ html: template, unknown: [] });
    expect(calls).toEqual([]);
    expect((globalThis as any).__pwned).toBeUndefined();
  });

  it("renders an unknown path empty and reports it once", () => {
    expect(render("${data.kpi[1].ac1}|${data.nope[0].x}|${data.kpi[0].nope}|${data.nope[0].x}")).toEqual({
      html: "|||",
      unknown: ["data.kpi[1].ac1", "data.nope[0].x", "data.kpi[0].nope"],
    });
  });

  it("renders null empty without a report", () => {
    expect(render("${data.kpi[0].note}")).toEqual({ html: "", unknown: [] });
  });

  it("does not follow the prototype chain", () => {
    const result = render("${data.constructor[0].name}${data.__proto__[0].x}${data.kpi[0].constructor}");
    expect(result.html).toBe("");
    expect(result.unknown).toHaveLength(3);
  });

  it("renders empty and reports when a value or a translation cannot be read", () => {
    expect(render("a${data.kpi[0].broken}b")).toEqual({ html: "ab", unknown: ["data.kpi[0].broken"] });
    expect(render("a${t('throws')}b")).toEqual({ html: "ab", unknown: ["t('throws')"] });
  });
});
