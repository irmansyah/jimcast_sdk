# jimcast-sdk

```text
// .DS_Store
```

```text
// .gitignore
```

```text
// LICENSE
```

```markdown
<!-- README.md -->
```

```json
// package-lock.json
```

```json
// package.json
```

```yaml
# pnpm-lock.yaml
```

```yaml
# pnpm-workspace.yaml
```

```json
// tsconfig.base.json
```

```ts
// types/global.d.ts
```

```markdown
<!-- docs/api-reference.md -->
```

```text
// examples/.DS_Store
```

```text
// examples/hello-world/.DS_Store
```

```json
// examples/hello-world/package-lock.json
```

```json
// examples/hello-world/package.json
```

```js
// examples/hello-world/test-harness.mjs
```

```json
// examples/hello-world/tsconfig.json
```

```ts
// examples/hello-world/tsdown.config.ts
```

```ts
// examples/hello-world/src/index.ts

async render(context: ExecutionContext): Promise<WidgetContent> {
}
```

```ts
// examples/hello-world/src/main.ts
```

```text
// packages/.DS_Store
```

```text
// packages/sdk/.DS_Store
```

```json
// packages/sdk/package-lock.json
```

```json
// packages/sdk/package.json
```

```json
// packages/sdk/tsconfig.build.json
```

```json
// packages/sdk/tsconfig.json
```

```ts
// packages/sdk/tsdown.config.ts
```

```text
// packages/sdk/src/.DS_Store
```

```ts
// packages/sdk/src/command.ts

export function createCommand(definition: CommandDefinition): Command {
}

export function definePlugin(definition: PluginDefinition): Plugin {
}
```

```ts
// packages/sdk/src/context.ts

*   onLine(line) {
}
```

```ts
// packages/sdk/src/index.ts
```

```ts
// packages/sdk/src/process.ts

export function execSucceeded(result: ExecResult): boolean {
}

export function execFailed(result: ExecResult): boolean {
}
```

```ts
// packages/sdk/src/rpc.ts

constructor(
    private readonly stdin:     NodeJS.ReadableStream,
    private readonly stdout:    NodeJS.WritableStream,
    private readonly onRequest: (command: string, args: unknown, id: string) => Promise<unknown>,
  ) {
}

send(command: string, args: unknown): Promise<unknown> {
}

respond(id: string, result: unknown): void {
}

respondError(id: string, message: string): void {
}

private write(message: unknown): void {
}

private listen(): void {
}

function actionFnId(widgetId: string, itemId: string): string {
}

function registerActionFn(fnId: string, fn: WidgetActionFn, ctx: ExecutionContext): void {
}

function serializeItem(widgetId: string, item: WidgetItem, ctx: ExecutionContext): unknown {
}

function serializeContent(widgetId: string, content: WidgetContent<boolean>, ctx: ExecutionContext): unknown {
}

function serializeSection(section: WidgetSectionOptions | undefined): unknown {
}

export async function bootstrapPlugin(plugin: Plugin): Promise<void> {
}

function findWidget(plugin: Plugin, widgetId: string): AnyWidget | undefined {
}

async function handleCoreRequest(
  command:   string,
  args:      unknown,
  _id:       string,
  plugin:    Plugin,
  transport: RpcTransport,
): Promise<unknown> {
}

function findCommand(plugin: Plugin, commandId: string) {
}

function buildHostContext(raw: Partial<RawHostContext>): HostContext {
}

function buildContext(
  env:       EnvContext,
  host:      HostContext,
  transport: RpcTransport,
): ExecutionContext {
}
```

```ts
// packages/sdk/src/runtime.ts
```

```ts
// packages/sdk/src/storage.ts

* Limits (enforced by core):
 * - Key length: max 512 characters
 * - Value length: max 100 KB per key
 * - Total storage per plugin: max 10 MB
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for listing storage keys.
 */
export interface ListKeysOptions {
}

export function createStorage(
  send: (method: string, params: unknown) => Promise<unknown>
): PluginStorage {
}
```

```ts
// packages/sdk/src/ui.ts
```

```ts
// packages/sdk/src/widget.ts

export function createWidget<Exp extends WidgetDescriptorExpandable | undefined = undefined>(
  definition: WidgetDescriptor<Exp>
): Widget<Exp> {
}

export function buildTmuxAttachScript(config: WidgetExpandableTerminalConfig): string {
}

*   render(ctx) {
}

export function createTmuxTerminalWidget(
  id:     string,
  config: WidgetExpandableTerminalConfig,
): Widget {
}

export function createTmuxTerminalWidgets(
  idPrefix: string,
  config:   WidgetExpandableTerminalsConfig,
): Record<string, Widget> {
}
```

```ts
// packages/sdk/src/themes/catppuccin.ts
```

```ts
// packages/sdk/src/themes/default.ts
```

```ts
// packages/sdk/src/themes/gruvbox-dark.ts
```

```ts
// packages/sdk/src/themes/gruvbox-light.ts
```

```ts
// packages/sdk/src/themes/index.ts

export function resolveTheme(name: string | undefined): ThemeContext {
}
```

```ts
// packages/sdk/src/themes/nord.ts
```

```ts
// packages/sdk/src/themes/theme.ts
```

```ts
// packages/sdk/src/themes/tokyo-night.ts
```

```text
// templates/plugin-starter/.DS_Store
```

```json
// templates/plugin-starter/package-lock.json
```

```json
// templates/plugin-starter/package.json
```

```ts
// templates/plugin-starter/tsdown.config.ts
```

```ts
// templates/plugin-starter/src/index.ts

async execute(context) {
}
```
