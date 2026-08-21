import type { ThemeContext } from "./theme.js";

export const defaultTheme: ThemeContext = {
  mode: "dark",
  colors: {
    bg:           "#1a1b26",
    bg1:          "#16161e",
    bg2:          "#2f3549",
    bg3:          "#343b58",
    bg4:          "#3b4261",
    fg:           "#c0caf5",
    fg2:          "#a9b1d6",
    fg3:          "#9aa5ce",
    fg4:          "#787c99",
    red:          "#f7768e",
    brightRed:    "#ff9e64",
    green:        "#9ece6a",
    brightGreen:  "#73daca",
    yellow:       "#e0af68",
    brightYellow: "#ff9e64",
    blue:         "#7aa2f7",
    brightBlue:   "#2ac3de",
    purple:       "#bb9af7",
    brightPurple: "#9d7cd8",
    aqua:         "#7dcfff",
    brightAqua:   "#2ac3de",
    orange:       "#ff9e64",
    brightOrange: "#e0af68",
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
