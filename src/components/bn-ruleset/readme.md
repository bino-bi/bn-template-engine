# bn-ruleset

Changes how the scenarios are ordered, drawn and named. The content is JSON. It is merged over the built-in rules, so write only what you change.

```html
<!-- without a name: for every component in the context -->
<bn-ruleset>
  { "scenarios": { "pl": { "name": "Budget", "colorIndex": 30 } } }
</bn-ruleset>

<!-- with a name: for the components that select it -->
<bn-ruleset name="plan-first">
  { "scenarios": { "pl": { "sortIndex": 500 } } }
</bn-ruleset>
<bn-table ruleset="plan-first" datasets="sales" scenarios="ac1,pl1"></bn-table>
```

`scenarios` has one entry per scenario prefix (`ac`, `pp`, `fc`, `pl`). Each entry can set:

| Key | Meaning |
|-----|---------|
| `sortIndex` | Position of the scenario. A smaller number comes first. Built-in: `pp` 100, `pl` 200, `fc` 300, `ac` 400. |
| `colorIndex` | The look of the scenario: `10` solid, `20` light, `30` hatched, `50` outlined. Any other value counts as `10`. Built-in: `ac` 10, `pp` 20, `fc` 30, `pl` 50. |
| `name` | The name of the scenario. Slot 1 shows it as is, the slots 2 to 4 with their number ("Budget", "Budget2"). It replaces the translated label, in every language. Leave it out to keep the label of [`bn-internationalization`](../bn-internationalization/readme.md). |

The number of `colorIndex` picks a style slot, the theme decides how the slot looks: `10` uses the `ac` entry of `barStyles`, `20` the `pp` entry, `30` the `fc` entry, `50` the `pl` entry (see [Theming](../../../doc/theming.md)). The hatch pattern always takes its colours from the `fc` entry.

Variances have their own entries. The absolute ones (`dpp`, `dpl`, `dfc`, `dac`) sort at 1100, 1200, 1300 and 1400, the relative ones (`drpp`, `drpl`, `drfc`, `drac`) at 1105, 1205, 1305 and 1405. A variance sorts by its reference, so `dac1_pp1` and `drac1_pp1` come first, then `dac1_pl1` and `drac1_pl1`. If you move `dpl`, move `drpl` too.

`fallback` (`name`, `group`, `colorIndex`, `sortIndex`) is used for a series that is not a scenario, for example the default series of a scatter chart.

<!-- Auto Generated Below -->


## Properties

| Property | Attribute | Description | Type     | Default      |
| -------- | --------- | ----------- | -------- | ------------ |
| `name`   | `name`    |             | `string` | `"_default"` |


----------------------------------------------

developed by Bino Bi
