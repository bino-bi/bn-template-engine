import { HookLocation } from "../elements/Label";

/**
 * Scenario priority for label collision resolution.
 * Lower number = higher priority. AC always wins.
 */
export const SCENARIO_PRIORITY: Record<string, number> = {
  ac: 1,
  pp: 2,
  fc: 3,
  pl: 4,
};

/**
 * Direction a label can be placed relative to its marker.
 */
export enum LabelDirection {
  Above,
  Below,
  Left,
  Right,
}

/**
 * Result of getOptimalPlacement: the computed label position and hooks, or null (hide).
 */
export interface LabelPlacement {
  labelX: number;
  labelY: number;
  verticalHook: HookLocation;
  horizontalHook: HookLocation;
  bounds: LabelBounds;
}

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
  scenarioType?: string;
}

/**
 * Manages label collision detection across multiple line series in line charts.
 * Tracks the bounding boxes of all registered labels and detects overlaps.
 * Supports scenario-based priority: when labels collide and cannot be repositioned,
 * lower-priority scenario labels are hidden (AC > PP > FC > PL).
 *
 * Uses 4-direction placement: Above, Below, Left, Right.
 */
export class LabelCollisionManager {
  private labels: LabelBounds[] = [];
  private scenarioLabels: Array<{ x: number; y: number; scenarioType: string }> = [];

  /**
   * Clears all registered labels. Call this before drawing a new chart.
   */
  public clear(): void {
    this.labels = [];
    this.scenarioLabels = [];
  }

  /**
   * Registers a label's bounding box for collision detection.
   */
  public register(bounds: LabelBounds): void {
    this.labels.push(bounds);
  }

  /**
   * Checks if a label at the given bounds would collide with any existing labels.
   */
  public hasCollision(bounds: LabelBounds): boolean {
    return this.labels.some((existing) => this.intersects(bounds, existing));
  }

  /**
   * Tries each direction in priorityOrder to find a non-colliding placement.
   * Returns the first non-colliding LabelPlacement, or null if all 4 collide
   * with higher-priority scenario labels (meaning this label should be hidden).
   *
   * @param centerX  Center X position of the marker
   * @param markerY  Y position of the marker center
   * @param width    Estimated label width
   * @param height   Estimated label height
   * @param pointIndex  The data point index
   * @param markerSize  The marker size
   * @param scenarioType  e.g. "ac", "pp", "fc", "pl"
   * @param priorityOrder  Directions to try, in priority order
   */
  public getOptimalPlacement(
    centerX: number,
    markerY: number,
    width: number,
    height: number,
    pointIndex: number,
    markerSize: number,
    scenarioType: string,
    priorityOrder: LabelDirection[],
  ): LabelPlacement | null {
    const priority = SCENARIO_PRIORITY[scenarioType] || 99;
    const gap = 8;
    const halfMarker = markerSize / 2;

    // Try each direction in the caller's preferred order
    for (const direction of priorityOrder) {
      const placement = this.calculatePlacementForDirection(
        centerX,
        markerY,
        width,
        height,
        pointIndex,
        halfMarker,
        gap,
        direction,
      );
      if (!this.hasCollision(placement.bounds)) {
        return placement;
      }
    }

    // All 4 positions collide. Check if any collide ONLY with lower-priority
    // labels (meaning we could still place here - the other label would lose).
    // But to keep it simple: hide only if all positions collide with higher-priority labels.
    for (const direction of priorityOrder) {
      const placement = this.calculatePlacementForDirection(
        centerX,
        markerY,
        width,
        height,
        pointIndex,
        halfMarker,
        gap,
        direction,
      );
      if (!this.collidesWithHigherPriority(placement.bounds, priority)) {
        // This position only collides with equal or lower priority - claim it
        return placement;
      }
    }

    // All positions collide with higher-priority labels - hide
    return null;
  }

  /**
   * Computes the LabelPlacement for a given direction.
   */
  private calculatePlacementForDirection(
    centerX: number,
    markerY: number,
    width: number,
    height: number,
    pointIndex: number,
    halfMarker: number,
    gap: number,
    direction: LabelDirection,
  ): LabelPlacement {
    let labelX: number;
    let labelY: number;
    let verticalHook: HookLocation;
    let horizontalHook: HookLocation;
    let boundsX: number;
    let boundsY: number;

    switch (direction) {
      case LabelDirection.Above:
        labelX = centerX;
        labelY = markerY - halfMarker - gap;
        verticalHook = HookLocation.Bottom;
        horizontalHook = HookLocation.Center;
        boundsX = centerX - width / 2;
        boundsY = markerY - halfMarker - gap - height;
        break;

      case LabelDirection.Below:
        labelX = centerX;
        labelY = markerY + halfMarker + gap;
        verticalHook = HookLocation.Top;
        horizontalHook = HookLocation.Center;
        boundsX = centerX - width / 2;
        // Top hook shifts text up by height/4, so bounds start earlier
        boundsY = markerY + halfMarker + gap - height / 4;
        break;

      case LabelDirection.Left:
        labelX = centerX - halfMarker - gap;
        labelY = markerY;
        verticalHook = HookLocation.Center;
        horizontalHook = HookLocation.Right;
        boundsX = centerX - halfMarker - gap - width;
        // Center hook shifts text up by height*0.6
        boundsY = markerY - height * 0.6;
        break;

      case LabelDirection.Right:
        labelX = centerX + halfMarker + gap;
        labelY = markerY;
        verticalHook = HookLocation.Center;
        horizontalHook = HookLocation.Left;
        boundsX = centerX + halfMarker + gap;
        // Center hook shifts text up by height*0.6
        boundsY = markerY - height * 0.6;
        break;
    }

    const bounds: LabelBounds = {
      x: boundsX,
      y: boundsY,
      width,
      height,
      pointIndex,
      preferredHook: verticalHook,
    };

    return { labelX, labelY, verticalHook, horizontalHook, bounds };
  }

  /**
   * Checks if bounds collide with any registered label that has higher priority.
   */
  private collidesWithHigherPriority(bounds: LabelBounds, priority: number): boolean {
    return this.labels.some((existing) => {
      if (!existing.scenarioType) return false;
      const existingPriority = SCENARIO_PRIORITY[existing.scenarioType] || 99;
      return existingPriority < priority && this.intersects(bounds, existing);
    });
  }

  /**
   * Checks whether a scenario label at the end of a line should be hidden
   * because it's too close to a higher-priority scenario label.
   */
  public shouldHideScenarioLabel(x: number, y: number, scenarioType: string, proximityThreshold: number = 20): boolean {
    const priority = SCENARIO_PRIORITY[scenarioType] || 99;
    if (priority <= 1) return false; // AC is never hidden

    return this.scenarioLabels.some((existing) => {
      const existingPriority = SCENARIO_PRIORITY[existing.scenarioType] || 99;
      if (existingPriority >= priority) return false;
      const dy = Math.abs(y - existing.y);
      const dx = Math.abs(x - existing.x);
      return dy < proximityThreshold && dx < proximityThreshold;
    });
  }

  /**
   * Registers a scenario label position for proximity checking.
   */
  public registerScenarioLabel(x: number, y: number, scenarioType: string): void {
    this.scenarioLabels.push({ x, y, scenarioType });
  }

  /**
   * Checks if two bounding boxes intersect (overlap).
   */
  private intersects(a: LabelBounds, b: LabelBounds): boolean {
    return !(
      a.x + a.width < b.x || // a is completely to the left of b
      b.x + b.width < a.x || // b is completely to the left of a
      a.y + a.height < b.y || // a is completely above b
      b.y + b.height < a.y // b is completely above a
    );
  }

  /**
   * Gets the number of registered labels.
   */
  public getLabelCount(): number {
    return this.labels.length;
  }
}
