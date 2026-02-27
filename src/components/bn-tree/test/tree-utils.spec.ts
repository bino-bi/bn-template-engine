import { parseTreeConfig, validateEdges, getOperatorSymbol, getEdgeForChild } from "../utils/TreeParser";
import { calculateLayout, getActualGridColumn, getActualGridRow, getActualGridRowSpan } from "../utils/TreeLayout";
import {
  generateEdgePath,
  getConnectionPoint,
  getMultiParentConnectionPoint,
  calculateOperatorPosition,
} from "../utils/EdgeRenderer";

// TreeParser tests
describe("TreeParser", () => {
  describe("parseTreeConfig", () => {
    it("should parse valid edges JSON", () => {
      const json = '[{"from":"roi","to":"ros"},{"from":"roi","to":"ct"}]';
      const config = parseTreeConfig(json);

      expect(config).not.toBeNull();
      expect(config!.edges.length).toBe(2);
      expect(config!.rootNode).toBe("roi");
      expect(config!.allNodes.size).toBe(3);
      expect(config!.adjacencyList.get("roi")).toEqual(["ros", "ct"]);
    });

    it("should return null for empty string", () => {
      expect(parseTreeConfig("")).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      expect(parseTreeConfig("not json")).toBeNull();
    });

    it("should return null for non-array JSON", () => {
      expect(parseTreeConfig('{"from":"a","to":"b"}')).toBeNull();
    });

    it("should parse edges with operators", () => {
      const json = '[{"from":"roi","to":"ros","operator":"x"}]';
      const config = parseTreeConfig(json);

      expect(config!.edges[0].operator).toBe("x");
    });

    it("should parse edges with custom styles", () => {
      const json = '[{"from":"a","to":"b","style":{"color":"#ff0000","width":2}}]';
      const config = parseTreeConfig(json);

      expect(config!.edges[0].style?.color).toBe("#ff0000");
      expect(config!.edges[0].style?.width).toBe(2);
    });
  });

  describe("validateEdges", () => {
    it("should return error for empty value", () => {
      const errors = validateEdges("");
      expect(errors).toContain("edges: value is required");
    });

    it("should return error for invalid JSON", () => {
      const errors = validateEdges("invalid");
      expect(errors).toContain("edges: invalid JSON structure");
    });

    it("should return error for non-array", () => {
      const errors = validateEdges("{}");
      expect(errors).toContain("edges: must be an array");
    });

    it("should return error for empty array", () => {
      const errors = validateEdges("[]");
      expect(errors).toContain("edges: array must not be empty");
    });

    it("should return error for missing from", () => {
      const errors = validateEdges('[{"to":"b"}]');
      expect(errors.some((e) => e.includes("'from' is required"))).toBe(true);
    });

    it("should return error for missing to", () => {
      const errors = validateEdges('[{"from":"a"}]');
      expect(errors.some((e) => e.includes("'to' is required"))).toBe(true);
    });

    it("should return error for invalid operator", () => {
      const errors = validateEdges('[{"from":"a","to":"b","operator":"invalid"}]');
      expect(errors.some((e) => e.includes("'operator' must be one of"))).toBe(true);
    });

    it("should return error for multiple roots", () => {
      const errors = validateEdges('[{"from":"a","to":"c"},{"from":"b","to":"d"}]');
      expect(errors.some((e) => e.includes("multiple root nodes"))).toBe(true);
    });

    it("should return empty array for valid edges", () => {
      const errors = validateEdges('[{"from":"a","to":"b"},{"from":"a","to":"c"}]');
      expect(errors.length).toBe(0);
    });
  });

  describe("getOperatorSymbol", () => {
    it("should return × for multiplication operators", () => {
      expect(getOperatorSymbol("*")).toBe("×");
      expect(getOperatorSymbol("x")).toBe("×");
    });

    it("should return ÷ for division operators", () => {
      expect(getOperatorSymbol("/")).toBe("÷");
      expect(getOperatorSymbol("÷")).toBe("÷");
    });

    it("should return + for addition", () => {
      expect(getOperatorSymbol("+")).toBe("+");
    });

    it("should return − for subtraction", () => {
      expect(getOperatorSymbol("-")).toBe("−");
    });

    it("should return empty string for none", () => {
      expect(getOperatorSymbol("none")).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(getOperatorSymbol(undefined)).toBe("");
    });
  });

  describe("getEdgeForChild", () => {
    it("should find edge connecting parent to child", () => {
      const edges = [
        { from: "a", to: "b", operator: "x" as const },
        { from: "a", to: "c" },
      ];
      const edge = getEdgeForChild(edges, "a", "b");
      expect(edge?.operator).toBe("x");
    });

    it("should return undefined for non-existent edge", () => {
      const edges = [{ from: "a", to: "b" }];
      expect(getEdgeForChild(edges, "x", "y")).toBeUndefined();
    });
  });
});

// TreeLayout tests
describe("TreeLayout", () => {
  describe("calculateLayout", () => {
    const simpleConfig = parseTreeConfig('[{"from":"root","to":"child1"},{"from":"root","to":"child2"}]');

    it("should calculate layout for simple tree", () => {
      const layout = calculateLayout(simpleConfig!, "ltr", 60, 20);

      expect(layout.positions.size).toBe(3);
      expect(layout.maxLevel).toBe(1);
    });

    it("should assign correct levels", () => {
      const layout = calculateLayout(simpleConfig!, "ltr", 60, 20);

      expect(layout.positions.get("root")?.level).toBe(0);
      expect(layout.positions.get("child1")?.level).toBe(1);
      expect(layout.positions.get("child2")?.level).toBe(1);
    });

    it("should handle different directions", () => {
      const rtlLayout = calculateLayout(simpleConfig!, "rtl", 60, 20);

      // In RTL, root should have higher column number
      expect(rtlLayout.positions.get("root")?.gridColumn).toBeGreaterThan(
        rtlLayout.positions.get("child1")?.gridColumn!,
      );
    });

    it("should handle DAG structures (node with multiple parents)", () => {
      // node1 -> node2 -> node5, node1 -> node3 -> node5 (node5 has 2 parents)
      const dagConfig = parseTreeConfig(
        '[{"from":"node1","to":"node2"},{"from":"node1","to":"node3"},{"from":"node2","to":"node5"},{"from":"node3","to":"node5"}]',
      );
      const layout = calculateLayout(dagConfig!, "ltr", 60, 20);

      // All 4 nodes should have positions
      expect(layout.positions.size).toBe(4);

      // node5 should only appear once with a single position
      const node5Position = layout.positions.get("node5");
      expect(node5Position).toBeDefined();
      expect(node5Position!.level).toBe(2); // Level 2 (node1=0, node2/node3=1, node5=2)

      // Both node2 and node3 should have edges to node5 (verified by edge count in config)
      expect(dagConfig!.edges.filter((e) => e.to === "node5").length).toBe(2);
    });
  });

  describe("grid helpers", () => {
    it("should calculate actual grid column with spacers", () => {
      expect(getActualGridColumn(1)).toBe(1);
      expect(getActualGridColumn(2)).toBe(3);
      expect(getActualGridColumn(3)).toBe(5);
    });

    it("should calculate actual grid row with spacers", () => {
      expect(getActualGridRow(1)).toBe(1);
      expect(getActualGridRow(2)).toBe(3);
      expect(getActualGridRow(3)).toBe(5);
    });

    it("should calculate actual grid row span with spacers", () => {
      expect(getActualGridRowSpan(1)).toBe(1);
      expect(getActualGridRowSpan(2)).toBe(3);
      expect(getActualGridRowSpan(3)).toBe(5);
    });
  });
});

// EdgeRenderer tests
describe("EdgeRenderer", () => {
  const nodeRect = {
    left: 0,
    top: 0,
    width: 100,
    height: 50,
    centerX: 50,
    centerY: 25,
  };

  describe("getConnectionPoint", () => {
    it("should return right edge for source in ltr", () => {
      const point = getConnectionPoint(nodeRect, true, "ltr");
      expect(point.x).toBe(100);
      expect(point.y).toBe(25);
    });

    it("should return left edge for target in ltr", () => {
      const point = getConnectionPoint(nodeRect, false, "ltr");
      expect(point.x).toBe(0);
      expect(point.y).toBe(25);
    });

    it("should return bottom edge for source in ttb", () => {
      const point = getConnectionPoint(nodeRect, true, "ttb");
      expect(point.x).toBe(50);
      expect(point.y).toBe(50);
    });
  });

  describe("getMultiParentConnectionPoint", () => {
    it("should offset connection points vertically for ltr with 2 parents", () => {
      // With 2 parents and default spacing of 8px, they should be at centerY-4 and centerY+4
      const point0 = getMultiParentConnectionPoint(nodeRect, "ltr", 0, 2);
      const point1 = getMultiParentConnectionPoint(nodeRect, "ltr", 1, 2);

      // Both connect to left edge (x=0)
      expect(point0.x).toBe(0);
      expect(point1.x).toBe(0);

      // First parent at centerY - 4, second at centerY + 4
      expect(point0.y).toBe(21); // 25 - 4
      expect(point1.y).toBe(29); // 25 + 4

      // They should be 8px apart
      expect(point1.y - point0.y).toBe(8);
    });

    it("should offset connection points horizontally for ttb with 2 parents", () => {
      const point0 = getMultiParentConnectionPoint(nodeRect, "ttb", 0, 2);
      const point1 = getMultiParentConnectionPoint(nodeRect, "ttb", 1, 2);

      // Both connect to top edge (y=0)
      expect(point0.y).toBe(0);
      expect(point1.y).toBe(0);

      // First parent at centerX - 4, second at centerX + 4
      expect(point0.x).toBe(46); // 50 - 4
      expect(point1.x).toBe(54); // 50 + 4
    });
  });

  describe("generateEdgePath", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };

    it("should generate straight path", () => {
      const { path } = generateEdgePath(start, end, "straight", "ltr");
      expect(path).toContain("M 0 0");
      expect(path).toContain("L 100 100");
    });

    it("should generate orthogonal path", () => {
      const { path } = generateEdgePath(start, end, "orthogonal", "ltr");
      expect(path).toContain("M 0 0");
      expect(path).toContain("L 100 100");
    });

    it("should generate curved path", () => {
      const { path } = generateEdgePath(start, end, "curved", "ltr");
      expect(path).toContain("C");
    });

    it("should calculate midpoint", () => {
      const { midpoint } = generateEdgePath(start, end, "straight", "ltr");
      expect(midpoint.x).toBe(50);
      expect(midpoint.y).toBe(50);
    });
  });

  describe("calculateOperatorPosition", () => {
    // Parent is at x=0, children are at x=200 (with 100px gap between)
    const parentRect = { left: 0, top: 50, width: 100, height: 50, centerX: 50, centerY: 75 };
    const sibling1Rect = { left: 200, top: 0, width: 100, height: 50, centerX: 250, centerY: 25 };
    const sibling2Rect = { left: 200, top: 100, width: 100, height: 50, centerX: 250, centerY: 125 };

    it("should position operator at T-junction with 70% bend ratio for ltr", () => {
      const pos = calculateOperatorPosition(parentRect, sibling1Rect, sibling2Rect, "ltr");
      // midX = parentRight + (childrenLeft - parentRight) * 0.7 = 100 + (200 - 100) * 0.7 = 170
      expect(pos.x).toBe(170);
      // Y at parent's centerY (T-junction) = 75
      expect(pos.y).toBe(75);
    });

    it("should position operator at T-junction with 70% bend ratio for rtl", () => {
      // For RTL, parent would be on the right
      const rtlParent = { left: 300, top: 50, width: 100, height: 50, centerX: 350, centerY: 75 };
      const rtlSibling1 = { left: 100, top: 0, width: 100, height: 50, centerX: 150, centerY: 25 };
      const rtlSibling2 = { left: 100, top: 100, width: 100, height: 50, centerX: 150, centerY: 125 };

      const pos = calculateOperatorPosition(rtlParent, rtlSibling1, rtlSibling2, "rtl");
      // midX = childrenRight + (parentLeft - childrenRight) * 0.7 = 200 + (300 - 200) * 0.7 = 270
      expect(pos.x).toBe(270);
      // Y at parent's centerY = 75
      expect(pos.y).toBe(75);
    });
  });
});
