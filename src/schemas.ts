/**
 * The JSON documents the components read from an attribute or from the
 * content of an element. `scripts/generate-schemas.js` turns each exported
 * type into a JSON Schema that ships in the package under `schemas/`.
 */
import { RuleSetConfig } from "./stores/ruleSets";
import { Style } from "./stores/componentStyles";
import { StackBy, StackMode, StackOrder } from "./utils/constants";
import { AxisConfig } from "./utils/xy/model/AxisConfig";

/** Content of `<bn-component-style>`. Every key is optional, the content is merged over the default style. */
export type Theme = Style;

/** Content of `<bn-ruleset>`. */
export type RuleSet = RuleSetConfig;

/** Content of `<bn-internationalization>`: texts by key. Nested objects are joined with dots (`global.ac1`). */
export interface I18n {
  [key: string]: string | I18n;
}

/** One entry of the `thereof` attribute of `bn-table`. */
export interface ThereofEntry {
  /** Row group of the row the drilldown belongs to. */
  rowGroup: string;
  /** Category of the row the drilldown belongs to. */
  category: string;
  /** Sub category that is shown below the row. */
  subCategory: string;
}

/** The `thereof` attribute of `bn-table`. */
export type Thereof = ThereofEntry[];

/** One entry of the `partof` attribute of `bn-table`. */
export interface PartofEntry {
  /** Row group the share is taken of. */
  rowGroup: string;
  /** Category whose share of the row group is shown. */
  category: string;
  /** Accepted, not used. */
  subCategory?: string;
}

/** The `partof` attribute of `bn-table`. */
export type Partof = PartofEntry[];

/** The `stack` attribute of `bn-chart-time` and `bn-chart-structure`. */
export interface Stack {
  /** What a stack is made of: the scenarios, or the level below `level`. */
  by: StackBy;
  /** Default: `absolute`. */
  mode?: StackMode;
  /** Order of the segments in a stack. Default: `dataset`. */
  order?: StackOrder;
  /** `bn-chart-time`: `scenario` gives a segment the look of its scenario. Default: `none`. */
  notation?: "none" | "scenario";
  /** `bn-chart-time`: where the series names stand. Default: `left`. */
  legend?: "left" | "right" | "both" | "none";
  /** `bn-chart-time`, mode `relative`: plain shares and one `100%` mark. Default: `false`. */
  percentMark?: boolean;
}

/** The `x` and `y` attribute of `bn-chart-scatter` and `bn-chart-bubble`, in its JSON form. */
export type Axis = AxisConfig;
