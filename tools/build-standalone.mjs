#!/usr/bin/env node
/**
 * Regenerate simple-diagram-standalone.html from index.html + styles.css + app.js.
 * Usage: node tools/build-standalone.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");

let out = index;
out = out.replace(
  /<link rel="stylesheet" href="styles\.css\?v=[^"]+"\s*\/>/,
  `<style>\n${css}\n</style>`
);
out = out.replace(
  /<script src="app\.js\?v=[^"]+"><\/script>/,
  `<script>\n${js}\n</script>`
);
if (out.includes('href="styles.css') || out.includes('src="app.js')) {
  console.error("build-standalone: failed to inline styles/app");
  process.exit(1);
}
const outPath = path.join(root, "simple-diagram-standalone.html");
fs.writeFileSync(outPath, out);
console.log(`build-standalone: wrote ${outPath} (${out.length} bytes)`);
