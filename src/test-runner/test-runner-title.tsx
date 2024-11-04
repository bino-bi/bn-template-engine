import {h, Component} from "@stencil/core";
// import {DateDistance, DateLink, IOrder, OrderDirection} from "@bino-bi/ibcs-component-interface";
import {DateTime} from "luxon";
import { Order, OrderDirection } from "../utils/model/Order";
import { DateDistance, DateLink } from "../utils/DateStringFactory";

@Component({
  tag: "test-runner-title",
})

export class TestRunnerTitle {
  render() {
    return (<div>
      <ibcs-title
        businessUnit = "Business Unit"
      ></ibcs-title>
        =====
        <ibcs-title measures = {[{name: "Bruttoumsatz"}]}></ibcs-title>
        ==========
        <ibcs-title
          scenarios       = {["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos","ac2"]}
          order = {{
            hierarchy: ["ac1"],
            direction: OrderDirection.ASC
          } as Order}
         >
        </ibcs-title>
 =====
      <ibcs-title
        businessUnit = "Test Cars"
        scenarios = {["ac1", "pp2", "dpp1_pp2_pos"]}
        timeperiod      ={undefined}
        order = {{
          hierarchy: ["dpp1_pp2_pos"],
          direction: OrderDirection.ASC
        } as Order}
      ></ibcs-title>
===
      <ibcs-title
        businessUnit = "Test Cars"
        scenarios = {["ac1", "pp1", "dpy1_ac1_pos"]}
        order = {{
          hierarchy: ["ac1,pp1"],
          direction: OrderDirection.ASC
        } as Order}
      ></ibcs-title>
===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz3", unit: "mEUR"}]}
        scenarios = {["ac1", "pp1", "dpp1_ac1_pos"]}
        order = {{
          hierarchy: ["ac1,pp1"],
          direction: OrderDirection.DESC
        } as Order}
      ></ibcs-title>
      ===
      <ibcs-title
        businessUnit = "Test Cars"
        scenarios = {["ac1", "pp1", "dpy1_ac1_pos"]}
        order = {{
          hierarchy: ["ac1"],
          direction: OrderDirection.ASC
        } as Order}
      ></ibcs-title>
      ===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz3", unit: "mEUR"}]}
        scenarios = {["ac1", "pp1", "dpp1_ac1_pos"]}
        order = {{
          hierarchy: ["ac1"],
          direction: OrderDirection.DESC
        } as Order}
      ></ibcs-title>
      ===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz", unit: "mUSD"}, {name: "Bruttoumsatz2", unit: undefined}, {name: "Bruttoumsatz3", unit: "mEUR"}]}
        scenarios = {["ac1", "pp1", "dpp1_ac1_pos"]}
      ></ibcs-title>
===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz", unit: "mEUR"}, {name: "Bruttoumsatz2", unit: "mDollar"}]}
        scenarios = {["ac1", "pp1", "dpp1_ac1_pos"]}
      ></ibcs-title>
===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz", unit: undefined}, {name: "Bruttoumsatz2", unit: undefined}, {name: "Bruttoumsatz4", unit: "mUSD"}]}
        scenarios = {["ac1", "pp1", "dpp1_ac1_pos"]}
      ></ibcs-title>
      ===
<ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz", unit: "mEUR"}, {name: "Bruttoumsatz", unit: "kEUR"}]}
        scenarios = {["ac", "py", "dpp1_ac1_pos"]}
      ></ibcs-title>
      ===
      <ibcs-title
        business-unit   = 'Geschäftsfeld AM Illiquide'
        scenarios       = {["ac", "pp", "dpp_ac_pos"]}
        measures        = {[{name: "Performance von",unit: undefined},{name: "Kapitalzusagen",unit: undefined}, {name: "Allokiertes Kapital", unit: undefined}, {name: "Marktwert", unit: "%"}]}
        timeperiod      ={{
          start:       DateTime.fromISO('2019-12-31'),
          end:         DateTime.fromISO('2020-12-31'),
          format:      DateDistance.DAY,
          link:        DateLink.INTERVAL

        }}
        order = {{
          hierarchy: ["ac1"],
          direction: OrderDirection.DESC
        } as Order}>
      </ibcs-title>
      ===
      <ibcs-title
        business-unit   = 'Geschäftsfeld AM Illiquide'
        scenarios       = {["ac1", "pp1", "dpp1_ac1_pos", "drpp1_ac1_pos"]}
        measures        = {[{name: "Performance von",unit: undefined},{name: "Kapitalzusagen",unit: undefined}, {name: "Allokiertes Kapital", unit: undefined}, {name: "Marktwert", unit: "%"}]}
        timeperiod      ={{
          start:       DateTime.fromISO('2019-12-31'),
          end:         DateTime.fromISO('2020-12-31'),
          format:      DateDistance.DAY,
          link:        DateLink.INTERVAL
        }}>
      </ibcs-title>
      ===
      <ibcs-title
        businessUnit = "Test Cars"
        measures = {[{name: "Bruttoumsatz", unit: "mEUR"}, {name: "Bruttoumsatz", unit: "kEUR"}]}
        scenarios = {[]}
        timeperiod      ={{
          start:       DateTime.fromISO('2019-12-31'),
          end:         DateTime.fromISO('2020-12-31'),
          format:      DateDistance.DAY,
          link:        DateLink.INTERVAL
        }}>
      </ibcs-title>

      ===
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2019-12-31'),
          end:         DateTime.fromISO('2020-12-31'),
          format:      DateDistance.DAY,
          link:        DateLink.INTERVAL
        }}>
      </ibcs-title>
      ===

      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-03-01'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.INTERVAL
        }}>
      </ibcs-title>
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-03-01'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.AVG
        }}>
      </ibcs-title>
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-03-01'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.YTD
        }}>
      </ibcs-title>
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-03-31'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.YTD
        }}>
      </ibcs-title>
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-01-31'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.AVG
        }}>
      </ibcs-title>
      <ibcs-title
        timeperiod      ={{
          start:       DateTime.fromISO('2024-01-31'),
          end:         DateTime.fromISO('2024-03-31'),
          format:      DateDistance.MONTH,
          link:        DateLink.INTERVAL
        }}>
      </ibcs-title>
      </div>

    );

  }
};
