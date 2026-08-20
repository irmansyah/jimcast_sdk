# jimcast-react-sdk

```markdown
<!-- README.md -->
```

```js
// esbuild.config.js
```

```json
// package.json
```

```json
// tsconfig.json
```

```ts
// src/protocol.ts

export function isResponse(msg: any): msg is IpcResponse {
}

export function isRequest(msg: any): msg is IpcRequest {
}
```

```ts
// src/server/hostRpc.ts

export function resolvePending(msg: any): boolean {
}
```

```ts
// src/server/index.ts

export function definePlugin(handlers: PluginDefinition): void {
}
```

```ts
// src/client/index.ts

function ensureListening() {
}

export function onHostNav(handler: (payload: NavPayload) => void): () => void {
}

export function reportFocusedItem(info: FocusedItemInfo | null): void {
}

export function reportDragStarted(paths: string[], rect: IframeLocalRect): void {
}
```

```ts
// src/react/useHostBridge.ts

export function useHostNav(handlers: HostNavHandlers | null): void {
}
```
