import { HookLocation } from "../elements/Label";

/**
 * Represents the bounding box of a label for collision detection.
 */
export interface LabelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  pointIndex: number;
  preferredHook: HookLocation;
}

/**
 * Manages label collision detection across multiple line series in line charts.
 * Tracks the bounding boxes of all registered labels and detects overlaps.
 */
export class LabelCollisionManager {
  private labels: LabelBounds[] = [];

  /**
   * Clears all registered labels. Call this before drawing a new chart.
   */
  public clear(): void {
    this.labels = [];
  }

  /**
   * Registers a label's bounding box for collision detection.
   *
   * @param bounds The bounding box of the label
   */
  public register(bounds: LabelBounds): void {
    this.labels.push(bounds);
  }

  /**
   * Checks if a label at the given bounds would collide with any existing labels.
   *
   * @param bounds The proposed bounding box of the label
   * @returns true if the label would collide with an existing label, false otherwise
   */
  public hasCollision(bounds: LabelBounds): boolean {
    return this.labels.some(existing => this.intersects(bounds, existing));
  }

  /**
   * Calculates the optimal hook location for a label to avoid collisions.
   * If the preferred position causes a collision, tries the opposite position.
   *
   * @param x Center X position of the label
   * @param y Marker Y position (top of marker for top label, bottom for bottom)
   * @param width Estimated width of the label
   * @param height Estimated height of the label
   * @param pointIndex The data point index
   * @param preferredHook The preferred hook location based on line direction
   * @param markerSize The size of the marker (used for calculating label offset)
   * @returns The optimal hook location (may be flipped if collision detected)
   */
  public getOptimalHookLocation(
    x: number,
    y: number,
    width: number,
    height: number,
    pointIndex: number,
    preferredHook: HookLocation,
    markerSize: number
  ): HookLocation {
    // Calculate bounds for preferred position
    const preferredBounds = this.calculateBounds(x, y, width, height, pointIndex, preferredHook, markerSize);

    if (!this.hasCollision(preferredBounds)) {
      return preferredHook;
    }

    // Try the opposite position
    const alternateHook = preferredHook === HookLocation.Bottom ? HookLocation.Top : HookLocation.Bottom;
    const alternateBounds = this.calculateBounds(x, y, width, height, pointIndex, alternateHook, markerSize);

    if (!this.hasCollision(alternateBounds)) {
      return alternateHook;
    }

    // Both positions have collisions, return preferred
    return preferredHook;
  }

  /**
   * Calculates the bounding box for a label at a given position with a specific hook location.
   *
   * @param x Center X position
   * @param y Marker Y position
   * @param width Label width
   * @param height Label height
   * @param pointIndex The data point index
   * @param hook The hook location
   * @param markerSize The marker size
   * @returns The calculated label bounds
   */
  public calculateBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    pointIndex: number,
    hook: HookLocation,
    markerSize: number
  ): LabelBounds {
    // Labels are centered horizontally
    const labelX = x - width / 2;

    // Calculate Y based on hook location
    let labelY: number;
    if (hook === HookLocation.Bottom) {
      // Hook at bottom means label is above the point
      labelY = y - markerSize / 2 - height - 4;
    } else {
      // Hook at top means label is below the point
      labelY = y + markerSize / 2 + 4;
    }

    return {
      x: labelX,
      y: labelY,
      width,
      height,
      pointIndex,
      preferredHook: hook
    };
  }

  /**
   * Checks if two bounding boxes intersect (overlap).
   */
  private intersects(a: LabelBounds, b: LabelBounds): boolean {
    return !(
      a.x + a.width < b.x ||   // a is completely to the left of b
      b.x + b.width < a.x ||   // b is completely to the left of a
      a.y + a.height < b.y ||  // a is completely above b
      b.y + b.height < a.y     // b is completely above a
    );
  }

  /**
   * Gets the number of registered labels.
   */
  public getLabelCount(): number {
    return this.labels.length;
  }
}
