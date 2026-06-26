/**
 * Theme helpers for plugin authors.
 *
 * These mirror the core `fs()` / `fv()` utilities so plugins can reference
 * the same CSS variables that the host injects via `applyTheme()`.
 *
 * Plugins never call `applyTheme()` directly — the host owns the :root.
 * These helpers are for constructing style values that reference host tokens.
 *
 * @example
 * ```typescript
 * import { fv, fs } from "@jimcast/sdk";
 *
 * // preferred — references the CSS var the host injected
 * el.style.fontSize = fv("md");          // "var(--fs-md)"
 * el.style.fontFamily = fv("family");    // "var(--font-family)"
 *
 * // escape hatch — resolves to a concrete px string
 * el.style.fontSize = fs(12);            // "17px"  (12 * SCALE, rounded)
 * ```
 */

import type { ThemeTypography } from "./context.js";

/** CSS var reference — preferred over `fs()` in most cases. */
export const fv = (size: keyof ThemeTypography): string =>
  size === "family" ? "var(--font-family)" : `var(--fs-${size})`;

/** CSS color var reference. */
export const cv = (token: string): string => `var(--color-${token})`;

/**
 * Resolves a raw number to a `"Npx"` string.
 * Use only when you need a concrete value (e.g. canvas, SVG attributes).
 * Prefer `fv()` for DOM style properties.
 */
export const px = (n: number): string => `${n}px`;
