import type { ThemeContext } from "./theme.js";

export const macosLightTheme: ThemeContext = {
  mode: "light",
  colors: {
    bg:           "#ffffff",  // window background
    bg1:          "#f5f5f7",  // sidebar / secondary background
    bg2:          "#e8e8ed",  // controls, grouped backgrounds
    bg3:          "#d2d2d7",  // separators, borders
    bg4:          "#aeaeb2",  // disabled elements
    fg:           "#1d1d1f",  // primary label
    fg2:          "#3c3c43",  // secondary label
    fg3:          "#6e6e73",  // tertiary label
    fg4:          "#8e8e93",  // quaternary / placeholder
    red:          "#ff3b30",  // systemRed
    brightRed:    "#ff453a",
    green:        "#34c759",  // systemGreen
    brightGreen:  "#30d158",
    yellow:       "#ffcc00",  // systemYellow
    brightYellow: "#ffd60a",
    blue:         "#007aff",  // systemBlue (default accent)
    brightBlue:   "#0a84ff",
    purple:       "#af52de",  // systemPurple
    brightPurple: "#bf5af2",
    aqua:         "#5ac8fa",  // systemTeal/cyan
    brightAqua:   "#64d2ff",
    orange:       "#ff9500",  // systemOrange
    brightOrange: "#ff9f0a",
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
