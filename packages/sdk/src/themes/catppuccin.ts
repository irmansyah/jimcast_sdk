import type { ThemeContext } from "./theme.js";

export const catppuccinTheme: ThemeContext = {
  mode: "dark",
  colors: {
    bg:           "#1e1e2e",
    bg1:          "#181825",
    bg2:          "#313244",
    bg3:          "#45475a",
    bg4:          "#585b70",
    fg:           "#cdd6f4",
    fg2:          "#bac2de",
    fg3:          "#a6adc8",
    fg4:          "#9399b2",
    red:          "#f38ba8",
    brightRed:    "#eba0ac",
    green:        "#a6e3a1",
    brightGreen:  "#94e2d5",
    yellow:       "#f9e2af",
    brightYellow: "#fab387",
    blue:         "#89b4fa",
    brightBlue:   "#74c7ec",
    purple:       "#cba6f7",
    brightPurple: "#f5c2e7",
    aqua:         "#94e2d5",
    brightAqua:   "#89dceb",
    orange:       "#fab387",
    brightOrange: "#f9e2af",
  },
  typography: {
    family: '"JetBrains Mono", "FiraCode Nerd Font", "Fira Code", monospace',
    xs: 13, sm: 14, md: 17, lg: 20, xl: 22,
  },
  spacing: {
    radiusSm: 4, radiusMd: 8, radiusLg: 12,
    gapSm: 4,   gapMd: 8,    gapLg: 16,
  },
};
