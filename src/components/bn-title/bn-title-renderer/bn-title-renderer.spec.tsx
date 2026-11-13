import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { BnTitleRenderer } from "./bn-title-renderer";
import { DateTime } from "luxon";
import { Order, OrderDirection } from "../../../utils/model/Order";
import { DateDistance } from "../../../utils/DateStringFactory";
import { DateLink } from "../../../utils/DateStringFactory";

it("should render my component with only a Business Unit", async () => {
  const businessUnit = "Business Unit";
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit={businessUnit}></bn-title-renderer>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div>Business Unit</div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render inline markup in the Business Unit", async () => {
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit="Acme <strong>Corp</strong><br />Group"></bn-title-renderer>,
  });

  const unit = page.root.shadowRoot.querySelector("div > div");
  expect(unit.innerHTML).toBe("Acme <strong>Corp</strong><br>Group");
});

it("should sanitize dangerous markup in the Business Unit", async () => {
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit={`<script>alert(1)</script>Acme & Co`}></bn-title-renderer>,
  });

  const unit = page.root.shadowRoot.querySelector("div > div");
  expect(unit.innerHTML).toBe("Acme &amp; Co");
});

it("should render my component empty null values ", async () => {
  const businessUnit = undefined;
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit={businessUnit}></bn-title-renderer>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render the title id as the first element, as text", async () => {
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit="Sales" titleId="13<b>A</b>"></bn-title-renderer>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div class="with-id">
      <div class="title-id">13&lt;b&gt;A&lt;/b&gt;</div>
      <div>Sales</div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render no title id for an empty value", async () => {
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer businessUnit="Sales" titleId=""></bn-title-renderer>,
  });

  expect(page.root.shadowRoot).toEqualHtml(`
    <div>
      <div>Sales</div>
      <div></div>
      <div></div>
    </div>
  `);
});

it("should render my component empty ", async () => {
  const page = await newSpecPage({
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer></bn-title-renderer>,
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
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer measures={measures}></bn-title-renderer>,
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
    components: [BnTitleRenderer],
    template: () => <bn-title-renderer measures={measures}></bn-title-renderer>,
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
    components: [BnTitleRenderer],
    // @ts-ignore
    template: () => <bn-title-renderer measures={measures} />,
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
    components: [BnTitleRenderer],
    template: () => (
      <bn-title-renderer
        scenarios={["ac1", "pp1", "dac1_pp1_pos", "drac1_pp1_pos"]}
        order={
          {
            hierarchy: ["ac1"],
            direction: OrderDirection.ASC,
          } as Order
        }
      ></bn-title-renderer>
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
    components: [BnTitleRenderer],
    template: () => (
      <bn-title-renderer
        timeperiod={{
          start: DateTime.fromISO("2019-12-31T02:00:00+02:00"),
          end: DateTime.fromISO("2020-12-31T02:00:00+02:00"),
          format: DateDistance.DAY,
          link: DateLink.INTERVAL,
        }}
      ></bn-title-renderer>
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
