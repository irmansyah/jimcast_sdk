// [sdk] packages/react-sdk/esbuild.config.js

// Builds each SDK entry point separately, in both ESM and CJS, so
// consumers can `import` (Vite/webview bundles) or `require` (esbuild
// -bundled Node backends, which most plugin backend.ts builds target)
// without either format leaking the other's assumptions.
//
// "server" and "react" are built with platform: 'node' / default
// respectively deliberately — "server" never touches `window`, "client"
// and "react" never touch `node:readline`. Bundling them together would
// make each half needlessly pull in an unused runtime.
//
// @jimcast/protocol is external across ALL entries (not just 'browser')
// since it's a real dependency now (storage/theme sharing with @jimcast/sdk)
// and consumers already get it resolved via node_modules the same way
// 'react' is — bundling its source in here would defeat the point of
// having one shared implementation instead of a copy per package.
//
// CHANGED: the 'react' entry now also externalizes react-dom (createApp calls
// react-dom/client). NOTE the 'react' entry still inlines a copy of src/client/*
// (useHostBridge -> ../client, createApp -> ../client/theme|storage). That's safe
// only because client/index.ts keeps its mutable state on globalThis — see
// client/index.ts.PATCH.txt. If you ever add module-level state elsewhere in
// src/client, do the same or make the react entry import the client entry externally.
import { build } from 'esbuild'
const entries = [
  { name: 'protocol', entry: 'src/protocol.ts', platform: 'neutral' },
  { name: 'client', entry: 'src/client/index.ts', platform: 'browser' },
  { name: 'server', entry: 'src/server/index.ts', platform: 'node' },
  { name: 'react', entry: 'src/react/index.ts', platform: 'browser' },
]

const browserExternal = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', '@jimcast/protocol']

for (const { name, entry, platform } of entries) {
  const shared = {
    entryPoints: [entry],
    bundle: true,
    platform,
    external: platform === 'browser' ? browserExternal : ['@jimcast/protocol'],
  }
  await build({ ...shared, format: 'esm', outfile: `dist/${name}.mjs` })
  await build({ ...shared, format: 'cjs', outfile: `dist/${name}.cjs` })
}
console.log('jimcast-react-sdk: built client/server/react/protocol in esm+cjs')
