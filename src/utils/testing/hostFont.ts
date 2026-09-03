import { readFileSync } from "fs";

/**
 * Font declarations of a component stylesheet's first `:host` block, resolved
 * against a host element the way the browser would: each `var(--x, fallback)`
 * takes `--x` from the host's inline style when it is set, otherwise the
 * fallback.
 *
 * Spec-only. mock-doc has no CSS cascade, so `getComputedStyle(host)` is empty
 * in specs; this is the closest a spec can get to asserting the host's
 * computed font.
 */
export interface HostFont {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
}

const VAR = /var\(\s*(--[\w-]+)\s*,\s*([^)]+)\)/g;

export const resolveHostFont = (stylesheetPath: string, host: HTMLElement): HostFont => {
  const css = readFileSync(stylesheetPath, "utf8");
  const hostBlock = /:host\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  const declaration = (property: string): string | undefined => {
    const match = new RegExp(`(?:^|[;\\n])\\s*${property}\\s*:\\s*([^;]+);`).exec(hostBlock);
    if (!match) return undefined;
    return match[1]
      .replace(VAR, (_, name: string, fallback: string) => host.style.getPropertyValue(name).trim() || fallback.trim())
      .trim();
  };

  return {
    fontFamily: declaration("font-family"),
    fontSize: declaration("font-size"),
    color: declaration("color"),
  };
};
