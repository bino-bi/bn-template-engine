# Scaling

bn-template-engine has four scaling mechanisms that work together but answer
different questions:

| Mechanism | Question it answers | Components |
| --- | --- | --- |
| `scale` | How large is the whole component (font + geometry)? | `bn-table`, `bn-chart-time`, `bn-chart-structure`, xy charts |
| `unit-scaling` / `percentage-scaling` | How many data units / percentage points fit into 1 em of bar or pin? | `bn-table`, `bn-chart-time`, `bn-chart-structure` |
| `<bn-scaling-group>` | Which components share one such value? | all of the above + `bn-chart-bubble` (`size.group`) |
| `measure-scale` | Which SI prefix are values *displayed* in (`14 000 000` → `14` with footer `MEUR`)? | `bn-table`, `bn-chart-time`, `bn-chart-structure` |

`measure-scale` only changes number formatting; it never changes geometry.
The rest of this guide covers the other three.

## The units-per-em model

`unit-scaling` declares **how many data units are represented by 1 em of bar
length** — map-scale semantics, like `1:25000` on a map. A larger value means
more data per em, i.e. **smaller bars**.

```html
<!-- 1 em of bar = 1,000,000 EUR -->
<bn-chart-structure unit-scaling="1M" ...></bn-chart-structure>
```

With `unit-scaling="1M"`, a value of 150,000,000 EUR produces a bar 150 em
long; a value of 4,200,000 EUR produces a 4.2 em bar. "1 em" is the
component's effective font size, so bars are always proportioned relative to
the text they annotate.

`percentage-scaling` is the same idea for relative variance pins: **how many
percentage points per 1 em of pin length**.

```html
<!-- a +10 % variance pin is 1 em long -->
<bn-table percentage-scaling="10" ...></bn-table>
```

### Value grammar

Both attributes (and `bn-scaling-group`'s `value`) share one grammar:

| Input | Meaning |
| --- | --- |
| `auto` | Auto-fit to the available space (silent) |
| `250000`, `2.5`, `.5` | Positive number: units (or percentage points) per em |
| `1k` / `1K`, `2.5M`, `3G`, `1T` | Number with SI suffix (k/K = 10³, M = 10⁶, G = 10⁹, T = 10¹²) |
| `revenue` | Name of a `<bn-scaling-group>` in scope |
| anything else / not set | Auto-fit + an `AUTO_unitScaling` / `AUTO_percentageScaling` warning |

Lowercase `m`, `g`, `t` are rejected (SI milli would be an ambiguity trap), as
are signs and exponent notation. Whitespace between number and suffix is
allowed (`1 k`).

Defaults: charts have no numeric default (unset means auto-fit with a
warning); `bn-table` defaults to `unit-scaling="100"` and
`percentage-scaling="2"`.

## Synchronized scaling with `<bn-scaling-group>`

A scaling group publishes one named value into the surrounding
`<bn-context>`; every component that references the name uses the same
units-per-em value, so their bars are directly comparable:

```html
<bn-scaling-group name="revenue" value="1M"></bn-scaling-group>

<bn-chart-structure unit-scaling="revenue" ...></bn-chart-structure>
<bn-chart-structure unit-scaling="revenue" filter="region = 'EMEA'" ...></bn-chart-structure>
<bn-table unit-scaling="revenue" ...></bn-table>
```

A group value means whatever the referencing attribute means:

- from `unit-scaling`: **data units per em** of bar length
- from `percentage-scaling`: **percentage points per em** of pin length
- from a bubble chart's `size.group`: **data units per em² of bubble area**

Group names must not be `auto` and must not parse as a number/SI value
(`1M` is not a valid name); values must be positive. Duplicate names warn and
the last writer wins. Removing a `<bn-scaling-group>` element removes its
entry from the context.

### Bubble charts: units per em²

Bubble size encodes value as *area* (IBCS), so the group value for
`size.group` is per em²:

```html
<bn-scaling-group name="netsales-area" value="0.25"></bn-scaling-group>
<!-- each bubble shows 0.25 units per em² of area -->
<bn-chart-bubble size='{"measure":"ac3","group":"netsales-area"}' ...></bn-chart-bubble>
```

Two bubble charts sharing a group render identical values with identical
areas. An unknown `size.group` name is a blocking error
(`ERR_xy_scale_group`) — there is no auto fallback for bubble area.

## Interaction with `scale`

`scale` controls the component's effective font size
(`baseFontSizePx × factor`, auto-fitted when unset or `auto`). Because bars
are declared in em, **bar geometry follows the font**: if `scale` shrinks a
chart to 80 %, its bars shrink to 80 % too, keeping chart proportions intact.

Consequence for groups: two group members whose auto-`scale` factors differ
agree in *em-space* (per their own font), not in absolute pixels. If you need
pixel-identical bars, give the members the same fixed `scale`.

## Freezing an auto-fitted value

Auto-fit is convenient but data-dependent: the scale changes when the data
changes, and two auto-fitted charts don't align. To lock in a good scale:

1. Leave `unit-scaling` unset (or set an invalid value) and check the
   component's `has-error` attribute: the `AUTO_unitScaling` warning reports
   the resolved value, e.g. `auto-fitted to 1 em ≈ 250k units`.
2. Copy that value into a group and reference it:

```html
<bn-scaling-group name="revenue" value="250k"></bn-scaling-group>
<bn-chart-structure unit-scaling="revenue" ...></bn-chart-structure>
```

Explicit `unit-scaling="auto"` auto-fits silently, without the reporting
warning.
