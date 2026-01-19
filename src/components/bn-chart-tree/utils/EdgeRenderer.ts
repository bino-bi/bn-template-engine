/**
 * Edge Renderer utility for bn-chart-tree component
 * Handles SVG path generation for connecting tree nodes
 */

import { LayoutDirection } from './TreeLayout';
import { EdgeStyle } from './TreeParser';

export type EdgeStyleType = 'straight' | 'orthogonal' | 'curved';

export interface Point {
  x: number;
  y: number;
}

export interface NodeRect {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface EdgePath {
  path: string;
  midpoint: Point;
}

/**
 * Calculate the bounding rectangle of a node element
 */
export function getNodeRect(element: HTMLElement, containerRect: DOMRect): NodeRect {
  const rect = element.getBoundingClientRect();
  const left = rect.left - containerRect.left;
  const top = rect.top - containerRect.top;

  return {
    left,
    top,
    width: rect.width,
    height: rect.height,
    centerX: left + rect.width / 2,
    centerY: top + rect.height / 2
  };
}

/**
 * Get the connection point on a node based on layout direction
 */
export function getConnectionPoint(
  rect: NodeRect,
  isSource: boolean,
  direction: LayoutDirection
): Point {
  switch (direction) {
    case 'ltr':
      // Left to right: source connects from right, target from left
      return isSource
        ? { x: rect.left + rect.width, y: rect.centerY }
        : { x: rect.left, y: rect.centerY };

    case 'rtl':
      // Right to left: source connects from left, target from right
      return isSource
        ? { x: rect.left, y: rect.centerY }
        : { x: rect.left + rect.width, y: rect.centerY };

    case 'ttb':
      // Top to bottom: source connects from bottom, target from top
      return isSource
        ? { x: rect.centerX, y: rect.top + rect.height }
        : { x: rect.centerX, y: rect.top };

    case 'btt':
      // Bottom to top: source connects from top, target from bottom
      return isSource
        ? { x: rect.centerX, y: rect.top }
        : { x: rect.centerX, y: rect.top + rect.height };
  }
}

/**
 * Generate an SVG path connecting two points with the specified style
 */
export function generateEdgePath(
  start: Point,
  end: Point,
  style: EdgeStyleType,
  direction: LayoutDirection
): EdgePath {
  switch (style) {
    case 'straight':
      return generateStraightPath(start, end);

    case 'curved':
      return generateCurvedPath(start, end, direction);

    case 'orthogonal':
    default:
      return generateOrthogonalPath(start, end, direction);
  }
}

/**
 * Generate a straight line path
 */
function generateStraightPath(start: Point, end: Point): EdgePath {
  const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const midpoint: Point = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };

  return { path, midpoint };
}

/**
 * Generate a curved bezier path
 */
function generateCurvedPath(start: Point, end: Point, direction: LayoutDirection): EdgePath {
  const isHorizontal = direction === 'ltr' || direction === 'rtl';
  let controlPoint1: Point;
  let controlPoint2: Point;

  if (isHorizontal) {
    const midX = (start.x + end.x) / 2;
    controlPoint1 = { x: midX, y: start.y };
    controlPoint2 = { x: midX, y: end.y };
  } else {
    const midY = (start.y + end.y) / 2;
    controlPoint1 = { x: start.x, y: midY };
    controlPoint2 = { x: end.x, y: midY };
  }

  const path = `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`;

  // Midpoint of a cubic bezier at t=0.5
  const midpoint: Point = {
    x: 0.125 * start.x + 0.375 * controlPoint1.x + 0.375 * controlPoint2.x + 0.125 * end.x,
    y: 0.125 * start.y + 0.375 * controlPoint1.y + 0.375 * controlPoint2.y + 0.125 * end.y
  };

  return { path, midpoint };
}

/**
 * Generate an orthogonal (right-angle) path
 */
function generateOrthogonalPath(start: Point, end: Point, direction: LayoutDirection): EdgePath {
  const isHorizontal = direction === 'ltr' || direction === 'rtl';
  let path: string;
  let midpoint: Point;

  if (isHorizontal) {
    // For horizontal layouts, go horizontally first, then vertically
    const midX = (start.x + end.x) / 2;
    path = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    midpoint = { x: midX, y: (start.y + end.y) / 2 };
  } else {
    // For vertical layouts, go vertically first, then horizontally
    const midY = (start.y + end.y) / 2;
    path = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    midpoint = { x: (start.x + end.x) / 2, y: midY };
  }

  return { path, midpoint };
}

/**
 * Calculate the position for an operator label between sibling nodes.
 * The operator is placed on the vertical/horizontal line segment of the orthogonal path.
 */
export function calculateOperatorPosition(
  parentRect: NodeRect,
  sibling1Rect: NodeRect,
  sibling2Rect: NodeRect,
  direction: LayoutDirection
): Point {
  switch (direction) {
    case 'ltr': {
      // Vertical line is at midpoint between parent's right edge and children's left edge
      const parentRight = parentRect.left + parentRect.width;
      const childrenLeft = Math.min(sibling1Rect.left, sibling2Rect.left);
      const midX = (parentRight + childrenLeft) / 2;
      return {
        x: midX,
        y: (sibling1Rect.centerY + sibling2Rect.centerY) / 2
      };
    }

    case 'rtl': {
      // Vertical line is at midpoint between parent's left edge and children's right edge
      const parentLeft = parentRect.left;
      const childrenRight = Math.max(sibling1Rect.left + sibling1Rect.width, sibling2Rect.left + sibling2Rect.width);
      const midX = (parentLeft + childrenRight) / 2;
      return {
        x: midX,
        y: (sibling1Rect.centerY + sibling2Rect.centerY) / 2
      };
    }

    case 'ttb': {
      // Horizontal line is at midpoint between parent's bottom edge and children's top edge
      const parentBottom = parentRect.top + parentRect.height;
      const childrenTop = Math.min(sibling1Rect.top, sibling2Rect.top);
      const midY = (parentBottom + childrenTop) / 2;
      return {
        x: (sibling1Rect.centerX + sibling2Rect.centerX) / 2,
        y: midY
      };
    }

    case 'btt': {
      // Horizontal line is at midpoint between parent's top edge and children's bottom edge
      const parentTop = parentRect.top;
      const childrenBottom = Math.max(sibling1Rect.top + sibling1Rect.height, sibling2Rect.top + sibling2Rect.height);
      const midY = (parentTop + childrenBottom) / 2;
      return {
        x: (sibling1Rect.centerX + sibling2Rect.centerX) / 2,
        y: midY
      };
    }
  }
}

/**
 * Get SVG style attributes for an edge
 */
export function getEdgeSvgStyle(
  defaultColor: string,
  defaultWidth: number,
  edgeStyle?: EdgeStyle
): { stroke: string; strokeWidth: number; strokeDasharray?: string } {
  return {
    stroke: edgeStyle?.color ?? defaultColor,
    strokeWidth: edgeStyle?.width ?? defaultWidth,
    ...(edgeStyle?.dasharray ? { strokeDasharray: edgeStyle.dasharray } : {})
  };
}
