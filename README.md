# @jimcast/sdk

The primary SDK for building plugins for
[Jimcast](https://github.com/irmansyah/jimcast-releases). Define a plugin in
a few lines of TypeScript: register widgets, command-bar commands, key
bindings and navigation, and talk to the host through a single
`ExecutionContext`. No webview, React or bundler setup needed.

Already have a web app you want inside Jimcast? Use
[`@jimcast/react-sdk`](../react-sdk) instead; it wraps existing JS/TS
projects as webview plugins. For anything new, start here.

## Quick start

Copy the starter template:

```bash
cp -R jimcast-sdk/templates/plugin_starter ~/jimcast-plugins/my-plugin
cd ~/jimcast-plugins/my-plugin
pnpm install
pnpm build
```

The template shows the usual layout:

```
src/
├── index.ts      ← plugin entry: assembles the plugin
├── commands.ts   ← commands (each has an async run(ctx))
├── render.ts     ← render(ctx) returns the widget's content
└── shell.ts      ← helpers that use ctx (e.g. readCount)
tsdown.config.ts  ← build config
```

Then install the build into `~/.jimcast/plugins/<plugin-id>/`, register it
under `widgets` in `~/.jimcast/config.json` and place it in a slot in
`~/.jimcast/profiles.json`:

```json
"widgets": {
  "my-plugin": { "use": "com.jimcast.plugins.my-plugin" }
}
```

## Core concepts

- **Widgets**: create one with `createWidget(definition)`. A widget's
  `render` returns `WidgetContent` that the host draws natively.
- **Terminal widgets**: `createTmuxTerminalWidget(id, config)` and
  `createTmuxTerminalWidgets(idPrefix, config)` host a tmux-backed terminal
  panel.
- **Specs**: widgets can declare CLI, key and nav specs. `validateSpecs(plugin)`
  returns a list of problems (such as collisions) before you ship.
- **Execution context**: every `run`, `render` and handler receives an
  `ExecutionContext` for calling the host and the shell.
- **Process helpers**: `execSucceeded(result)` and `execFailed(result)` check
  an `ExecResult` from the shell.
- **Identity and storage**: `pluginId()`, `qualifyWidgetId(local?)`,
  `pluginDataDir()` and `pluginDataFile(name)` resolve your plugin's id and
  its folder under `~/.jimcast/plugin-data/<plugin-id>/`.

## Related packages

| Package | Purpose |
|---|---|
| `@jimcast/sdk` | **This package**: build new plugins (recommended) |
| [`@jimcast/react-sdk`](../react-sdk) | Embed an existing JS/TS web project as a webview plugin |
| `@jimcast/protocol` | Shared wire types and runtime-free helpers used by both |

## License

MIT — © 2026 Irmansyah
