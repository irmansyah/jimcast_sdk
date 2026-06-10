import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  noExternal: ["@jimcast/sdk"],
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
});
