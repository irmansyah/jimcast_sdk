// [sdk] packages/react-sdk/src/server/index.ts

export { callHost } from './hostRpc'
export { defineCommand, defineSearch, defineCorpus, LIST_COMMANDS_ID, SEARCH_ID, CORPUS_ID } from './commands'
export type { CommandDefinition, CommandArgSpec, CommandMeta } from './commands'
export { useHostStorage } from './storage.js'

export { defineWebviewBackend } from './webviewBackend'
export type { Handler, WebviewBackendDefinition } from './webviewBackend'

// NEW: manifest-driven backend (wraps defineWebviewBackend)
export { defineBackend } from './defineBackend'
export type { DefineBackendOptions, HostCommandHandler } from './defineBackend'
