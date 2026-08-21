import type { ThemeContext } from "./theme.js";

export const nordTheme: ThemeContext = {
  mode: "dark",
  colors: {
    bg:           "#2e3440",
    bg1:          "#3b4252",
    bg2:          "#434c5e",
    bg3:          "#4c566a",
    bg4:          "#616e88",
    fg:           "#eceff4",
    fg2:          "#e5e9f0",
    fg3:          "#d8dee9",
    fg4:          "#adb5c4",
    red:          "#bf616a",
    brightRed:    "#d08770",
    green:        "#a3be8c",
    brightGreen:  "#8fbcbb",
    yellow:       "#ebcb8b",
    brightYellow: "#d08770",
    blue:         "#5e81ac",
    brightBlue:   "#81a1c1",
    purple:       "#b48ead",
    brightPurple: "#c695c6",
    aqua:         "#88c0d0",
    brightAqua:   "#8fbcbb",
    orange:       "#d08770",
    brightOrange: "#ebcb8b",
  },
  typography: {
    family: '"JetBrains Mono", "FiraCode Nerd Font", "Fira Code", monospace',
    xs: 13, sm: 14, md: 17, lg: 20, xl: 22,
  },
  spacing: {
    radiusSm: 4, radiusMd: 6, radiusLg: 10,
    gapSm: 4,   gapMd: 8,    gapLg: 16,
  },
};
