import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { IbcsTitle } from "./ibcs-title";
import { DateTime } from "luxon";
import { Order, OrderDirection } from "../../../utils/model/Order";
import { DateDistance } from "../../../utils/DateStringFactory";
import { DateLink } from "../../../utils/DateStringFactory";

it("should render my component with only a Business Unit", async () => {
  const businessUnit = "Business Unit";
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => <ibcs-title businessUnit={businessUnit}></ibcs-title>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div>Business Unit</div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render my component empty null values ", async () => {
  const businessUnit = undefined;
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => <ibcs-title businessUnit={businessUnit}></ibcs-title>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render my component empty ", async () => {
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => <ibcs-title></ibcs-title>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render measures", async () => {
  const measures = [{ name: "Bruttoumsatz", unit: "mEUR" }];
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => <ibcs-title measures={measures}></ibcs-title>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div>
        <span>
          <span class="measure">Bruttoumsatz</span>
          in mEUR
        </span>
      </div>
      <div></div>
    </div>
  `);
});

it("should render a list of measures", async () => {
  const measures = [
    { name: "Bruttoumsatz", unit: "mEUR" },
    { name: "Bruttoumsatz2", unit: "mEUR" },
    { name: "Bruttoumsatz3", unit: "mEUR" },
  ];
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => <ibcs-title measures={measures}></ibcs-title>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div>
        <span>
          <span class="measure">Bruttoumsatz, Bruttoumsatz2 und Bruttoumsatz3</span>
          in mEUR
        </span>
      </div>
      <div></div>
    </div>
  `);
});

it("should render a list of measures width different units", async () => {
  const measures = [
    { name: "Bruttoumsatz", unit: "mUSD" },
    { name: "Bruttoumsatz2", unit: null },
    { name: "Bruttoumsatz3", unit: "mEUR" },
  ];

  const page = await newSpecPage({
    components: [IbcsTitle],
    // @ts-ignore
    template: () => <ibcs-title measures={measures} />,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div>
        <span>
          <span class="measure">Bruttoumsatz</span>
          in mUSD
        </span>
        <span>
          ,
          <span class="measure">Bruttoumsatz2</span>
        </span>
        <span>
          ,
          <span class="measure">Bruttoumsatz3</span>
          in mEUR
        </span>
      </div>
      <div></div>
    </div>
  `);
});

it("should render scenarios", async () => {
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => (
      <ibcs-title
        scenarios={["ac1", "pp1", "dac1_pp1_pos", "drac1_pp1_pos"]}
        order={
          {
            hierarchy: ["ac1"],
            direction: OrderDirection.ASC,
          } as Order
        }
      ></ibcs-title>
    ),
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div></div>
      <div>PY, AC↑, ΔPY, ΔPY%</div>
    </div>
  `);
});

it("should render timeperiod variants", async () => {
  const page = await newSpecPage({
    components: [IbcsTitle],
    template: () => (
      <ibcs-title
        timeperiod={{
          start: DateTime.fromISO("2019-12-31T02:00:00+02:00"),
          end: DateTime.fromISO("2020-12-31T02:00:00+02:00"),
          format: DateDistance.DAY,
          link: DateLink.INTERVAL,
        }}
      ></ibcs-title>
    ),
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div></div>
      <div>31.12.2019..31.12.2020</div>
    </div>
  `);
});
