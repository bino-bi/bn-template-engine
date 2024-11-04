import {Component, h} from "@stencil/core";
// import {DateDistance} from "@bino-bi/ibcs-component-interface";
import {SVGPolgonPattern} from "../utils/model";
import { DateDistance } from "../utils/DateStringFactory";

@Component({
  tag: "test-runner-time",
})

export class TestRunnerTime {
  render() {
    let style: any = {
      scaleFactors: {
        scenarioOffset:        0.3,
        scenarioLabelToColumn: 0.3,
        labelToColum:          0.3,
        labelToAxis:           0.3,
        needleWidth:           0.3,
        needleHeadWidth:       0.6,
        columnWidth:           2.0,
        varianceAxisLineWidth: 0.3,
        axisLineWidth:         0.1,
        auxiliaryLineWidth:    0.1,
        scenarioLineWidth:     0.2,
        markerWidth:           0.7,
        markerOffset:          0.0,
        categoryWidth:         3.0,
        axisTickLength:        0.3,
      },
      fontStyles: {
        font: `27.3333px Sans-Serif`,
        size: 27.3333,
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
      pattern: new Map<string, SVGPolgonPattern>(),
    };

    let verlaufsgrafik: any[] = [
        {
          "setName": "de",
          "date": "2020-12-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 1,
          "subCategory": "",
          "subCategoryIndex": 1,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 6500,
          "ac1": 7000,
          "pl1": 7500,
          "fc1": 8000,
          "pp2": 6250,
          "ac2": 6750,
          "pl2": 7250,
          "fc2": 7750,
          "pp3": 6000,
          "ac3": 7000,
          "pl3": 6500,
          "fc3": 7500,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date":"2021-03-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 2,
          "subCategory": "",
          "subCategoryIndex": 2,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 6750,
          "ac1": 7250,
          "pl1": 7750,
          "fc1": 8250,
          "pp2": 6500,
          "ac2": 7000,
          "pl2": 7500,
          "fc2": 8000,
          "pp3": 6250,
          "ac3": 7250,
          "pl3": 6750,
          "fc3": 7750,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2021-06-30T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 3,
          "subCategory": "",
          "subCategoryIndex": 3,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 7000,
          "ac1": 7500,
          "pl1": 8000,
          "fc1": 8500,
          "pp2": 6750,
          "ac2": 7250,
          "pl2": 7750,
          "fc2": 8250,
          "pp3": 6500,
          "ac3": 7500,
          "pl3": 7000,
          "fc3": 8000,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2021-09-30T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 4,
          "subCategory": "",
          "subCategoryIndex": 4,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 7250,
          "ac1": 7750,
          "pl1": 8250,
          "fc1": 8750,
          "pp2": 7000,
          "ac2": 7500,
          "pl2": 8000,
          "fc2": 8500,
          "pp3": 6750,
          "ac3": 7750,
          "pl3": 7250,
          "fc3": 8250,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2021-12-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Rest",
          "categoryIndex": 5,
          "subCategory": "Rest",
          "subCategoryIndex": 5,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 7500,
          "ac1": 8000,
          "pl1": 8500,
          "fc1": 9000,
          "pp2": 7250,
          "ac2": 7750,
          "pl2": 8250,
          "fc2": 8750,
          "pp3": 7000,
          "ac3": 8000,
          "pl3": 7500,
          "fc3": 8500,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2022-03-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 1,
          "subCategory": "",
          "subCategoryIndex": 1,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 7750,
          "ac1": 8250,
          "pl1": 8750,
          "fc1": 9250,
          "pp2": 8500,
          "ac2": 8000,
          "pl2": 8500,
          "fc2": 9000,
          "pp3": 7250,
          "ac3": 8250,
          "pl3": 7750,
          "fc3": 8750,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2022-06-30T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 2,
          "subCategory": "",
          "subCategoryIndex": 2,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 8000,
          "ac1": 8500,
          "pl1": 9000,
          "fc1": 9500,
          "pp2": 8750,
          "ac2": 8250,
          "pl2": 8750,
          "fc2": 9250,
          "pp3": 7500,
          "ac3": 8500,
          "pl3": 8000,
          "fc3": 9000,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date":"2022-09-30T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 3,
          "subCategory": "",
          "subCategoryIndex": 3,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 8250,
          "ac1": 8750,
          "pl1": 9250,
          "fc1": 9750,
          "pp2": 9000,
          "ac2": 8500,
          "pl2": 9000,
          "fc2": 9500,
          "pp3": 7750,
          "ac3": 8750,
          "pl3": 8250,
          "fc3": 9250,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date":"2022-12-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Immobilien",
          "categoryIndex": 4,
          "subCategory": "",
          "subCategoryIndex": 4,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 8500,
          "ac1": 9000,
          "pl1": 9500,
          "fc1": 10000,
          "pp2": 9250,
          "ac2": 8750,
          "pl2": 9250,
          "fc2": 9750,
          "pp3": 8000,
          "ac3": 9000,
          "pl3": 8500,
          "fc3": 9500,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        },
        {
          "setName": "de",
          "date": "2023-03-31T00:02:00+02:00",
          "operation": "+",
          "rowGroup": "Real Assets",
          "rowGroupIndex": 1,
          "category": "Rest",
          "categoryIndex": 1,
          "subCategory": "Rest",
          "subCategoryIndex": 1,
          "columnGroup": null,
          "columnGroupIndex": null,
          "columnSubGroup": null,
          "columnSubGroupIndex": null,
          "pp1": 8750,
          "ac1": 9250,
          "pl1": 9750,
          "fc1": 10250,
          "pp2": 9500,
          "ac2": 9000,
          "pl2": 9500,
          "fc2": 10000,
          "pp3": 8250,
          "ac3": 9250,
          "pl3": 8750,
          "fc3": 9750,
          "pp4": 0,
          "ac4": 0,
          "pl4": 0,
          "fc4": 0
        }
      ];

   // let trans =  new Map<string, string>();
   // trans.set('pp1',"TEST");
   // trans.set('ac1',"TEST");
    return (<div>
      <div style = {{fontFamily: style.fontStyles.font, fontSize: style.fontStyles.size + "px"}}>


        <ibcs-chart-time
          data={verlaufsgrafik}
          chart-title={''}
          scenarios={["ac1", "pp1"]}
          pixelPerUnit={0.01}
          pixelPerPercentage={50}
          styles={style}
          date-interval={DateDistance.AUTO}
          interval-span-Limit = {9}
        ></ibcs-chart-time>

      </div>
      Fehler 1. letzter DAY fehlt bei 28 fehler
      Fehler 2 28 ist die range nicht die anzahl der saeulen
      2020-12-31T00:59:01Z
      2023-03-31T00:59:01Z
    </div>)
  }
}

/*

   axis-labels-mode			={'smart'}
        chart-title					={''}
        data			        ={verlaufsgrafik}
        date-interval				={'quarter'}
        interval-span-limit			={'quarter'}
        level				        ={'category'}
        limit						={0}
        order				        ={''}
        order-direction			    ={'desc'}
        scenarios			        ={'ac3,pp3'}
        styles				        ={''}
        sync-space-left				={-1}
        unit-scaling			    ={0.005}
        percentage-scaling    ={100}
  <ibcs-chart-time
          data={verlaufsgrafik}
          scenarios={["ac1", "fc1"]}
          variances={["dac1_fc1_pos"]}
          pixelPerUnit={0.001}
          styles={style}
          date-interval={DateDistance.AUTO}
          interval-span-Limit = {10}
        ></ibcs-chart-time>
 */
