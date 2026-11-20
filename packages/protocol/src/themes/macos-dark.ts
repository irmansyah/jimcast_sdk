import type { ThemeContext } from "./theme.js";

export const macosDarkTheme: ThemeContext = {
  mode: "dark",
  colors: {
    bg:           "#1e1e1e",  // window background
    bg1:          "#161618",  // sidebar / deeper background
    bg2:          "#2c2c2e",  // elevated surfaces
    bg3:          "#3a3a3c",  // separators, borders
    bg4:          "#48484a",  // disabled elements
    fg:           "#f5f5f7",  // primary label
    fg2:          "#d1d1d6",  // secondary label
    fg3:          "#aeaeb2",  // tertiary label
    fg4:          "#8e8e93",  // quaternary / placeholder
    red:          "#ff453a",
    brightRed:    "#ff6961",
    green:        "#30d158",
    brightGreen:  "#4be36f",
    yellow:       "#ffd60a",
    brightYellow: "#ffe14d",
    blue:         "#0a84ff",
    brightBlue:   "#409cff",
    purple:       "#bf5af2",
    brightPurple: "#da8fff",
    aqua:         "#64d2ff",
    brightAqua:   "#70d7ff",
    orange:       "#ff9f0a",
    brightOrange: "#ffb340",
  },
  typography: {
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
    xs: 11, sm: 12, md: 13, lg: 15, xl: 17,
  },
  spacing: {
    radiusSm: 4, radiusMd: 8, radiusLg: 12,
    gapSm: 4,   gapMd: 8,    gapLg: 16,
  },
};
