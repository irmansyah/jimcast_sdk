import type { ThemeContext } from "../index.js";

export const gruvboxLightTheme: ThemeContext = {
  mode: "light",
  colors: {
    bg:           "#fbf1c7",
    bg1:          "#ebdbb2",
    bg2:          "#d5c4a1",
    bg3:          "#bdae93",
    bg4:          "#a89984",
    fg:           "#3c3836",
    fg2:          "#504945",
    fg3:          "#665c54",
    fg4:          "#7c6f64",
    red:          "#cc241d",
    brightRed:    "#9d0006",
    green:        "#98971a",
    brightGreen:  "#79740e",
    yellow:       "#d79921",
    brightYellow: "#b57614",
    blue:         "#458588",
    brightBlue:   "#076678",
    purple:       "#b16286",
    brightPurple: "#8f3f71",
    aqua:         "#689d6a",
    brightAqua:   "#427b58",
    orange:       "#d65d0e",
    brightOrange: "#af3a03",
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
