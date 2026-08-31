// [sdk] packages/protocol/src/protocol.ts
// Was a local copy of isResponse/isRequest — now re-exported from
// @jimcast/protocol so there's exactly one implementation instead of two
// that can silently drift (same class of bug as storage.ts before this
// change).
export { isResponse, isRequest, type IpcRequest, type IpcResponse } from '@jimcast/protocol'
