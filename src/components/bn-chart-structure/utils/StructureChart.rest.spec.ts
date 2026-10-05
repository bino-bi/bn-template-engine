import { StructureChart } from "./StructureChart";
import { buildStructureChart, structureRow } from "../../../utils/testing/structureChart";

interface Row {
  category: string;
  scenario1: { value: number };
  scenario2: { value: number };
}

const ROWS = [
  structureRow("A", 1, { ac1: 100, pp1: 90 }),
  structureRow("B", 2, { ac1: 50, pp1: 40 }),
  structureRow("C", 3, { ac1: 20, pp1: 10 }),
  structureRow("D", 4, { ac1: 5, pp1: 5 }),
];

const model = (chart: StructureChart): Row[] => (chart as unknown as { dataModel: Row[] }).dataModel;

const acChart = (limit: number, rows = ROWS.slice(0, 3)): [string, number][] =>
  model(buildStructureChart(rows, { scenarios: ["ac1"], limit })).map((row) => [row.category, row.scenario1.value]);

describe("structure chart REST row", () => {
  it("sums every row after the limit", () => {
    expect(acChart(1)).toEqual([
      ["A", 100],
      ["REST", 70],
    ]);
  });

  it("sums two of four rows for a limit of 2", () => {
    expect(acChart(2, ROWS)).toEqual([
      ["A", 100],
      ["B", 50],
      ["REST", 25],
    ]);
  });

  it("sums every scenario", () => {
    const rows = model(buildStructureChart(ROWS, { scenarios: ["ac1", "pp1"], limit: 1 }));
    const rest = rows[rows.length - 1];
    const values = [rest.scenario1.value, rest.scenario2.value].sort((a, b) => a - b);

    expect(rest.category).toBe("REST");
    expect(values).toEqual([55, 75]);
  });

  it.each([0, 3, 5, -2])("has no REST row when the limit %d cuts nothing", (limit) => {
    expect(acChart(limit)).toEqual([
      ["A", 100],
      ["B", 50],
      ["C", 20],
    ]);
  });

  it("leaves a row without a value out of the sum", () => {
    const rows = [...ROWS.slice(0, 3), structureRow("D", 4, { pp1: 5 })];

    expect(acChart(1, rows)).toEqual([
      ["A", 100],
      ["REST", 70],
    ]);
  });
});
