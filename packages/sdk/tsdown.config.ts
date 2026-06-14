import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { sourcemap: false },
  sourcemap: true,
  clean: true,
  treeshake: true,
});

// import { defineConfig } from "tsdown";
//
// export default defineConfig({
//   entry: ["src/index.ts"],
//   format: ["esm", "cjs"],
//   dts: true,
//   // splitting: false,
//   sourcemap: true,
//   clean: true,
//   treeshake: true,
// });
