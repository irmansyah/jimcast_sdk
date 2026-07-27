// [sdk] tsdown.config.ts 

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    runtime: "src/runtime.ts",
  },
  format: ["esm", "cjs"],
  dts: { sourcemap: false },
  sourcemap: true,
  clean: true,
  treeshake: true,
});
