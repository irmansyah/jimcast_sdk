# README.md

# @jimcast/sdk
TODO

# @jimcast/react-sdk

Client/server SDK for building **webview plugins** for [jimcast-core](../../../jimcast-core) —
the transport layer between a sandboxed plugin iframe/webview and the host
app, plus an optional Node-side backend process for plugins that need to
talk to the host (shell exec, storage, toasts, clipboard, etc).

This package is split into four independent entry points so that importing
one never pulls in code the other side doesn't need:

| Entry point | Runs in | Pulls in React? | Pulls in Node? |
|---|---|---|---|
| `@jimcast/react-sdk/client` | plugin webview (browser) | no | no |
| `@jimcast/react-sdk/react` | plugin webview (browser) | **yes** (peer dep) | no |
| `@jimcast/react-sdk/server` | plugin backend process | no | **yes** |
| `@jimcast/react-sdk/protocol` | either | no | no |

A plugin with no React UI at all only imports `/server`. A plugin with a UI
but no host communication only imports `/client` (and `/react` if it wants
the nav hook). Most plugins use `/client` + `/react` in the browser bundle,
and `/server` in a tiny backend stub.

If you're building a **command-only plugin with no UI at all**, you don't
need this package — use [`@jimcast/sdk`](../sdk) directly instead, which
covers the full command-bar + widget registration surface.

---

## How a webview plugin fits into jimcast-core

```
~/.jimcast/plugins/<your-plugin>/
├── package.json          ← the plugin manifest (see below — there's no separate manifest.json)
├── dist/                 ← built React app, served as jimcast-plugin://<your-plugin>/dist/index.html
└── dist-backend/         ← (optional) built Node backend process, execed via package.json's "main"
```

`jimcast-core` reads `package.json` directly as the plugin manifest:

```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "main": "dist-backend/backend.js",
  "jimcast": {
    "capabilities": []
  }
}
```

- `main` — the Node entry point `jimcast-core` execs as your plugin's backend
  process. If your plugin needs zero host communication, you still need a
  minimal stub here (see [No backend needed?](#no-backend-needed) below) —
  `jimcast-core` currently spawns a backend process for every installed
  plugin regardless of whether it actually talks to the host.
- `jimcast.capabilities` — declared permissions your backend process needs
  (filesystem, shell, etc). Leave empty if you're only using the stub.

Your plugin also needs a `kind: "webview"` entry in the user's
`~/.jimcast/config.json` under `quick_tools`, pointing at your built HTML
entry:

```json
{
  "id": "your-plugin",
  "label": "Your Plugin",
  "kind": "webview",
  "entry": "dist/index.html"
}
```

---

## Tutorial: adding a fresh React project to jimcast

This walks through taking a brand-new Vite + React app and turning it into
an installable jimcast plugin, end to end.

### 1. Scaffold the project

```bash
cd jimcast-plugins/
npm create vite@latest your-plugin -- --template react-ts
cd your-plugin
```

### 2. Install dependencies

```bash
pnpm add @jimcast/react-sdk
pnpm add -D esbuild
```

While `jimcast-sdk` isn't published to a registry yet, point at your local
checkout instead of a version range:

```json
// package.json
"dependencies": {
  "@jimcast/react-sdk": "file:../../jimcast-sdk/packages/react-sdk"
}
```

Adjust the relative path to wherever `jimcast-sdk` actually sits relative
to your plugin. After editing this by hand, run `pnpm install` to pick it
up.

> **Note:** `file:` links behave differently between package managers —
> `pnpm` symlinks (so rebuilding `react-sdk` is picked up immediately),
> `npm` copies (so you'd need to reinstall after every `react-sdk`
> change). Use `pnpm` consistently across your plugin and the SDK repo to
> avoid `node_modules` cross-contamination.

### 3. Add the manifest fields to `package.json`

```json
{
  "name": "your-plugin",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "main": "dist-backend/backend.js",
  "jimcast": {
    "capabilities": []
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && node esbuild.backend.js",
    "preview": "vite preview"
  }
}
```

### 4. Set `base: './'` in `vite.config.ts`

Plugin webviews are served from a custom `jimcast-plugin://` scheme, not
from a root-relative URL — root-absolute asset paths (`/assets/...`) will
404. Use relative paths instead:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
})
```

### 5. Add the backend stub

Every installed plugin needs *something* runnable at `main`, even if it
never talks to the host. Create `src/backend.ts`:

```ts
// src/backend.ts
import { defineWebviewBackend } from '@jimcast/react-sdk/server'

defineWebviewBackend({})
```

`defineWebviewBackend` (not `definePlugin` — that name is reserved by
`@jimcast/sdk` for the full command-bar plugin manifest, to avoid
collisions when both packages are imported in the same file tree) starts a
`stdin` listener and dispatches any commands you register in the object
you pass it. An empty object means "accept no commands" — the process just
stays alive, satisfying `main` without doing anything.

If your plugin *does* need to talk to the host (run shell commands, use
plugin storage, show toasts), register handlers here instead:

```ts
import { defineWebviewBackend } from '@jimcast/react-sdk/server'

defineWebviewBackend({
  async doSomething(args) {
    // args is whatever the webview sent via callHost('doSomething', {...})
    return { ok: true }
  },
})
```

### 6. Bundle the backend with esbuild

`vite build` only builds the browser-side React app — the backend needs
its own bundling step, since it targets Node, not the browser.

```js
// esbuild.backend.js
import { build } from 'esbuild'

await build({
  entryPoints: ['src/backend.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist-backend/backend.js',
  packages: 'bundle',
})

console.log('your-plugin: built backend.js')
```

`format: 'esm'` matches `"type": "module"` in `package.json` — if your
plugin's `package.json` doesn't set `"type": "module"`, switch this to
`'cjs'` instead. `packages: 'bundle'` inlines `@jimcast/react-sdk` into the
output so the shipped plugin doesn't depend on `node_modules` being
present alongside it at runtime — drop this option if you'd rather keep
dependencies external.

### 7. Wire up the React side

In your app's entry component, use the client + React bindings to talk to
the host:

```tsx
// src/App.tsx
import { useHostNav } from '@jimcast/react-sdk/react'
import { reportFocusedItem, reportDragStarted } from '@jimcast/react-sdk/client'

export default function App() {
  useHostNav({
    onArrow: (dir) => {
      // handle ArrowUp/ArrowDown/ArrowLeft/ArrowRight sent from the host
    },
    onActivate: () => {
      // handle host-driven "activate" (e.g. Enter key)
    },
  })

  // ...your app
}
```

`useHostNav` subscribes to keyboard navigation events the host forwards
into your iframe — useful if your plugin wants to participate in
jimcast-core's keyboard-driven navigation rather than only handling its
own local key listeners.

If your app already owns its own complete keyboard model (its own
arrow-key handling, its own Escape behavior, a `:command` bar, etc.), you
may not need `useHostNav` at all — just be aware the host has its own
Escape-layer stack (`pushEscapeLayer` et al.) that expects embedded
plugins to cooperate on dismiss/collapse behavior. Test Escape behavior
specifically once embedded, since a plugin with entirely self-contained
key handling can end up double-handling or silently swallowing keys the
host expected to receive.

### 8. Build

```bash
pnpm build
```

This runs, in order: `tsc -b` (typecheck), `vite build` (produces `dist/`),
`node esbuild.backend.js` (produces `dist-backend/backend.js`). Confirm
both output directories exist afterward:

```bash
ls dist/ dist-backend/
```

### 9. Install into jimcast-core

Your dev checkout isn't automatically visible to `jimcast-core` — it reads
installed plugins from `~/.jimcast/plugins/<name>/`, a separate location
from wherever you're developing. Use `jimcast-core`'s sync script:

```bash
cd jimcast-core
./scripts/sync-plugin.sh your-plugin
```

This builds your plugin, then copies `dist/`, `dist-backend/`, and
`package.json` into `~/.jimcast/plugins/your-plugin/`. Re-run it after
every change you want reflected in the running app.

### 10. Register it as a panel

Add a `webview` panel to a slot in `~/.jimcast/config.json` (or a profile's `section_slot`):

```json
{
  "widget_slot": {
    "below-input": [
      { "id": "your-plugin", "label": "Your Plugin", "kind": "webview", "entry": "dist/index.html" }
    ]
  }
}
```

A toggle panel (the default) works in `below-input` and `inside-scroll`. Add `"display": "inline"` to render it in place in any slot, though inline webviews don't receive arrow-key navigation. The plugin is the part of the id before the first `.`, so `your-plugin.docs` and `your-plugin.board` can be two panels backed by one plugin. To get a row of buttons, wrap panels in `{ "kind": "group", "id": "tools", "panels": [...] }`.

Restart (or reload) jimcast-core, and your plugin should appear as a quick
tool, rendering `dist/index.html` inside a sandboxed iframe.

---

## No backend needed?

If your plugin is purely client-side (no `fetch` to the host, no shell
exec, no plugin storage — e.g. it only calls external APIs directly from
the browser, like a REST client), you still currently need the minimal
`defineWebviewBackend({})` stub described in step 5, because
`jimcast-core` spawns a backend process for every installed plugin
regardless of whether `main` does anything meaningful. Future versions of
jimcast-core may make the backend process optional for webview-only
plugins — check the changelog before assuming this requirement has been
relaxed.

---

## API reference

### `@jimcast/react-sdk/client`

Runs inside the plugin iframe. Zero Node imports — safe to import from any
browser bundle.

- `callHost<T>(command: string, args?: Record<string, unknown>): Promise<T>`
  — call a command implemented on the host side.
- `onHostNav(handler: (payload: NavPayload) => void): () => void` —
  subscribe to host-driven keyboard nav; returns an unsubscribe function.
- `reportFocusedItem(info: FocusedItemInfo | null): void` — fire-and-forget,
  tell the host which item is currently focused/hovered (and its rect).
- `reportDragStarted(paths: string[], rect: IframeLocalRect): void` —
  fire-and-forget, tell the host a native file drag has started.

### `@jimcast/react-sdk/react`

Thin React binding over `/client`. Only import this if your plugin uses
React — importing `/client` or `/server` alone never pulls React in.

- `useHostNav(handlers: HostNavHandlers | null): void` — subscribes to
  host nav for the component's lifetime; pass `null` to temporarily
  disable without unmounting.

### `@jimcast/react-sdk/server`

Runs in the plugin's backend Node process (execed via `package.json`'s
`main`). Owns the single `stdin` reader for the process.

- `defineWebviewBackend(handlers: WebviewBackendDefinition): void` —
  registers this process as a jimcast-core plugin backend and starts
  reading `stdin`. Call once, at your entry file's top level.
- `callHost<T>(command: string, args?: Record<string, unknown>): Promise<T>`
  — call a host-side primitive (e.g. `storage_get`, `ui_show_toast`) from
  within the backend process.

### `@jimcast/react-sdk/protocol`

Re-exports `@jimcast/protocol` — the shared wire-format types
(`IpcRequest`, `IpcResponse`, `IpcNotification`, `isRequest`, `isResponse`)
used by both transports. Mirrors `domain::plugin::protocol.rs` on the Rust
side field-for-field; kept in sync manually, there's no codegen link.

---

## Troubleshooting

**`Cannot find module '@jimcast/react-sdk/server'` / missing type
declarations** — usually means `react-sdk`'s own build hasn't run, or its
`exports` map in `package.json` points at a `.d.ts` path that doesn't
match where `tsc` actually emitted it (TypeScript mirrors your `src/`
folder structure into `dist/` by default — a subdirectory entry point like
`src/server/index.ts` emits to `dist/server/index.d.ts`, not
`dist/server.d.ts`). Run `pnpm build` inside `jimcast-sdk/packages/react-sdk`
and confirm the `.d.ts` files actually exist at the paths `exports` claims.

**`<plugin> not found: No such file or directory`** when loading in
jimcast-core — your dev build was never synced into
`~/.jimcast/plugins/<name>/`. Run `./scripts/sync-plugin.sh <name>` from
`jimcast-core`.

**Peer dependency conflicts with `vite`/`@vitejs/plugin-react`** — run
`pnpm peers check` after changing either version; npm fails loudly on
this, pnpm installs anyway and only warns, which can leave you on a
combination that doesn't actually work at runtime.

## License

MIT — © Jimcast
