// [sdk] packages/protocol/src/sectionLabel.ts

// Section label styles as plain data. Colours are NOT part of a style; they
// come from the section colour cycle, so a style works with any theme.

export type SectionLabelAccent = 'bar' | 'dot' | 'none'
export type SectionLabelBorder = 'top-bottom' | 'bottom' | 'box' | 'none'

export interface SectionLabelStyle {
  accent:            SectionLabelAccent
  barWidth:          number   // px, inactive (bar) / dot size
  barWidthActive:    number   // px, active
  barOpacity:        number   // 0..1, inactive
  border:            SectionLabelBorder
  borderWidth:       number   // px, inactive
  borderWidthActive: number   // px, active
  background:        'tint' | 'none'
  uppercase:         boolean
  letterSpacing:     number   // em
  fontWeight:        number
  fontWeightActive:  number
  rounded:           boolean  // uses the host's --radius
  padX:              number   // px
  padY:              number   // px
  showCount:         boolean
}

export type SectionLabelStyleName = 'bar' | 'underline' | 'pill' | 'boxed' | 'minimal'

const bar: SectionLabelStyle = {
  accent: 'bar', barWidth: 4, barWidthActive: 12, barOpacity: 0.5,
  border: 'top-bottom', borderWidth: 1, borderWidthActive: 2,
  background: 'tint', uppercase: true, letterSpacing: 0.09,
  fontWeight: 500, fontWeightActive: 600, rounded: false,
  padX: 12, padY: 7, showCount: true,
}

export const BUILTIN_SECTION_LABEL_STYLES: Readonly<Record<SectionLabelStyleName, SectionLabelStyle>> = {
  bar,
  underline: { ...bar, accent: 'none', border: 'bottom', background: 'none' },
  pill:      { ...bar, accent: 'dot', barWidth: 6, barWidthActive: 8, barOpacity: 0.6,
               border: 'none', rounded: true, padX: 10 },
  boxed:     { ...bar, accent: 'none', border: 'box', rounded: true },
  minimal:   { ...bar, accent: 'none', border: 'none', background: 'none',
               uppercase: false, letterSpacing: 0, fontWeight: 500, fontWeightActive: 600 },
}

export const DEFAULT_SECTION_LABEL_STYLE: SectionLabelStyleName = 'bar'

// ── validation ──────────────────────────────────────────────────────────────

const ENUMS = {
  accent:     ['bar', 'dot', 'none'],
  border:     ['top-bottom', 'bottom', 'box', 'none'],
  background: ['tint', 'none'],
} as const

const NUMBERS = [
  'barWidth', 'barWidthActive', 'barOpacity', 'borderWidth', 'borderWidthActive',
  'letterSpacing', 'fontWeight', 'fontWeightActive', 'padX', 'padY',
] as const
const BOOLEANS = ['uppercase', 'rounded', 'showCount'] as const

/** Applies the valid fields of `raw` over `base`; invalid fields are ignored. */
function overlay(base: SectionLabelStyle, raw: Record<string, unknown>): SectionLabelStyle {
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(ENUMS) as (keyof typeof ENUMS)[]) {
    const v = raw[k]
    if (typeof v === 'string' && (ENUMS[k] as readonly string[]).includes(v)) out[k] = v
  }
  for (const k of NUMBERS) {
    const v = raw[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
  }
  for (const k of BOOLEANS) if (typeof raw[k] === 'boolean') out[k] = raw[k]
  return out as unknown as SectionLabelStyle
}

/**
 * Built-ins plus the user's custom styles. A custom entry may set `extends`
 * to a built-in or earlier custom name (default 'bar') and override any
 * fields. A custom entry with a built-in's name replaces it.
 *
 *   { "compact": { "extends": "underline", "padY": 3, "uppercase": false } }
 */
export function buildSectionLabelStyles(custom: unknown): Record<string, SectionLabelStyle> {
  const all: Record<string, SectionLabelStyle> = { ...BUILTIN_SECTION_LABEL_STYLES }
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return all
  for (const [name, spec] of Object.entries(custom as Record<string, unknown>)) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue
    const s = spec as Record<string, unknown>
    const parent =
      (typeof s.extends === 'string' ? all[s.extends] : undefined) ??
      BUILTIN_SECTION_LABEL_STYLES[DEFAULT_SECTION_LABEL_STYLE]
    all[name] = overlay(parent, s)
  }
  return all
}
