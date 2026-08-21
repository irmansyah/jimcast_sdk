// [sdk] packages/sdk/src/themes/theme.ts
// Moved to @jimcast/protocol so @jimcast/react-sdk can share the same
// theme types instead of growing an independent copy — see
// packages/protocol/src/themes/theme.ts for the actual implementation.
// Re-exported here so context.ts's `./themes/theme.js` import (and any
// plugin author importing @jimcast/sdk's theme types) keeps working
// unchanged.
export type { ThemeColors, ThemeTypography, ThemeSpacing, ThemeContext } from '@jimcast/protocol'
export { fv, cv, px } from '@jimcast/protocol'
