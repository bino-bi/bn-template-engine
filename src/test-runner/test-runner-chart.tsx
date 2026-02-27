import {Component, h} from "@stencil/core";
import { OrderDirection } from "../utils/model/Order";
import { AggregationLevel } from "../utils/constants";

@Component({
  tag: "test-runner-chart",
})

export class TestRunnerChart {
  render() {
    let style: any = {
      scaleFactors: {
        scenarioOffset: 0.3,
        scenarioLabelToBar: 0.1,
        labelToBar: 0.3,
        labelToAxis: 0.3,
        needleWidth: 0.3,
        needleHeadWidth: 0.6,
        barWidth: 1.2,
        varianceAxisLineWidth: 0.3,
        axisLineWidth: 0.1,
        auxiliaryLineWidth: 0.1,
        scenarioLineWidth: 0.2,
        markerWidth: 0.7,
        markerOffset: 0.0,
        categoryWidth: 1.9,
        axisTickLength: 0.3,
      },
      fontStyles: {
        font: `13.3333px 'Noto Sans'`,
        size: 13.3333,
        color: "#000000",
        background: "#ffffff",
        leading: 1.8,
      },
      "axisStyles": {
        ac: {stroke: "#121212", fill: "#121212", width: 0.1},
        fc: {stroke: "#121212", fill: "#ffffff", width: 0.1, "dasharray": "10 5 5 5"},
        pp: {stroke: "#606060", fill: "#606060", width: 0.1},
        pl: {stroke: "#121212", fill: "#ffffff", width: 0.1},
      },
      "barStyles": {
        ac: {stroke: "#404040", fill: "#404040", width: 0.1},
        fc: {stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc"},
        pp: {stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1},
        pl: {stroke: "#404040", fill: "#ffffff", width: 0.1},
      },
      "varianceStyles": {
        pos: {stroke: "#008f96", fill: "#008f96", width: 0.1},
        neg: {stroke: "#ff0000", fill: "#ff0000", width: 0.1},
        neu: {stroke: "#808080", fill: "#808080", width: 0.1},
      },
      "padding": {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
      },
      pattern: new Map(),
    };


    let dataSet2: any[] = [
      {
        "operation": "+",
        "rowGroup": "Afrika",
        "rowGroupIndex": 1,
        "category": "I",
        "categoryIndex": 1,
        "subCategory": "Question Mark",
        "subCategoryIndex": 1,
        "columnGroup": null,
        "columnGroupIndex": null,
        "columnSubGroup": null,
        "columnSubGroupIndex": null,
        "pp1": 1267,
        "ac1": 1267,
        "pl1": 900,
        "fc1": 33500,
        "ac2": 1,
        "pp2": 7,
        "fc2": 7,
        "pl2": 4,
        "ac3": 1,
        "pp3": 7,
        "fc3": 7,
        "pl3": 4,
        "ac4": 1,
        "pp4": 7,
        "fc4": 7,
        "pl4": 4
      },
      {
        "operation": "+",
        "rowGroup": "Amerika",
        "rowGroupIndex": 2,
        "category": "II",
        "categoryIndex": 2,
        "subCategory": "Stars",
        "subCategoryIndex": 2,
        "columnGroup": null,
        "columnGroupIndex": null,
        "columnSubGroup": null,
        "columnSubGroupIndex": null,
        "pp1": 1201,
        "ac1": 1209,
        "pl1": 1209,
        "fc1": 1009,
        "ac2": 1,
        "pp2": 7,
        "fc2": 7,
        "pl2": 4,
        "ac3": 1,
        "pp3": 7,
        "fc3": 7,
        "pl3": 4,
        "ac4": 1,
        "pp4": 7,
        "fc4": 7,
        "pl4": 4
      },
      {
        "operation": "+",
        "rowGroup": "Asien",
        "rowGroupIndex": 3,
        "category": "III",
        "categoryIndex": 3,
        "subCategory": "Cash Cows",
        "subCategoryIndex": 3,
        "columnGroup": null,
        "columnGroupIndex": null,
        "columnSubGroup": null,
        "columnSubGroupIndex": null,
        "pp1": 835,
        "ac1": 965,
        "pl1": 955,
        "fc1": 965,
        "ac2": 1,
        "pp2": 7,
        "fc2": 7,
        "pl2": 4,
        "ac3": 1,
        "pp3": 7,
        "fc3": 7,
        "pl3": 4,
        "ac4": 1,
        "pp4": 7,
        "fc4": 7,
        "pl4": 4
      },
      {
        "operation": "+",
        "rowGroup": "Europa",
        "rowGroupIndex": 4,
        "category": "Produktgrupppe IV",
        "categoryIndex": 4,
        "subCategory": "Poor Dogs",
        "subCategoryIndex": 4,
        "columnGroup": null,
        "columnGroupIndex": null,
        "columnSubGroup": null,
        "columnSubGroupIndex": null,
        "pp1": 423,
        "ac1": 741,
        "pl1": 641,
        "fc1": 741,
        "ac2": 1,
        "pp2": 7,
        "fc2": 7,
        "pl2": 4,
        "ac3": 1,
        "pp3": 7,
        "fc3": 7,
        "pl3": 4,
        "ac4": 1,
        "pp4": 7,
        "fc4": 7,
        "pl4": 4
      },
      {
        "operation": "+",
        "rowGroup": "Rest",
        "rowGroupIndex": 5,
        "category": "Rest",
        "categoryIndex": 5,
        "subCategory": "Rest",
        "subCategoryIndex": 5,
        "columnGroup": null,
        "columnGroupIndex": null,
        "columnSubGroup": null,
        "columnSubGroupIndex": null,
        "pp1": 4460,
        "ac1": -9000,
        "pl1": 110,
        "fc1": 30900,
        "ac2": 1,
        "pp2": 7,
        "fc2": 7,
        "pl2": 4,
        "ac3": 1,
        "pp3": 7,
        "fc3": 7,
        "pl3": 4,
        "ac4": 1,
        "pp4": 7,
        "fc4": 7,
        "pl4": 4
      }
    ];
/*
    let dataSet: any[] = [
        {
          "operation": "+",
          "rowGroup": "Afrika",
          "rowGroupIndex": 1,
          "category": "I",
          "categoryIndex": 1,
          "subCategory": "Question Mark",
          "subCategoryIndex": 1,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 1,
          "ac1": 1,
          "pl1": 900,
          "fc1": 500,
          "ac2": 1,
          "pp2": 7,
          "fc2": 7,
          "pl2": 4,
          "ac3": 1,
          "pp3": 7,
          "fc3": 7,
          "pl3": 4,
          "ac4": 1,
          "pp4": 7,
          "fc4": 7,
          "pl4": 4
        },
        {
          "operation": "+",
          "rowGroup": "Amerika",
          "rowGroupIndex": 1,
          "category": "II",
          "categoryIndex": 2,
          "subCategory": "Stars",
          "subCategoryIndex": 2,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 1201,
          "ac1": 1209,
          "pl1": 1209,
          "fc1": 1009,
          "ac2": 1,
          "pp2": 7,
          "fc2": 7,
          "pl2": 4,
          "ac3": 1,
          "pp3": 7,
          "fc3": 7,
          "pl3": 4,
          "ac4": 1,
          "pp4": 7,
          "fc4": 7,
          "pl4": 4
        },
        {
          "operation": "+",
          "rowGroup": "Asien",
          "rowGroupIndex": 1,
          "category": "III",
          "categoryIndex": 3,
          "subCategory": "Cash Cows",
          "subCategoryIndex": 3,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": -835,
          "ac1": 965,
          "pl1": 955,
          "fc1": 975,
          "ac2": 1,
          "pp2": 7,
          "fc2": 7,
          "pl2": 4,
          "ac3": 1,
          "pp3": 7,
          "fc3": 7,
          "pl3": 4,
          "ac4": 1,
          "pp4": 7,
          "fc4": 7,
          "pl4": 4
        },
        {
          "operation": "+",
          "rowGroup": "Europa",
          "rowGroupIndex": 1,
          "category": "Produktgrupppe IV",
          "categoryIndex": 4,
          "subCategory": "Poor Dogs",
          "subCategoryIndex": 4,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 423,
          "ac1": 741,
          "pl1": 641,
          "fc1": 841,
          "ac2": 1,
          "pp2": 7,
          "fc2": 7,
          "pl2": 4,
          "ac3": 1,
          "pp3": 7,
          "fc3": 7,
          "pl3": 4,
          "ac4": 1,
          "pp4": 7,
          "fc4": 7,
          "pl4": 4
        },
        {
          "operation": "+",
          "rowGroup": "Rest",
          "rowGroupIndex": 1,
          "category": "Rest",
          "categoryIndex": 5,
          "subCategory": "Rest",
          "subCategoryIndex": 5,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 460,
          "ac1": 900,
          "pl1": 110,
          "fc1": 130,
          "ac2": 1,
          "pp2": 7,
          "fc2": 7,
          "pl2": 4,
          "ac3": 1,
          "pp3": 7,
          "fc3": 7,
          "pl3": 4,
          "ac4": 1,
          "pp4": 7,
          "fc4": 7,
          "pl4": 4
        }
      ];
*/
   // let trans =  new Map<string, string>();
   // trans.set('pp1',"TEST");
   // trans.set('ac1',"TEST");
    return (<div>
 
      <div style = {{fontFamily: style.fontStyles.font, fontSize: style.fontStyles.size + "px"}}>
        <div>T-7b Variances Absolute</div>
        <ibcs-chart-structure
          data={dataSet2}
          scenarios={["pp1", "ac1", "pl1"]}
          variances={[]}
          hideCategories={false}
          pixelPerUnit={0.01}
          chartTitle={"Test"}
          filter={''}
          measureScale={"k"}
          measureUnit={"EUR"}
          showMeasureScale={true}
          dataFormatDigits={{ percent: 1, decimal: 1 }}
          level={ AggregationLevel.ROWGROUP}
          order={
            {
              hierarchy: ['rowGroupIndex'],
              direction: OrderDirection.ASC,
            }
          }
        ></ibcs-chart-structure> 
         <ibcs-chart-structure
          data={dataSet2}
          scenarios={["pp1", "ac1", "pl1"]}
          variances={["drac_pp1_neu"]}
          hideCategories={false}
          pixelPerUnit={0.01}
          chartTitle={""}
          filter={''}
          measureScale={"k"}
          measureUnit={"EUR"}
          showMeasureScale={false}
          dataFormatDigits={{ percent: 1, decimal: 1 }}
          level={ AggregationLevel.ROWGROUP}
          order={
            {
              hierarchy: ['rowGroupIndex'],
              direction: OrderDirection.ASC,
            }
          }
        ></ibcs-chart-structure>             
      </div>
     
    </div>)
  }
}
