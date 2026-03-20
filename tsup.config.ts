import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: false,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
