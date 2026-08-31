// [sdk] packages/protocol/src/search.ts
//
// Shared scoring + result/document shapes for BOTH plugin transports
// (@jimcast/sdk's raw stdio path, @jimcast/react-sdk's webview-backend
// path) and for the host-side Rust index. Single source of truth so
// interactive search and future RAG retrieval score content identically.

// ---------------------------------------------------------------------------
// Weighting — tied to WidgetAttribute's visual hierarchy, not invented
// per-content-type. label1 is always the primary/biggest line a user
// sees; labelRight is always the most de-emphasized. Anything that isn't
// a WidgetAttribute field (e.g. a Document body) maps onto this same
// scale explicitly, see documentFields() below.
// ---------------------------------------------------------------------------

export const FIELD_WEIGHT = {
  label1: 3,
  label2: 2,
  label3: 1.2,
  label4: 1,
  labelRight: 0.5,
  body: 1, // content only visible on open (file preview, expanded card, etc.)
} as const

export interface SearchField {
  text: string
  weight: number
}

/**
 * Scores `query` against a set of weighted fields. Cheap, allocation-light:
 * safe to call on every keystroke for in-memory content. No fuzzy matching —
 * exact > prefix > substring, each tier scaled by field weight.
 */
export function scoreFields(query: string, fields: SearchField[]): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  let score = 0
  for (const { text, weight } of fields) {
    if (!text) continue
    const t = text.toLowerCase()
    if (t === q) score += weight * 10
    else if (t.startsWith(q)) score += weight * 5
    else if (t.includes(q)) score += weight * 2
  }
  return score
}

// ---------------------------------------------------------------------------
// WidgetAttribute field extraction — covers every visible label a widget
// item renders, at its natural on-screen prominence.
// ---------------------------------------------------------------------------

/** Minimal shape — avoids importing the full WidgetAttribute type here and
 *  creating a protocol -> sdk dependency in the wrong direction. */
export interface AttributeLike {
  label1?: string
  label2?: string
  label3?: string
  label4?: string
  labelRight?: string
}

export function attributeFields(attr: AttributeLike | undefined): SearchField[] {
  if (!attr) return []
  return [
    { text: attr.label1 ?? '', weight: FIELD_WEIGHT.label1 },
    { text: attr.label2 ?? '', weight: FIELD_WEIGHT.label2 },
    { text: attr.label3 ?? '', weight: FIELD_WEIGHT.label3 },
    { text: attr.label4 ?? '', weight: FIELD_WEIGHT.label4 },
    { text: attr.labelRight ?? '', weight: FIELD_WEIGHT.labelRight },
  ]
}

// ---------------------------------------------------------------------------
// Interactive search result — capped, disposable, sent per keystroke.
// ---------------------------------------------------------------------------

export interface SearchResultAction {
  type: 'invoke-command'
  command: string
  args?: Record<string, unknown>
}

export interface SearchResultItem {
  id: string
  title: string
  subtitle?: string
  score: number
  action: SearchResultAction
}

// ---------------------------------------------------------------------------
// Document — durable RAG-index unit. Not capped, not query-scoped.
// title/body map onto the same weight scale as WidgetAttribute so a
// single documentFields() helper scores both consistently.
// ---------------------------------------------------------------------------

export interface DocumentAction {
  commandId: string
  label: string
}

export interface Document {
  id: string
  kind: string
  title: string
  body: string
  metadata?: Record<string, unknown>
  actions?: DocumentAction[]
  updatedAt: number
}

export function documentFields(doc: Pick<Document, 'title' | 'body'>): SearchField[] {
  return [
    { text: doc.title, weight: FIELD_WEIGHT.label1 },
    { text: doc.body, weight: FIELD_WEIGHT.body },
  ]
}
