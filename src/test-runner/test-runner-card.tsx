import {h, Component} from "@stencil/core";

import { I18nMode, AggregationLevel, TableType } from "../utils/constants";
import { Order, OrderColumn, OrderDirection } from "../utils/model/Order";


@Component({
  tag: "test-runner-card",
})

export class TestRunnerTitle {
  render() {
    return (<div>
      <ibcs-card
        title = "Eintracht Frankfurt"
        image = "debug/concordia.png"
        showBorder = {false}
      >
        <ibcs-title
          businessUnit = "Test Cars"
          measures = {[{name: "Bruttoumsatz", unit: "mEUR"}, {name: "Bruttoumsatz2", unit: "mDollar"}]}
          scenarios = {["ac", "py", "dpy_ac_pos"]}
        ></ibcs-title>


      </ibcs-card>
      <ibcs-card
        title = "Nintendo"
        image = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Nintendo_red_logo.svg/1280px-Nintendo_red_logo.svg.png"
        showBorder = {true}
      >
        <ibcs-table
          table-title="😎Sven ist der Papa von Phineas und Max"
          scenarios={["ac", "py" ]}
          scenarios-unit-type = "decimal"
          grouped={true}
          type={TableType.OPT}
          i18n-mode={I18nMode.META}
          showGroupTitle = {true}
          data={[]}
          there-of = {[
            {
              "rowGroup":     "Umsatz",
              "category":     "Applications",
              "subCategory":  "",
              "partOf":       "category"
            }]}></ibcs-table>


      </ibcs-card>
      <ibcs-card
        title = "Eintracht Frankfurt"
        image = "debug/concordia.png"
        showBorder = {true}
      >
        <ibcs-chart-structure
          data= {[]}
          scenarios={["ac", "fc", "py", "pl" ]}
          variances = {["dac_fc_pos"]}
          hideCategories = {false}
          pixelPerUnit = {15}
          chartTitle = {undefined}
          styles = {undefined}
          i18n = {undefined}
          level = {AggregationLevel.CATEGORY}
          order = { { hierarchy: [OrderColumn.CATEGORY],
            direction: OrderDirection.DESC
          } as Order
          }
        ></ibcs-chart-structure>





      </ibcs-card>
    </div>);
  }
};


/*
    <ibcs-chart-structure
          data= {null}
          scenarios={["ac", "fc", "py", "pl" ]}
          variances = {["dac_fc_pos"]}
          hideCategories = {false}
          pixelPerUnit = {15}
          chartTitle = {null}
          styles = {null}
          i18n = {null}
          level = {AggregationLevel.CATEGORY}
          order = { { hierarchy: [OrderColumn.CATEGORY],
            direction: OrderDirection.DESC
          } as Order
          }
        ></ibcs-chart-structure>
 */
