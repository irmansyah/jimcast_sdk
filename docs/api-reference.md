# docs/api-reference.md

# `@jimcast/sdk` API Reference

The Jimcast SDK is the contract between the Jimcast core engine and the plugin ecosystem. Everything a plugin can do is available on this page. If something is not listed here, your plugin cannot do it.

---

## Plugin manifest

### `definePlugin(definition)`

Defines a plugin and registers it with the Jimcast runtime. Every plugin must call this exactly once, as its **default export**.

```typescript
import { definePlugin } from "@jimcast/sdk";

export default definePlugin({
  name: "My Plugin",
  description: "Does useful things",
  commands: [/* ... */],
});
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✓ | Display name shown in the plugin manager |
| `description` | `string` | — | One-sentence description of what the plugin does |
| `commands` | `(Command \| CommandGroup)[]` | ✓ | Commands this plugin contributes |

---

## Commands

### `createCommand(definition)`

Creates a command — the primary building block of a Jimcast plugin. Every user-visible action is a command.

```typescript
import { createCommand } from "@jimcast/sdk";

const myCommand = createCommand({
  id: "my-plugin.do-thing",
  title: "Do the Thing",
  subtitle: "Explains what the thing is",
  keywords: ["thing", "do"],
  async execute(context) {
    // return CommandItem[] or void
  },
});
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Globally unique ID, convention: `plugin-name.command-name` |
| `title` | `string` | ✓ | Shown in command bar. Keep it 2–4 words. |
| `subtitle` | `string` | — | Supporting text below the title |
| `keywords` | `string[]` | — | Extra fuzzy search terms |
| `execute` | `(context: ExecutionContext) => Promise<CommandItem[] \| void>` | ✓ | The command handler |

### `createCommandGroup(options)`

Groups related commands under a shared heading.

```typescript
import { createCommandGroup } from "@jimcast/sdk";

const gitGroup = createCommandGroup({
  title: "Git",
  commands: [openPRCommand, checkoutCommand],
});
```

---

## `ExecutionContext`

Passed to every command's `execute()` function. This is the complete runtime API.

### Properties

#### `context.project` — `ProjectContext`

State of the current project when the command fired.

| Field | Type | Description |
|-------|------|-------------|
| `cwd` | `string` | Absolute path to the working directory |
| `repoRoot` | `string \| null` | Absolute path to the git repo root, or null |
| `branch` | `string \| null` | Current branch name, or null |
| `remoteName` | `string \| null` | Configured remote name (e.g. `"origin"`), or null |
| `openPRs` | `PR[]` | Open pull requests on the current repo |
| `recentCommits` | `Commit[]` | Last 20 commits on the current branch |

#### `context.env` — `EnvContext`

| Field | Type | Description |
|-------|------|-------------|
| `jimcastVersion` | `string` | Jimcast core version (semver) |
| `platform` | `"macos" \| "linux" \| "windows"` | User's OS |
| `pluginVersion` | `string` | This plugin's version |

#### `context.storage` — `PluginStorage`

See [Storage](#storage) below.

### Methods

#### `context.exec(command, options?)`

Runs a shell command and returns when it completes.

```typescript
const { stdout, exitCode } = await context.exec("git branch --show-current");
```

Returns: `Promise<ExecResult>`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `env` | `Record<string, string>` | — | Extra environment variables |
| `timeoutMs` | `number` | `30_000` | Kill command after this many ms |
| `captureStderr` | `boolean` | `true` | Include stderr in result |

**`ExecResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `stdout` | `string` | Full stdout output |
| `stderr` | `string` | Full stderr output |
| `exitCode` | `number` | Process exit code |
| `timedOut` | `boolean` | Whether the command was killed |

**Helpers:** `execSucceeded(result)` and `execFailed(result)` for checking results:

```typescript
import { execSucceeded } from "@jimcast/sdk";

const result = await context.exec("git status");
if (!execSucceeded(result)) { /* handle failure */ }
```

#### `context.execStreamed(command, options)`

Runs a shell command and streams output line by line.

```typescript
await context.execStreamed("npm run build", {
  onLine(line) { context.appendOutput(line); },
  onStderrLine(line) { context.appendOutput(`[err] ${line}`); },
});
```

Same options as `exec()`, plus:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `onLine` | `(line: string) => void` | ✓ | Called for each stdout line |
| `onStderrLine` | `(line: string) => void` | — | Called for each stderr line |

#### `context.showToast(title, options?)`

Shows a brief notification.

```typescript
await context.showToast("Done!", { style: "success" });
await context.showToast("Failed", { style: "failure", message: "Exit code 1" });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `style` | `"default" \| "success" \| "failure"` | `"default"` | Visual style |
| `message` | `string` | — | Secondary text below the title |
| `duration` | `number` | `3000` | How long to show it (ms) |

#### `context.appendOutput(line)`

Appends a line to the command's output panel. Fire-and-forget (no await).

```typescript
context.appendOutput("Build started...");
```

#### `context.copyToClipboard(text)`

Copies text to the system clipboard.

```typescript
await context.copyToClipboard("some text");
```

#### `context.openUrl(url)`

Opens a URL in the default browser. Must use `https:` or `http:`.

```typescript
await context.openUrl("https://github.com/your/repo");
```

---

## UI Primitives

### `CommandItem`

A row rendered in the command bar. Return an array of these from `execute()`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Stable identifier within the result list |
| `title` | `string` | ✓ | Primary label |
| `subtitle` | `string` | — | Secondary label |
| `accessory` | `string` | — | Right-aligned label (status, timestamp, count) |
| `keywords` | `string[]` | — | Extra fuzzy search terms |
| `actions` | `Action[]` | ✓ | At least one action; first is primary (↵) |
| `preview` | `Preview` | — | Content for the right-hand preview panel |

### `Action`

An action attached to a `CommandItem`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Stable identifier |
| `title` | `string` | ✓ | Shown in the action panel. Use a verb phrase. |
| `shortcut` | `string` | — | Keyboard shortcut, e.g. `"cmd+shift+c"` |
| `onAction` | `() => Promise<void>` | ✓ | Called when triggered |

### `Preview`

Optional right-hand panel for a selected item.

```typescript
// Markdown preview
{ type: "markdown", content: "## Title\n\nBody text" }

// Plain text preview
{ type: "text", content: "raw text output" }
```

---

## Storage

Per-plugin key-value store. Persists across restarts. Scoped to your plugin — you cannot read other plugins' data.

**Limits:** Keys max 512 chars. Values max 100 KB each. Total per plugin max 10 MB.

| Method | Returns | Description |
|--------|---------|-------------|
| `storage.get(key)` | `Promise<string \| null>` | Get a value, or `null` if not set |
| `storage.set(key, value)` | `Promise<void>` | Store a value |
| `storage.delete(key)` | `Promise<void>` | Remove a key (no-op if missing) |
| `storage.has(key)` | `Promise<boolean>` | Check if a key exists |
| `storage.keys(options?)` | `Promise<string[]>` | List all keys, optionally filtered by prefix |
| `storage.clear()` | `Promise<void>` | Delete all data for this plugin |

```typescript
// Store structured data
await context.storage.set("config", JSON.stringify({ showDrafts: true }));
const raw = await context.storage.get("config");
const config = raw ? JSON.parse(raw) : {};

// Namespace related keys
await context.storage.set("cache:main", JSON.stringify(data));
const cacheKeys = await context.storage.keys({ prefix: "cache:" });
```

---

## What the SDK does NOT expose

The following are explicitly out of scope. Requesting them will not work:

- **Core internals** — how tmux, neovim RPC, or the terminal integration works
- **Other plugins' storage** — storage is fully sandboxed per-plugin
- **Direct filesystem access** — use `context.exec("cat ...")` or `context.exec("ls ...")` instead
- **Custom UI** — you can only return `CommandItem[]` and `Preview`; layout and chrome are owned by Jimcast
- **Background processes** — commands run on demand; there is no daemon mode

If you need something the SDK doesn't provide, [open a discussion](https://github.com/jimcast-dev/jimcast-sdk/discussions).
