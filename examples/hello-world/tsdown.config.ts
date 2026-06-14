import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  noExternal: ["@jimcast/sdk"],
  bundle: true,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  dts: {
    sourcemap: false,
  },
  onSuccess: async () => {
    const { execSync } = await import("child_process");
    execSync(
      "mkdir -p ~/.jimcast/plugins/hello-world/dist && cp dist/main.mjs ~/.jimcast/plugins/hello-world/dist/ && cp package.json ~/.jimcast/plugins/hello-world/",
      { shell: "/bin/bash" }
    );
  },
});
