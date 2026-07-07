// ---------------------------------------------------------------------------
// ThemeContext
// ---------------------------------------------------------------------------
export interface ThemeColors {
  readonly bg: string;
  readonly bg1: string;
  readonly bg2: string;
  readonly bg3: string;
  readonly bg4: string;
  readonly fg: string;
  readonly fg2: string;
  readonly fg3: string;
  readonly fg4: string;
  readonly red: string;
  readonly brightRed: string;
  readonly green: string;
  readonly brightGreen: string;
  readonly yellow: string;
  readonly brightYellow: string;
  readonly blue: string;
  readonly brightBlue: string;
  readonly purple: string;
  readonly brightPurple: string;
  readonly aqua: string;
  readonly brightAqua: string;
  readonly orange: string;
  readonly brightOrange: string;
}

export interface ThemeTypography {
  readonly family: string;
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

export interface ThemeSpacing {
  readonly radiusSm: number;
  readonly radiusMd: number;
  readonly radiusLg: number;
  readonly gapSm: number;
  readonly gapMd: number;
  readonly gapLg: number;
}

export interface ThemeContext {
  /** Current color mode. */
  mode: "light" | "dark";
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
}


/** CSS var reference — preferred over `fs()` in most cases. */
export const fv = (size: keyof ThemeTypography): string =>
  size === "family" ? "var(--font-family)" : `var(--fs-${size})`;

/** CSS color var reference. */
export const cv = (token: string): string => `var(--color-${token})`;

export const px = (n: number): string => `${n}px`;
