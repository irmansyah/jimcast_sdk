// [sdk] packages/protocol/src/themes/index.ts

import { defaultTheme }      from "./default.js";
import { macosDarkTheme }    from "./macos-dark.js";
import { macosLightTheme }   from "./macos-light.js";
import { gruvboxDarkTheme }  from "./gruvbox-dark.js";
import { gruvboxLightTheme } from "./gruvbox-light.js";
import { catppuccinTheme }   from "./catppuccin.js";
import { nordTheme }         from "./nord.js";
import { tokyoNightTheme }   from "./tokyo-night.js";
import type { ThemeContext } from "./theme.js";

export {
  defaultTheme,
  macosDarkTheme,
  macosLightTheme,
  gruvboxDarkTheme,
  gruvboxLightTheme,
  catppuccinTheme,
  nordTheme,
  tokyoNightTheme,
};

export type ThemeName =
  | "default"
  | "macos-dark"
  | "macos-light"
  | "gruvbox-dark"
  | "gruvbox-light"
  | "catppuccin"
  | "nord"
  | "tokyo-night";

const themes: Record<ThemeName, ThemeContext> = {
  "default":       defaultTheme,
  "macos-dark":    macosDarkTheme,
  "macos-light":   macosLightTheme,
  "gruvbox-dark":  gruvboxDarkTheme,
  "gruvbox-light": gruvboxLightTheme,
  "catppuccin":    catppuccinTheme,
  "nord":          nordTheme,
  "tokyo-night":   tokyoNightTheme,
};

export function resolveTheme(name: string | undefined): ThemeContext {
  if (name && name in themes) {
    return themes[name as ThemeName];
  }
  if (name) {
    console.warn(`[jimcast-sdk] unknown theme "${name}", falling back to gruvbox-dark`);
  }
  return defaultTheme;
}

export type { ThemeContext, ThemeColors, ThemeTypography, ThemeSpacing } from "./theme.js";
