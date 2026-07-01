import { defaultTheme }      from "./default.js";
import { gruvboxLightTheme } from "./gruvbox-light.js";
import { catppuccinTheme }   from "./catppuccin.js";
import { nordTheme }         from "./nord.js";
import { tokyoNightTheme }   from "./tokyo-night.js";

import type { ThemeContext } from "../context.js";

export {
  defaultTheme,
  gruvboxLightTheme,
  catppuccinTheme,
  nordTheme,
  tokyoNightTheme,
};

export type ThemeName =
  | "gruvbox-dark"
  | "gruvbox-light"
  | "catppuccin"
  | "nord"
  | "tokyo-night";

const themes: Record<ThemeName, ThemeContext> = {
  "gruvbox-dark":  defaultTheme,
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
