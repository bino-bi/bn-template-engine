export type ScalingMode = "empty" | "none" | "auto" | "factor";

export interface ScalingConfig {
  mode: ScalingMode;
  factor?: number;
}

export function parseScaling(scale: string | undefined): ScalingConfig {
  if (scale == null || scale === "") return { mode: "empty" };
  if (scale === "none") return { mode: "none" };
  if (scale === "auto") return { mode: "auto" };
  const num = Number(scale);
  if (!isNaN(num) && num > 0) return { mode: "factor", factor: num };
  return { mode: "empty" };
}
