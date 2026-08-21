// [sdk] packages/sdk/src/runtime.ts
// Node-only SDK surface. Import from "@jimcast/sdk/runtime", not the root
// package — this re-exports bootstrapPlugin, which pulls in node:readline
// via rpc.ts and will break any browser/Vite bundle if imported from "."
export { bootstrapPlugin } from "./rpc.js";
