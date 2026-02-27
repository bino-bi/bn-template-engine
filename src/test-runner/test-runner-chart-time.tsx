import { Component, h } from "@stencil/core";
import { SVGPolgonPattern } from "../utils/model";
import { DateDistance } from "../utils/DateStringFactory";
@Component({
  tag: "test-runner-chart-time",
})
export class TestRunnerChart {
  render() {
    const style: any = {
      scaleFactors: {
        scenarioOffset: 0.3,
        scenarioLabelToColumn: 0.3,
        labelToColum: 0.3,
        labelToAxis: 0.3,
        needleWidth: 0.3,
        needleHeadWidth: 0.6,
        columnWidth: 2.0,
        varianceAxisLineWidth: 0.3,
        axisLineWidth: 0.1,
        auxiliaryLineWidth: 0.1,
        scenarioLineWidth: 0.2,
        markerWidth: 0.7,
        markerOffset: 0.0,
        categoryWidth: 3.0,
        axisTickLength: 0.3,
      },
      fontStyles: {
        font: `27.3333px Sans-Serif`,
        size: 27.3333,
        color: "#000000",
        background: "#ffffff",
        leading: 1.8,
      },
      axisStyles: {
        ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
        fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, dasharray: "10 5 5 5" },
        pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
        pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
      },
      barStyles: {
        ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
        fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc" },
        pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
        pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
      },
      varianceStyles: {
        pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
        neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
        neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
      },
      padding: {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
      },
      pattern: new Map<string, SVGPolgonPattern>(),
    };

    const dataSet: any[] = [
      {
        setName: "de",
        date: "2022-03-01T01:05:00Z",
        operation: "+",
        rowGroup: "Afrika",
        rowGroupIndex: 1,
        category: "I",
        categoryIndex: 1,
        subCategory: "Question Mark",
        subCategoryIndex: 1,
        columnGroup: null,
        columnGroupIndex: null,
        columnSubGroup: null,
        columnSubGroupIndex: null,
        pp1: 100,
        ac1: 100,
        pl1: 100,
        fc1: 100,
        ac2: 0.001,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
      {
        setName: "de",
        date: "2022-03-01T01:00:00Z",
        operation: "+",
        rowGroup: "Amerika",
        rowGroupIndex: 1,
        category: "II",
        categoryIndex: 2,
        subCategory: "Stars",
        subCategoryIndex: 2,
        columnGroup: null,
        columnGroupIndex: null,
        columnSubGroup: null,
        columnSubGroupIndex: null,
        pp1: 1201,
        ac1: 300,
        pl1: 1209,
        fc1: 100,
        ac2: 0.001,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
      {
        setName: "de",
        date: "2022-03-01T01:06:00Z",
        operation: "+",
        rowGroup: "Asien",
        rowGroupIndex: 1,
        category: "III",
        categoryIndex: 3,
        subCategory: "Cash Cows",
        subCategoryIndex: 3,
        columnGroup: null,
        columnGroupIndex: null,
        columnSubGroup: null,
        columnSubGroupIndex: null,
        pp1: 835,
        ac1: 200,
        pl1: 955,
        fc1: 100,
        ac2: 0.001,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
      {
        setName: "de",
        date: "2022-03-01T00:59:00Z",
        operation: "+",
        rowGroup: "Europa",
        rowGroupIndex: 1,
        category: "Produktgrupppe IV",
        categoryIndex: 4,
        subCategory: "Poor Dogs",
        subCategoryIndex: 4,
        columnGroup: null,
        columnGroupIndex: null,
        columnSubGroup: null,
        columnSubGroupIndex: null,
        pp1: 423,
        ac1: 741,
        pl1: 641,
        fc1: 400,
        ac2: 0.001,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
      {
        setName: "de",
        date: "2022-03-01T00:59:01Z",
        operation: "+",
        rowGroup: "Rest",
        rowGroupIndex: 1,
        category: "Rest",
        categoryIndex: 5,
        subCategory: "Rest",
        subCategoryIndex: 5,
        columnGroup: null,
        columnGroupIndex: null,
        columnSubGroup: null,
        columnSubGroupIndex: null,
        pp1: 1,
        ac1: 400,
        pl1: 1,
        fc1: 100,
        ac2: 0.001,
        pp2: 7,
        fc2: 7,
        pl2: 4,
        ac3: 1,
        pp3: 7,
        fc3: 7,
        pl3: 4,
        ac4: 1,
        pp4: 7,
        fc4: 7,
        pl4: 4,
      },
    ];

    const trans = new Map<string, string>();
    trans.set("pp1", "PY");
    trans.set("ac1", "AC");
    trans.set("pl1", "PL");
    trans.set("fc1", "FC");

    //let scenarios = ["ac1", "pp1","pl1","fc1","dpl1_ac1_pos",""]
    //let leftSideOffset  = Formatter.getMaxWidthOfArrayItems(scenarios, trans, style);

    return (
      <div>
        <div style={{ fontFamily: style.fontStyles.font, fontSize: style.fontStyles.size + "px" }}>
          <div>T-2 1 Series MONTH</div>

          <ibcs-chart-time
            data={dataSet}
            scenarios={["ac2"]}
            variances={[]}
            pixelPerUnit={10}
            styles={style}
            date-interval={DateDistance.YEAR}
            interval-span-Limit={10}
            measureScale={"p"}
            measureUnit={"EUR"}
            showMeasureScale={true}
            dataFormatDigits={{ percent: 2, decimal: 2 }}
          ></ibcs-chart-time>
        </div>
      </div>
    );
  }
}

/*
  <ibcs-chart-time
          data={dataSet}
          scenarios={["ac1"]}
          pixelPerUnit={0.1}
          styles={style}
          date-interval={DateDistance.AUTO}
          interval-span-Limit = {10}
        ></ibcs-chart-time>


 */
