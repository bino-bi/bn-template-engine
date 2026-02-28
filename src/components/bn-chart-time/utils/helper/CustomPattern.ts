import { G, Pattern, Svg } from "@svgdotjs/svg.js";
// import {SVGPolgonPattern} from "../../../../utils/model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { SVGPolgonPattern } from "../../../../utils/model";

/**
 * Generates SVG diagonal-line hatching patterns for forecast (FC) scenario bars.
 *
 * Creates a 10x10 SVG <pattern> tile with diagonal lines using the FC bar style colors.
 * The resulting pattern is used as the fill for FC columns/bars to visually distinguish
 * forecast data from actual data per IBCS conventions (hatched = forecast, solid = actual).
 *
 * bgOffset is computed from font size to center the foreground shape within the background.
 */
export class CustomPattern {
  bgOffset: number;
  styles: TimeChartStyle;
  pattern: Pattern;
  container: Svg;

  constructor(styles: TimeChartStyle) {
    this.container = new Svg();
    this.pattern = this.createFCPattern(this.container.group(), styles);

    this.styles = styles;
    const backgroundFactor = 1;
    const foregroundFactor = 0.7;

    let fontSize = 10;

    if (styles != null && styles.fontStyles != null && styles.fontStyles.size) {
      fontSize = styles.fontStyles.size;
    }

    const maxBg = fontSize * backgroundFactor;
    const maxFg = fontSize * foregroundFactor;

    this.bgOffset = (maxBg - maxFg) / 2;
  }

  private createFCPattern(group: G, styles: TimeChartStyle): Pattern {
    const _styles = styles;

    return group
      .pattern(10, 10, function (add) {
        add.rect(10, 10).fill(_styles.barStyles.fc.fill);
        add
          .line(0, 5, 5, 0)
          .stroke({ width: _styles.barStyles.fc.width, color: _styles.barStyles.fc.stroke, linecap: "square" });
        add
          .line(5, 10, 10, 5)
          .stroke({ width: _styles.barStyles.fc.width, color: _styles.barStyles.fc.stroke, linecap: "square" });
      })
      .id("pattern-time-fc");
  }

  public getFCPolygonPattern(): SVGPolgonPattern {
    return { background: "", foreground: "", bgOffset: 0, pattern: this.pattern };
  }

  public toString() {
    return this.container.svg();
  }
}
