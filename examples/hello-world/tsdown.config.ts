import { defineConfig } from "tsdown";

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
    const { execSync } = await import("child_process");
    execSync(
      "mkdir -p ~/.jimcast/plugins/hello-world/dist && cp dist/main.mjs ~/.jimcast/plugins/hello-world/dist/ && cp package.json ~/.jimcast/plugins/hello-world/"
    );
  },
});
