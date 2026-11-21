/**
 * Tree Layout utility for bn-tree component
 * Handles level assignment and grid positioning for tree nodes
 */

import { TreeConfig } from "./TreeParser";

export type LayoutDirection = "ltr" | "rtl" | "ttb" | "btt";

export interface NodePosition {
  nodeId: string;
  level: number;
  index: number;
  gridColumn: number;
  gridRow: number;
  gridRowSpan: number;
  gridColumnSpan: number;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  maxLevel: number;
  maxIndex: number;
}

/**
 * Calculate the layout positions for all nodes in the tree
 */
export function calculateLayout(
  config: TreeConfig,
  direction: LayoutDirection,
  levelSpacing: number,
  nodeSpacing: number,
): LayoutResult {
  if (!config.rootNode) {
    return {
      positions: new Map(),
      gridTemplateColumns: "",
      gridTemplateRows: "",
      maxLevel: 0,
      maxIndex: 0,
    };
  }

  // Step 1: Assign levels using BFS
  const nodeLevels = assignLevels(config);

  // Step 2: Calculate vertical positions (row indices) for each node
  const nodeIndices = calculateNodeIndices(config);

  // Step 3: Calculate grid positions based on direction
  const positions = calculateGridPositions(config, nodeLevels, nodeIndices, direction);

  // Step 4: Generate CSS grid templates
  const maxLevel = Math.max(...Array.from(nodeLevels.values()));
  const maxIndex = Math.max(...Array.from(nodeIndices.values()).map((ni) => ni.endIndex));

  const { gridTemplateColumns, gridTemplateRows } = generateGridTemplates(
    maxLevel,
    maxIndex,
    direction,
    levelSpacing,
    nodeSpacing,
  );

  return {
    positions,
    gridTemplateColumns,
    gridTemplateRows,
    maxLevel,
    maxIndex,
  };
}

/**
 * Assign levels to each node using BFS from root
 */
function assignLevels(config: TreeConfig): Map<string, number> {
  const levels = new Map<string, number>();

  if (!config.rootNode) {
    return levels;
  }

  const queue: { node: string; level: number }[] = [{ node: config.rootNode, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;

    if (visited.has(node)) {
      continue;
    }

    visited.add(node);
    levels.set(node, level);

    const children = config.adjacencyList.get(node) || [];
    for (const child of children) {
      if (!visited.has(child)) {
        queue.push({ node: child, level: level + 1 });
      }
    }
  }

  return levels;
}

interface NodeIndexInfo {
  startIndex: number;
  endIndex: number;
}

/**
 * Calculate vertical indices for nodes, ensuring parent nodes span their children.
 * Handles DAG structures where a node may have multiple parents.
 */
function calculateNodeIndices(config: TreeConfig): Map<string, NodeIndexInfo> {
  const indices = new Map<string, NodeIndexInfo>();

  if (!config.rootNode) {
    return indices;
  }

  // Assign indices using DFS, tracking visited nodes for DAG support
  let currentIndex = 0;

  function assignIndex(node: string): NodeIndexInfo {
    // If already visited (node has multiple parents), return existing index
    const existing = indices.get(node);
    if (existing) {
      return existing;
    }

    const children = config.adjacencyList.get(node) || [];

    // Marked before the children are visited, so an edge back to this node ends here.
    // validateEdges rejects cycles, this only keeps the layout from running forever.
    indices.set(node, { startIndex: currentIndex, endIndex: currentIndex });

    if (children.length === 0) {
      // Leaf node
      const info: NodeIndexInfo = { startIndex: currentIndex, endIndex: currentIndex };
      indices.set(node, info);
      currentIndex++;
      return info;
    }

    // Parent node: process children first
    let startIndex = Infinity;
    let endIndex = -Infinity;

    for (const child of children) {
      const childInfo = assignIndex(child);
      startIndex = Math.min(startIndex, childInfo.startIndex);
      endIndex = Math.max(endIndex, childInfo.endIndex);
    }

    const info: NodeIndexInfo = { startIndex, endIndex };
    indices.set(node, info);
    return info;
  }

  assignIndex(config.rootNode);

  return indices;
}

/**
 * Convert levels and indices to CSS grid positions based on direction
 */
function calculateGridPositions(
  config: TreeConfig,
  levels: Map<string, number>,
  indices: Map<string, NodeIndexInfo>,
  direction: LayoutDirection,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const maxLevel = Math.max(...Array.from(levels.values()));

  for (const nodeId of config.allNodes) {
    const level = levels.get(nodeId) ?? 0;
    const indexInfo = indices.get(nodeId) ?? { startIndex: 0, endIndex: 0 };

    let gridColumn: number;
    let gridRow: number;
    let gridRowSpan: number = 1;
    let gridColumnSpan: number = 1;
    // a parent spans its children, so it sits centred next to them or over them
    const span = indexInfo.endIndex - indexInfo.startIndex + 1;
    // Two parents that share a child have ranges that overlap. As columns their spans
    // would put the two boxes on top of each other: such a parent keeps the column of its first child.
    const sharesColumns = Array.from(config.allNodes).some((other) => {
      const otherInfo = indices.get(other);
      return (
        other !== nodeId &&
        otherInfo !== undefined &&
        (levels.get(other) ?? 0) === level &&
        otherInfo.startIndex <= indexInfo.endIndex &&
        indexInfo.startIndex <= otherInfo.endIndex
      );
    });
    const columnSpan = sharesColumns ? 1 : span;

    switch (direction) {
      case "ltr":
        // Left to right: levels are columns, indices are rows
        gridColumn = level + 1; // CSS grid is 1-indexed
        gridRow = indexInfo.startIndex + 1;
        gridRowSpan = span;
        break;

      case "rtl":
        // Right to left: levels are reversed columns
        gridColumn = maxLevel - level + 1;
        gridRow = indexInfo.startIndex + 1;
        gridRowSpan = span;
        break;

      case "ttb":
        // Top to bottom: levels are rows, indices are columns
        gridRow = level + 1;
        gridColumn = indexInfo.startIndex + 1;
        gridColumnSpan = columnSpan;
        break;

      case "btt":
        // Bottom to top: levels are reversed rows
        gridRow = maxLevel - level + 1;
        gridColumn = indexInfo.startIndex + 1;
        gridColumnSpan = columnSpan;
        break;
    }

    positions.set(nodeId, {
      nodeId,
      level,
      index: indexInfo.startIndex,
      gridColumn,
      gridRow,
      gridRowSpan,
      gridColumnSpan,
    });
  }

  return positions;
}

/**
 * Generate CSS grid template strings
 */
function generateGridTemplates(
  maxLevel: number,
  maxIndex: number,
  direction: LayoutDirection,
  levelSpacing: number,
  nodeSpacing: number,
): { gridTemplateColumns: string; gridTemplateRows: string } {
  const isHorizontal = direction === "ltr" || direction === "rtl";
  const numLevels = maxLevel + 1;
  const numNodes = maxIndex + 1;

  if (isHorizontal) {
    // For horizontal layouts, columns represent levels, rows represent nodes
    const columns: string[] = [];
    for (let i = 0; i < numLevels; i++) {
      columns.push("auto");
      if (i < numLevels - 1) {
        columns.push(`${levelSpacing}px`); // Spacer column
      }
    }

    const rows: string[] = [];
    for (let i = 0; i < numNodes; i++) {
      rows.push("auto");
      if (i < numNodes - 1) {
        rows.push(`${nodeSpacing}px`); // Spacer row
      }
    }

    return {
      gridTemplateColumns: columns.join(" "),
      gridTemplateRows: rows.join(" "),
    };
  } else {
    // For vertical layouts, rows represent levels, columns represent nodes
    const rows: string[] = [];
    for (let i = 0; i < numLevels; i++) {
      rows.push("auto");
      if (i < numLevels - 1) {
        rows.push(`${levelSpacing}px`); // Spacer row
      }
    }

    const columns: string[] = [];
    for (let i = 0; i < numNodes; i++) {
      columns.push("auto");
      if (i < numNodes - 1) {
        columns.push(`${nodeSpacing}px`); // Spacer column
      }
    }

    return {
      gridTemplateColumns: columns.join(" "),
      gridTemplateRows: rows.join(" "),
    };
  }
}

/**
 * Get the actual grid column accounting for spacer columns
 */
export function getActualGridColumn(baseColumn: number): number {
  // Account for spacer columns between levels
  return (baseColumn - 1) * 2 + 1;
}

/**
 * Get the actual grid row accounting for spacer rows
 */
export function getActualGridRow(baseRow: number): number {
  // Account for spacer rows between nodes
  return (baseRow - 1) * 2 + 1;
}

/**
 * Get the actual grid row span accounting for spacer rows
 */
export function getActualGridRowSpan(baseRowSpan: number): number {
  if (baseRowSpan <= 1) {
    return 1;
  }
  // Span includes the spacer rows between nodes
  return (baseRowSpan - 1) * 2 + 1;
}

/**
 * Get the actual grid column span accounting for spacer columns
 */
export function getActualGridColumnSpan(baseColumnSpan: number): number {
  return getActualGridRowSpan(baseColumnSpan);
}

/**
 * How far each box of a column moves so that `spacing` is between two
 * neighbours. The boxes are sorted from top to bottom. A run of boxes that
 * push each other stays centred where it was, as far as the box above it and
 * the top of the tree allow. Boxes that have their distance do not move.
 */
export function separate(boxes: { top: number; height: number }[], spacing: number): number[] {
  const shifts = boxes.map(() => 0);
  let runStart = 0;
  const centre = (from: number, to: number) => {
    // the run was pushed down from its first box: move it back up by half of the last push
    const back = shifts[to] / 2;
    const above = from > 0 ? boxes[from - 1].top + shifts[from - 1] + boxes[from - 1].height + spacing : 0;
    const allowed = Math.max(0, Math.min(back, boxes[from].top - above));
    for (let i = from; i <= to; i++) {
      shifts[i] -= allowed;
    }
  };
  for (let i = 1; i < boxes.length; i++) {
    const end = boxes[i - 1].top + shifts[i - 1] + boxes[i - 1].height;
    const missing = end + spacing - boxes[i].top;
    // offsetTop and offsetHeight are whole px: up to 1 px is rounding
    if (missing > 1) {
      shifts[i] = missing;
    } else {
      if (shifts[i - 1] > 0) {
        centre(runStart, i - 1);
      }
      runStart = i;
    }
  }
  if (boxes.length > 0 && shifts[boxes.length - 1] > 0) {
    centre(runStart, boxes.length - 1);
  }
  return shifts;
}
