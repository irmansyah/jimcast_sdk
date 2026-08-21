// [sdk] packages/sdk/src/storage.ts
// Moved to @jimcast/protocol so @jimcast/react-sdk can share the same
// implementation instead of growing an independent copy — see
// packages/protocol/src/storage.ts for the actual implementation.
// Re-exported here so rpc.ts's `./storage.js` import (and any plugin
// author importing `@jimcast/sdk`'s storage types) keeps working unchanged.
export { createStorage, type PluginStorage, type ListKeysOptions } from '@jimcast/protocol'
