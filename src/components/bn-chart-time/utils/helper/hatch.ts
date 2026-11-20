import { G, Pattern, Svg } from "@svgdotjs/svg.js";

/** A hatching in `color` on `background`, defined once per chart and colour. Null for a group that is not in a chart yet. */
export function hatchPattern(group: G, color: string, background: string): Pattern | null {
  const root = group.root() as Svg | null;
  if (!root) return null;
  const id = `pattern-hatch-${color}-${background}`.replace(/[^a-zA-Z0-9-]/g, "");
  const existing = root.findOne(`#${id}`) as Pattern | null;
  if (existing) return existing;
  return root
    .pattern(10, 10, (add) => {
      add.rect(10, 10).fill(background);
      add.line(0, 5, 5, 0).stroke({ width: 1, color, linecap: "square" });
      add.line(5, 10, 10, 5).stroke({ width: 1, color, linecap: "square" });
    })
    .id(id);
}
