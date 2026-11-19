import { StructureChartStylesAdapter } from "./StructureChartStyle";
import { ScaleFactorsStructureChartAdapter } from "./ScaleFactorsStructureChart";
import { FontStyleAdapter } from "../../../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../../../utils/model/styles/Padding";

const adapt = (data: Record<string, unknown>) =>
  new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt(data);

describe("StructureChartStylesAdapter", () => {
  it("reads titleBold, and takes anything but true as false", () => {
    expect(adapt({ titleBold: true }).titleBold).toBe(true);
    expect(adapt({ titleBold: "yes" }).titleBold).toBe(false);
    expect(adapt({}).titleBold).toBe(false);
  });
});
