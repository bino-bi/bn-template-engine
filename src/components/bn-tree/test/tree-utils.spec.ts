import { parseTreeConfig, validateEdges, getOperatorSymbol, getEdgeForChild } from "../utils/TreeParser";
import {
  calculateLayout,
  getActualGridColumn,
  getActualGridColumnSpan,
  getActualGridRow,
  getActualGridRowSpan,
} from "../utils/TreeLayout";
import {
  calculateBend,
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

    it.each([
      ["a cycle below the root", '[{"from":"root","to":"a"},{"from":"a","to":"b"},{"from":"b","to":"a"}]'],
      ["an edge from a node to itself", '[{"from":"root","to":"a"},{"from":"a","to":"a"}]'],
    ])("should return an error for %s and lay it out without a crash", (_name, json) => {
      const errors = validateEdges(json);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("circular reference");
      expect(errors[0]).toContain("'a'");
      // the layout must end even if it gets such a tree
      expect(() => calculateLayout(parseTreeConfig(json)!, "ltr", 40, 20)).not.toThrow();
    });

    it("should return an error for nodes that are not connected to the root", () => {
      const errors = validateEdges('[{"from":"root","to":"a"},{"from":"b","to":"c"},{"from":"c","to":"b"}]');

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("not connected to the root");
      expect(errors[0]).toContain("b, c");
    });

    it("should accept a node with two parents", () => {
      expect(
        validateEdges(
          '[{"from":"root","to":"a"},{"from":"root","to":"b"},{"from":"a","to":"c"},{"from":"b","to":"c"}]',
        ),
      ).toEqual([]);
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

  describe("vertical directions", () => {
    const json =
      '[{"from":"root","to":"a"},{"from":"root","to":"b"},{"from":"root","to":"c"},{"from":"a","to":"a1"},{"from":"a","to":"a2"}]';

    it.each(["ttb", "btt"] as const)("should span a parent over the columns of its children for %s", (direction) => {
      const layout = calculateLayout(parseTreeConfig(json)!, direction, 40, 20);
      const span = (node: string): [number, number] => [
        layout.positions.get(node)!.gridColumn,
        layout.positions.get(node)!.gridColumnSpan,
      ];

      // leaves a1, a2, b, c take the columns 1 to 4
      expect(span("root")).toEqual([1, 4]);
      expect(span("a")).toEqual([1, 2]);
      expect(span("b")).toEqual([3, 1]);
      expect(span("c")).toEqual([4, 1]);
    });

    it.each(["ttb", "btt"] as const)(
      "should not span parents that share a child for %s, their spans would overlap",
      (direction) => {
        // ros and ct both lead to revenue
        const shared =
          '[{"from":"roi","to":"ros"},{"from":"roi","to":"ct"},{"from":"ros","to":"profit"},{"from":"ros","to":"revenue"},{"from":"ct","to":"revenue"},{"from":"ct","to":"capital"}]';
        const layout = calculateLayout(parseTreeConfig(shared)!, direction, 40, 20);
        const span = (node: string): [number, number] => [
          layout.positions.get(node)!.gridColumn,
          layout.positions.get(node)!.gridColumnSpan,
        ];

        // each in the column of its first child, as before
        expect(span("ros")).toEqual([1, 1]);
        expect(span("ct")).toEqual([2, 1]);
        // the root is alone in its level
        expect(span("roi")).toEqual([1, 3]);
      },
    );

    it("should keep one column per node for ltr", () => {
      const layout = calculateLayout(parseTreeConfig(json)!, "ltr", 40, 20);

      expect(layout.positions.get("root")!.gridColumnSpan).toBe(1);
      expect(layout.positions.get("root")!.gridRowSpan).toBe(4);
    });
  });

  describe("grid helpers", () => {
    it("should calculate actual grid column span with spacers", () => {
      expect(getActualGridColumnSpan(1)).toBe(1);
      expect(getActualGridColumnSpan(3)).toBe(5);
    });

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

  describe("calculateBend and calculateOperatorPosition", () => {
    // Parent is at x=0, three children are at x=200 (with 100px gap between)
    const parentRect = { left: 0, top: 100, width: 100, height: 50, centerX: 50, centerY: 125 };
    const child1 = { left: 200, top: 0, width: 100, height: 50, centerX: 250, centerY: 25 };
    const child2 = { left: 200, top: 100, width: 100, height: 50, centerX: 250, centerY: 125 };
    const child3 = { left: 200, top: 200, width: 100, height: 50, centerX: 250, centerY: 225 };
    const children = [child1, child2, child3];

    /** The same tree turned so that the level axis runs along `direction`. */
    const turned = (rect: typeof parentRect, direction: "ltr" | "rtl" | "ttb" | "btt") => {
      const left = direction === "rtl" ? 300 - rect.left - rect.width : rect.left;
      const flipped = { ...rect, left, centerX: left + rect.width / 2 };
      if (direction === "ltr" || direction === "rtl") {
        return flipped;
      }
      // swap the axes; btt is the mirrored one
      const source = direction === "btt" ? turned(rect, "rtl") : rect;
      return {
        left: source.top,
        top: source.left,
        width: source.height,
        height: source.width,
        centerX: source.centerY,
        centerY: source.centerX,
      };
    };

    it("should bend 70% of the way from the parent to the nearest child for ltr", () => {
      // 100 + (200 - 100) * 0.7
      expect(calculateBend(parentRect, children, "ltr")).toBe(170);
    });

    it("should take the nearest child when the children start at different places", () => {
      const wide = { ...child2, left: 150, width: 150 };

      // 100 + (150 - 100) * 0.7
      expect(calculateBend(parentRect, [child1, wide, child3], "ltr")).toBe(135);
    });

    it.each([
      ["ltr", 170],
      ["rtl", 130],
      ["ttb", 170],
      ["btt", 130],
    ] as const)("should put the bend of %s on the side of the parent", (direction, expected) => {
      const rects = children.map((child) => turned(child, direction));

      // rtl and btt were mirrored: they bent 30% of the way
      expect(calculateBend(turned(parentRect, direction), rects, direction)).toBe(expected);
    });

    it("should leave a child out of the bend that is not ahead of the parent", () => {
      // a child with a second parent can sit in the level of this parent
      const beside = { left: 0, top: 300, width: 100, height: 50, centerX: 50, centerY: 325 };

      // the bend was inside the parent box
      expect(calculateBend(parentRect, [beside, child1], "ltr")).toBe(170);
    });

    it("should have no bend when no child is ahead of the parent", () => {
      const beside = { left: 0, top: 300, width: 100, height: 50, centerX: 50, centerY: 325 };

      expect(calculateBend(parentRect, [beside], "ltr")).toBeUndefined();
    });

    it("should bend every edge of a parent at the bend of the parent", () => {
      const start = getConnectionPoint(parentRect, true, "ltr");
      const wide = { ...child2, left: 150, width: 150 };
      const bend = calculateBend(parentRect, [child1, wide, child3], "ltr");

      for (const child of [child1, wide, child3]) {
        const { path } = generateEdgePath(start, getConnectionPoint(child, false, "ltr"), "orthogonal", "ltr", bend);
        expect(path).toContain(`L ${bend} ${start.y} L ${bend} ${child.centerY}`);
      }
    });

    it("should put the operators of three siblings between each pair, on the bus", () => {
      const first = calculateOperatorPosition(170, child1, child2, "ltr");
      const second = calculateOperatorPosition(170, child2, child3, "ltr");

      // both were drawn on the same spot, at the centre of the parent
      expect(first).toEqual({ x: 170, y: 75 });
      expect(second).toEqual({ x: 170, y: 175 });
    });

    it("should put the operator of two siblings where the parent meets the bus", () => {
      expect(calculateOperatorPosition(170, child1, child3, "ltr")).toEqual({ x: 170, y: parentRect.centerY });
    });

    it("should put the operators along the bus for ttb", () => {
      const [first, second, third] = children.map((child) => turned(child, "ttb"));

      expect(calculateOperatorPosition(170, first, second, "ttb")).toEqual({ x: 75, y: 170 });
      expect(calculateOperatorPosition(170, second, third, "ttb")).toEqual({ x: 175, y: 170 });
    });
  });
});
