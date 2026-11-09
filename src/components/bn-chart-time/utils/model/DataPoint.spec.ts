import { DataPoint } from "./DataPoint";
import { Scenario } from "./index";

describe("DataPoint variance sentiment", () => {
  // chart values carry their operation sign already
  it("reads op like pos and opinv like neg", () => {
    expect(new DataPoint(5, "dac1_pl1_op", 1, "op").variance).toBe(Scenario.POS);
    expect(new DataPoint(5, "dac1_pl1_opinv", 1, "opinv").variance).toBe(Scenario.NEG);
  });

  it("keeps pos, neg and neu", () => {
    expect(new DataPoint(5, "dac1_pl1_pos", 1, "pos").variance).toBe(Scenario.POS);
    expect(new DataPoint(5, "dac1_pl1_neg", 1, "neg").variance).toBe(Scenario.NEG);
    expect(new DataPoint(5, "dac1_pl1_neu", 1, "neu").variance).toBe(Scenario.NEU);
  });
});
