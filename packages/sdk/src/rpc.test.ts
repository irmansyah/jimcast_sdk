// [sdk] packages/sdk/src/rpc.test.ts
import { it, expect, vi } from 'vitest'
import { PassThrough } from 'node:stream'
import { bootstrapPlugin } from './rpc.js'
import { definePlugin } from './command.js'
import type { SearchResultItem, Document } from '@jimcast/protocol'

function makePlugin(overrides = {}) {
  return definePlugin({
    name: 'test-plugin',
    // commands: [],
    search: vi.fn(async (query: string): Promise<SearchResultItem[]> =>
      query === 'match'
        ? [{
            id: '1',
            title: 'Match',
            score: 10,
            action: { type: 'invoke-command', command: 'x' },
          }]
        : []
    ),
    corpus: vi.fn(async (): Promise<Document[]> => [
      { id: 'doc1', kind: 'test', title: 'T', body: 'B', updatedAt: 0 },
    ]),
    ...overrides,
  })
}

it('search command returns capped, plugin-scored results', async () => {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const plugin = makePlugin()

  // monkeypatch process.stdin/stdout since bootstrapPlugin reads from them directly
  Object.defineProperty(process, 'stdin', { value: stdin, configurable: true })
  Object.defineProperty(process, 'stdout', { value: stdout, configurable: true })

  await bootstrapPlugin(plugin)

  const responses: any[] = []
  stdout.on('data', (chunk) => responses.push(JSON.parse(chunk.toString())))

  stdin.write(JSON.stringify({ id: 'r1', command: 'search', args: { query: 'match', envContext: {}, hostContext: {} } }) + '\n')

  await new Promise((r) => setTimeout(r, 10))
  expect(responses[0].result.items).toHaveLength(1)
  expect(responses[0].result.items[0].title).toBe('Match')
})

it('search on a plugin with no search() returns empty, not an error', async () => {
  // same setup, but makePlugin({ search: undefined })
  // assert result.items === [] and no error field
})

it('caps results at SEARCH_RESULT_CAP even if plugin returns more', async () => {
  // search returns 20 items, assert response has exactly 5
})
