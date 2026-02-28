import { G, Pattern, Svg } from "@svgdotjs/svg.js";
import { StructureChartStyle } from "../model";
import { SVGPolgonPattern } from "../../../../utils/model";
// import { SVGPolgonPattern } from "../../../../utils/model";

/**
 * Generates SVG diagonal-line hatching patterns for forecast (FC) scenario bars
 * in the structure chart.
 *
 * Creates a 10x10 SVG <pattern> tile with diagonal lines using the FC bar style colors.
 * Used as fill for FC horizontal bars to distinguish forecast from actual data per IBCS.
 */
export class CustomPattern {
  bgOffset: number;
  styles: StructureChartStyle;
  pattern: Pattern;
  container: Svg;

  constructor(styles: StructureChartStyle) {
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

  private createFCPattern(group: G, styles: StructureChartStyle): Pattern {
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
      .id("pattern-structure-fc");
  }

  public getFCPolygonPattern(): SVGPolgonPattern {
    return { background: "", foreground: "", bgOffset: 0, pattern: this.pattern };
  }

  public toString() {
    return this.container.svg();
  }
}
