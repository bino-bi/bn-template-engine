/**
 * Series color palette and IBCS mark treatments for the XY charts
 * (bn-chart-scatter, bn-chart-bubble).
 *
 * XY charts compose two orthogonal encodings: the **series hue** (which
 * product line / group a point belongs to) and the **scenario treatment**
 * (solid / tinted / hatched / outlined, selected through the rule-set
 * `colorIndex`). Tints and shades are computed colors, never opacity -
 * opacity creates blend artifacts where marks overlap.
 */

/**
 * Default series palette, assigned by series `*Index` order. The first
 * series uses the near-black IBCS base color.
 */
export const XY_SERIES_PALETTE = ["#404040", "#F2C14E", "#F07D00", "#4E8FE0", "#7FD6C2", "#D97C7C"];

/**
 * Mixes two hex colors per channel in sRGB space.
 *
 * @param hexA - Base color, `#rrggbb`
 * @param hexB - Mix-in color, `#rrggbb`
 * @param ratioOfB - Portion of `hexB` in the result, 0..1
 */
export function mixHex(hexA: string, hexB: string, ratioOfB: number): string {
  const channel = (offset: number): string => {
    const a = parseInt(hexA.slice(offset, offset + 2), 16);
    const b = parseInt(hexB.slice(offset, offset + 2), 16);
    const mixed = Math.round(a + (b - a) * ratioOfB);
    return mixed.toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Light variant of a series hue (60% white) - the PP/PY treatment. */
export function tint(hex: string): string {
  return mixHex(hex, "#ffffff", 0.6);
}

/** Dark variant of a series hue (25% black) - used for pie-share slices. */
export function shade(hex: string): string {
  return mixHex(hex, "#000000", 0.25);
}

/**
 * Resolves the color for a series by its order index. Indices beyond the
 * palette cycle through it with a tint step per cycle; `overflowed` signals
 * that the chart should raise the `xy-series-overflow` warning.
 */
export function resolveSeriesColor(index: number, seriesColors: string[]): { color: string; overflowed: boolean } {
  const colors = seriesColors.length > 0 ? seriesColors : XY_SERIES_PALETTE;
  const cycle = Math.floor(index / colors.length);
  let color = colors[index % colors.length];
  for (let i = 0; i < cycle; i++) {
    color = tint(color);
  }
  return { color, overflowed: cycle > 0 };
}

/** Visual treatment of a single mark (dot or bubble). */
export interface MarkTreatment {
  /** Fill color. When `hatch` is set the renderer replaces it with a pattern reference. */
  fill: string;
  stroke: string;
  /** Stroke width in pixels. */
  strokeWidth: number;
  /** Dash pattern for the FC dot ring (hatching is illegible at dot size). */
  dasharray?: string;
  /** Bubble FC treatment: fill with a 45° series-hue hatch pattern instead of `fill`. */
  hatch?: boolean;
  /** Opacity of the fill of a filled mark. Outlined and hatched marks keep a solid fill. */
  fillOpacity?: number;
  /** Colour of a value label on the mark. Default: the contrast colour of the fill. */
  textColor?: string;
}

/** Opacity of the fill of a series that is drawn as an outline. */
const OUTLINE_FILL_OPACITY = 0.08;

/**
 * The look of a series with the fill `outline` in the style: a line in the series colour around
 * a nearly clear fill, with its values in the series colour. What is behind the mark stays visible.
 */
export function outlineTreatment(hue: string, kind: "dot" | "bubble"): MarkTreatment {
  return {
    fill: hue,
    stroke: hue,
    strokeWidth: kind === "dot" ? 0.75 : 1,
    fillOpacity: OUTLINE_FILL_OPACITY,
    textColor: hue,
  };
}

/**
 * Gives the series the places that `seriesNames` of the style reserves for them: a named series
 * has the index of its name, the others follow after the names in their own order. So a series
 * keeps its colour in every chart, also when the data of a chart misses some series.
 */
export function pinSeries<T extends { key: string; index: number }>(series: T[], names: unknown): T[] {
  const list = Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
  if (list.length === 0) {
    return series;
  }
  let next = list.length;
  return series
    .map((entry) => {
      const place = list.indexOf(entry.key);
      return { ...entry, index: place >= 0 ? place : next++ };
    })
    .sort((a, b) => a.index - b.index);
}

/** The style gives this series the fill `outline`. */
export function isOutlinedSeries(seriesFills: string[] | undefined, seriesIndex: number): boolean {
  return seriesFills?.[seriesIndex] === "outline";
}

/**
 * Maps a rule-set `colorIndex` and a series hue to the IBCS mark treatment.
 *
 * | colorIndex | IBCS meaning        | Bubble                          | Dot                          |
 * | ---------- | ------------------- | ------------------------------- | ---------------------------- |
 * | 10 (ac)    | solid dark          | solid hue                       | solid hue                    |
 * | 20 (pp/py) | light               | tinted hue                      | tinted hue                   |
 * | 30 (fc)    | hatched             | white + hue hatch + hue stroke  | white + dashed hue ring      |
 * | 50 (pl/bu) | outlined            | white + solid hue stroke        | white + solid hue ring       |
 */
export function markTreatment(
  colorIndex: number,
  hue: string,
  kind: "dot" | "bubble",
  outline: string = "#ffffff",
  opacity: number = 1,
): MarkTreatment {
  const strokeWidth = kind === "dot" ? 0.75 : 1;

  switch (colorIndex) {
    case 20:
      return { fill: tint(hue), stroke: outline, strokeWidth, fillOpacity: opacity };
    case 30:
      if (kind === "bubble") {
        return { fill: "#ffffff", stroke: hue, strokeWidth, hatch: true };
      }
      return { fill: "#ffffff", stroke: hue, strokeWidth, dasharray: "2,1.5" };
    case 50:
      return { fill: "#ffffff", stroke: hue, strokeWidth };
    case 10:
    default:
      return { fill: hue, stroke: outline, strokeWidth, fillOpacity: opacity };
  }
}
