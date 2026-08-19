import type { ThemeContext } from "./theme.js";

export const gruvboxDarkTheme: ThemeContext = {
  mode: "dark",
  colors: {
    bg:           "#1d2021",
    bg1:          "#282828",
    bg2:          "#3c3836",
    bg3:          "#504945",
    bg4:          "#665c54",
    fg:           "#ebdbb2",
    fg2:          "#d5c4a1",
    fg3:          "#bdae93",
    fg4:          "#a89984",
    red:          "#cc241d",
    brightRed:    "#fb4934",
    green:        "#98971a",
    brightGreen:  "#b8bb26",
    yellow:       "#d79921",
    brightYellow: "#fabd2f",
    blue:         "#458588",
    brightBlue:   "#83a598",
    purple:       "#b16286",
    brightPurple: "#d3869b",
    aqua:         "#689d6a",
    brightAqua:   "#8ec07c",
    orange:       "#d65d0e",
    brightOrange: "#fe8019",
  },
  typography: {
    family: '"JetBrains Mono", "FiraCode Nerd Font", "Fira Code", monospace',
    xs: 13, sm: 14, md: 17, lg: 20, xl: 22,
  },
  spacing: {
    radiusSm: 2, radiusMd: 4, radiusLg: 8,
    gapSm: 4,   gapMd: 8,   gapLg: 16,
  },
};
