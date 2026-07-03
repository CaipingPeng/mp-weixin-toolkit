import { copyFile, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await Promise.all([
  build({
    entryPoints: ["src/content.ts"],
    outfile: "dist/content.js",
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: true
  }),
  build({
    entryPoints: ["src/pageBridge.ts"],
    outfile: "dist/pageBridge.js",
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: true
  }),
  copyFile("public/manifest.json", "dist/manifest.json"),
  copyFile("src/content.css", "dist/content.css")
]);
