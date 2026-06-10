# Jimcast SDK

The official SDK for building [Jimcast](https://jimcast.dev) plugins.

## What is this?

`@jimcast/sdk` is the contract between the Jimcast core engine and the plugin ecosystem. It defines everything a plugin can do — and nothing else. Plugin authors read the TypeScript types; the types are the documentation.

## Quick start

```bash
npx jimcast create-plugin my-plugin
cd my-plugin
npm install
npm run dev
```

## Writing a plugin

Every plugin is a TypeScript file that default-exports a plugin definition:

```typescript
import { definePlugin, createCommand } from "@jimcast/sdk";

export default definePlugin({
  name: "My Plugin",
  description: "Does something useful",
  commands: [
    createCommand({
      id: "my-plugin.do-thing",
      title: "Do the Thing",
      async execute(context) {
        const result = await context.exec("echo hello");
        await context.showToast(result.stdout.trim(), { style: "success" });
      },
    }),
  ],
});
```

## API

See [`docs/api-reference.md`](./docs/api-reference.md) for the full API reference.

## Architecture

Jimcast plugins run in **sandboxed Node.js subprocesses**. They communicate with the Jimcast core (Rust + Tauri) over **JSON-RPC 2.0** on stdio.

This is the same model used by VS Code extensions, Raycast extensions, and Fig plugins. It means:

- One bad plugin cannot crash the whole app
- Plugins cannot access the Jimcast internals
- The TypeScript types here are the complete, enforced boundary

## Examples

- [`examples/hello-world`](./examples/hello-world) — minimal plugin, covers the basics
- [`examples/git-status`](./examples/git-status) — realistic plugin using exec, streaming, PRs, and storage

## License

MIT — © Jimcast
