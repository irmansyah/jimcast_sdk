// [sdk] packages/sdk/src/themes/index.ts
// Moved to @jimcast/protocol so @jimcast/react-sdk can share the same
// theme definitions instead of growing an independent copy — see
// packages/protocol/src/themes/index.ts for the actual implementation.
// Re-exported here so rpc.ts's `./themes/index.js` import (and any plugin
// author importing @jimcast/sdk's theme exports) keeps working unchanged.
export {
  defaultTheme,
  macosDarkTheme,
  macosLightTheme,
  gruvboxDarkTheme,
  gruvboxLightTheme,
  catppuccinTheme,
  nordTheme,
  tokyoNightTheme,
  resolveTheme,
  type ThemeName,
} from '@jimcast/protocol'
