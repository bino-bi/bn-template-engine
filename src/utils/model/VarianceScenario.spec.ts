import { resolveSentiment, VarianceScenario } from "./VarianceScenario";

describe("VarianceScenario", () => {
  it("parses the op and opinv suffixes", () => {
    const op = new VarianceScenario("dac1_pl1_op");
    expect(op.isValid).toBe(true);
    expect(op.direction).toBe("op");

    const opinv = new VarianceScenario("drac1_pl1_opinv");
    expect(opinv.isValid).toBe(true);
    expect(opinv.type).toBe("dr");
    expect(opinv.direction).toBe("opinv");
  });

  it("does not read opinv as op", () => {
    expect(new VarianceScenario("dac1_pl1_opinv").direction).toBe("opinv");
  });

  it("keeps parsing pos, neg and neu", () => {
    expect(new VarianceScenario("dac1_pl1_pos").direction).toBe("pos");
    expect(new VarianceScenario("dac1_pl1_neg").direction).toBe("neg");
    expect(new VarianceScenario("dac1_pl1_neu").direction).toBe("neu");
  });
});

describe("resolveSentiment", () => {
  it("resolves op by the row operation for unsigned values", () => {
    expect(resolveSentiment("op", "+", false)).toBe("pos");
    expect(resolveSentiment("op", "=", false)).toBe("pos");
    expect(resolveSentiment("op", "-", false)).toBe("neg");
    expect(resolveSentiment("op", null, false)).toBe("pos");
  });

  it("resolves opinv as the inverse of op", () => {
    expect(resolveSentiment("opinv", "+", false)).toBe("neg");
    expect(resolveSentiment("opinv", "=", false)).toBe("neg");
    expect(resolveSentiment("opinv", "-", false)).toBe("pos");
  });

  it("treats op as pos and opinv as neg for signed values", () => {
    expect(resolveSentiment("op", "-", true)).toBe("pos");
    expect(resolveSentiment("opinv", "-", true)).toBe("neg");
  });

  it("leaves pos, neg and neu alone", () => {
    for (const direction of ["pos", "neg", "neu"]) {
      expect(resolveSentiment(direction, "-", false)).toBe(direction);
    }
  });
});
