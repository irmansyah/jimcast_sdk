// Builds each SDK entry point separately, in both ESM and CJS, so
// consumers can `import` (Vite/webview bundles) or `require` (esbuild
// -bundled Node backends, which most plugin backend.ts builds target)
// without either format leaking the other's assumptions.
//
// "server" and "react" are built with platform: 'node' / default
// respectively deliberately — "server" never touches `window`, "client"
// and "react" never touch `node:readline`. Bundling them together would
// make each half needlessly pull in an unused runtime.
import { build } from 'esbuild'

const entries = [
  { name: 'protocol', entry: 'src/protocol.ts', platform: 'neutral' },
  { name: 'client', entry: 'src/client/index.ts', platform: 'browser' },
  { name: 'server', entry: 'src/server/index.ts', platform: 'node' },
  { name: 'react', entry: 'src/react/useHostBridge.ts', platform: 'browser' },
]

for (const { name, entry, platform } of entries) {
  const shared = {
    entryPoints: [entry],
    bundle: true,
    platform,
    external: platform === 'browser' ? ['react'] : [],
  }
  await build({ ...shared, format: 'esm', outfile: `dist/${name}.mjs` })
  await build({ ...shared, format: 'cjs', outfile: `dist/${name}.cjs` })
}

console.log('jimcast-react-sdk: built client/server/react/protocol in esm+cjs')
