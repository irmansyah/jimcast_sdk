// [sdk] packages/react-sdk/src/react/index.ts
//
// Barrel for the `./react` subpath. useHostBridge.ts and commandLine.ts
// are kept as separate files (different concerns — host nav subscription
// vs. local command-line state) but exposed as one surface here, same
// pattern as server/index.ts re-exporting hostRpc + commands.
export { useHostNav } from './useHostBridge'
export type { HostNavHandlers } from './useHostBridge'

export { useCommandLine } from './commandLine'
export type {
  CommandLineCommand,
  CommandLineRegistry,
  CommandContext,
  CommandResult,
  UseCommandLineResult,
  Feedback,
} from './commandLine'
