import { defineConfig } from "tsdown";
import { execSync } from "child_process";
import { basename } from "path";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  unbundle: false,
  deps: {
    alwaysBundle: ["@jimcast/sdk"],
  },
  sourcemap: false,
  clean: true,
  outDir: "dist",
  dts: {
    sourcemap: false,
  },
  onSuccess: async () => {
    const pluginDir = `~/.jimcast/plugins/${basename(process.cwd())}`;
    execSync(
      `mkdir -p ${pluginDir}/dist && cp dist/main.mjs ${pluginDir}/dist/ && cp package.json ${pluginDir}/`
    );
  },
});
