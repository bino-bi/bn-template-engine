/**
 * Tree Parser utility for bn-tree component
 * Handles JSON parsing and validation for tree edge configurations
 */

export interface EdgeStyle {
  color?: string;
  width?: number;
  dasharray?: string;
}

export interface TreeEdge {
  from: string;
  to: string;
  operator?: "*" | "/" | "+" | "-" | "x" | "÷" | "none";
  label?: string;
  style?: EdgeStyle;
}

export interface TreeConfig {
  edges: TreeEdge[];
  adjacencyList: Map<string, string[]>;
  rootNode: string | null;
  allNodes: Set<string>;
}

const VALID_OPERATORS = ["*", "/", "+", "-", "x", "÷", "none"];

/**
 * Parse the JSON edges configuration string into a TreeConfig object
 * @param json - JSON string containing array of TreeEdge objects
 * @returns TreeConfig object or null if parsing fails
 */
export function parseTreeConfig(json: string): TreeConfig | null {
  if (!json || json.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const edges: TreeEdge[] = parsed;
    const adjacencyList = buildAdjacencyList(edges);
    const allNodes = collectAllNodes(edges);
    const rootNode = findRootNode(edges, allNodes);

    return {
      edges,
      adjacencyList,
      rootNode,
      allNodes,
    };
  } catch (e) {
    console.error("parseTreeConfig: failed to parse tree configuration", e);
    return null;
  }
}

/**
 * Validate the edges JSON configuration and return validation errors
 * @param json - JSON string to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateEdges(json: string): string[] {
  const errors: string[] = [];

  if (!json || json.trim() === "") {
    errors.push("edges: value is required");
    return errors;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    errors.push("edges: invalid JSON structure");
    return errors;
  }

  if (!Array.isArray(parsed)) {
    errors.push("edges: must be an array");
    return errors;
  }

  if (parsed.length === 0) {
    errors.push("edges: array must not be empty");
    return errors;
  }

  const allNodes = new Set<string>();
  const targetNodes = new Set<string>();
  const children = new Map<string, string[]>();

  parsed.forEach((edge, index) => {
    if (typeof edge !== "object" || edge === null) {
      errors.push(`edges[${index}]: must be an object`);
      return;
    }

    const typedEdge = edge as Record<string, unknown>;

    if (typeof typedEdge.from !== "string" || typedEdge.from.trim() === "") {
      errors.push(`edges[${index}]: 'from' is required and must be a non-empty string`);
    } else {
      allNodes.add(typedEdge.from);
    }

    if (typeof typedEdge.to !== "string" || typedEdge.to.trim() === "") {
      errors.push(`edges[${index}]: 'to' is required and must be a non-empty string`);
    } else {
      allNodes.add(typedEdge.to);
      targetNodes.add(typedEdge.to);
      if (typeof typedEdge.from === "string") {
        children.set(typedEdge.from, [...(children.get(typedEdge.from) || []), typedEdge.to]);
      }
    }

    if (typedEdge.operator !== undefined) {
      if (typeof typedEdge.operator !== "string" || !VALID_OPERATORS.includes(typedEdge.operator)) {
        errors.push(`edges[${index}]: 'operator' must be one of: ${VALID_OPERATORS.join(", ")}`);
      }
    }

    if (typedEdge.label !== undefined && typeof typedEdge.label !== "string") {
      errors.push(`edges[${index}]: 'label' must be a string`);
    }

    if (typedEdge.style !== undefined) {
      if (typeof typedEdge.style !== "object" || typedEdge.style === null) {
        errors.push(`edges[${index}]: 'style' must be an object`);
      } else {
        const style = typedEdge.style as Record<string, unknown>;
        if (style.color !== undefined && typeof style.color !== "string") {
          errors.push(`edges[${index}]: 'style.color' must be a string`);
        }
        if (style.width !== undefined && typeof style.width !== "number") {
          errors.push(`edges[${index}]: 'style.width' must be a number`);
        }
        if (style.dasharray !== undefined && typeof style.dasharray !== "string") {
          errors.push(`edges[${index}]: 'style.dasharray' must be a string`);
        }
      }
    }
  });

  // Check for multiple roots (nodes that are not targets of any edge)
  const rootNodes = Array.from(allNodes).filter((node) => !targetNodes.has(node));
  if (rootNodes.length === 0) {
    errors.push("edges: tree has no root node (circular reference detected)");
  } else if (rootNodes.length > 1) {
    errors.push(`edges: tree has multiple root nodes: ${rootNodes.join(", ")}`);
  } else {
    errors.push(...findCycleErrors(rootNodes[0], children, allNodes));
  }

  return errors;
}

/**
 * Walks the tree from its root. An edge that leads back to a node on the way from the
 * root is a cycle. A node the walk never reaches hangs in a cycle of its own.
 */
function findCycleErrors(root: string, children: Map<string, string[]>, allNodes: Set<string>): string[] {
  const errors: string[] = [];
  const onPath = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): void => {
    visited.add(node);
    onPath.add(node);
    for (const child of children.get(node) || []) {
      if (onPath.has(child)) {
        errors.push(`edges: circular reference, the edge from '${node}' to '${child}' leads back`);
      } else if (!visited.has(child)) {
        visit(child);
      }
    }
    onPath.delete(node);
  };
  visit(root);

  const unreachable = Array.from(allNodes).filter((node) => !visited.has(node));
  if (unreachable.length > 0) {
    errors.push(`edges: nodes not connected to the root '${root}': ${unreachable.join(", ")}`);
  }

  return errors;
}

/**
 * Build an adjacency list from edges (parent -> children mapping)
 */
function buildAdjacencyList(edges: TreeEdge[]): Map<string, string[]> {
  const adjacencyList = new Map<string, string[]>();

  for (const edge of edges) {
    const children = adjacencyList.get(edge.from) || [];
    children.push(edge.to);
    adjacencyList.set(edge.from, children);
  }

  return adjacencyList;
}

/**
 * Collect all unique node IDs from edges
 */
function collectAllNodes(edges: TreeEdge[]): Set<string> {
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
  }
  return nodes;
}

/**
 * Find the root node (node with no incoming edges)
 */
function findRootNode(edges: TreeEdge[], allNodes: Set<string>): string | null {
  const targetNodes = new Set<string>();
  for (const edge of edges) {
    targetNodes.add(edge.to);
  }

  const rootNodes = Array.from(allNodes).filter((node) => !targetNodes.has(node));
  return rootNodes.length === 1 ? rootNodes[0] : null;
}

/**
 * Get the operator symbol to display between sibling nodes
 */
export function getOperatorSymbol(operator: string | undefined): string {
  switch (operator) {
    case "*":
    case "x":
      return "×";
    case "/":
    case "÷":
      return "÷";
    case "+":
      return "+";
    case "-":
      return "−";
    case "none":
      return "";
    default:
      return "";
  }
}

/**
 * Get the edge connecting a parent to a specific child
 */
export function getEdgeForChild(edges: TreeEdge[], parent: string, child: string): TreeEdge | undefined {
  return edges.find((edge) => edge.from === parent && edge.to === child);
}
