// [sdk] packages/protocol/src/search.test.ts
import { describe, it, expect } from 'vitest'
import { scoreFields, attributeFields, documentFields, FIELD_WEIGHT } from './search.js'

describe('scoreFields', () => {
  it('scores exact match highest', () => {
    const exact = scoreFields('milk', [{ text: 'milk', weight: 3 }])
    const prefix = scoreFields('mil', [{ text: 'milk', weight: 3 }])
    const substring = scoreFields('ilk', [{ text: 'milk', weight: 3 }])
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substring)
  })

  it('weights higher-priority fields higher for the same match tier', () => {
    const titleHit = scoreFields('x', [{ text: 'x', weight: FIELD_WEIGHT.label1 }])
    const badgeHit = scoreFields('x', [{ text: 'x', weight: FIELD_WEIGHT.labelRight }])
    expect(titleHit).toBeGreaterThan(badgeHit)
  })

  it('returns 0 for empty query', () => {
    expect(scoreFields('', [{ text: 'anything', weight: 3 }])).toBe(0)
  })

  it('returns 0 when nothing matches', () => {
    expect(scoreFields('zzz', [{ text: 'milk', weight: 3 }])).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(scoreFields('MILK', [{ text: 'milk', weight: 3 }])).toBeGreaterThan(0)
  })
})

describe('attributeFields', () => {
  it('maps label1-4 and labelRight to descending weights', () => {
    const fields = attributeFields({ label1: 'a', label2: 'b', labelRight: 'c' })
    expect(fields.find(f => f.text === 'a')!.weight).toBeGreaterThan(fields.find(f => f.text === 'b')!.weight)
    expect(fields.find(f => f.text === 'b')!.weight).toBeGreaterThan(fields.find(f => f.text === 'c')!.weight)
  })

  it('handles undefined attribute', () => {
    expect(attributeFields(undefined)).toEqual([])
  })
})

describe('documentFields', () => {
  it('weights title above body', () => {
    const fields = documentFields({ title: 'x', body: 'x' })
    const titleField = fields.find(f => f.weight === FIELD_WEIGHT.label1)!
    const bodyField = fields.find(f => f.weight === FIELD_WEIGHT.body)!
    expect(titleField.weight).toBeGreaterThan(bodyField.weight)
  })
})
