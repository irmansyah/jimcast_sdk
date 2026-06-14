import { gruvboxDark  } from './default'
import { gruvboxLight } from './gruvbox-light'
import { tokyoNight   } from './tokyo-night'
import { catppuccin   } from './catppuccin'
import { nord         } from './nord'

export type Theme = typeof gruvboxDark

// all built-in themes keyed by the name used in theme.toml
export const THEMES: Record<string, Theme> = {
  'gruvbox-dark':  gruvboxDark,
  'gruvbox-light': gruvboxLight,
  'tokyo-night':   tokyoNight,
  'catppuccin':    catppuccin,
  'nord':          nord,
}

export const DEFAULT_THEME = gruvboxDark
