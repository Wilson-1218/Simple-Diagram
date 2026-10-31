#!/usr/bin/env node
/**
 * Export a diagram JSON to SVG (always) and optionally PNG via headless Chromium.
 *
 * Usage:
 *   node tools/export-diagram.mjs --in diagram.json --out out.svg
 *   node tools/export-diagram.mjs --in diagram.json --out out.png --format png
 *   node tools/export-diagram.mjs --ops examples/ops-right-triangle.json --out /tmp/tri.svg
 *   node tools/export-diagram.mjs --macro drawFrustum --out /tmp/fr.svg
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
  runMacro,
} from "../src/diagram/index.mjs";

function usage() {
  console.error(`Usage:
  node tools/export-diagram.mjs --in doc.json --out out.svg|png [--format svg|png]
  node tools/export-diagram.mjs --ops ops.json --out out.svg [--validate]
  node tools/export-diagram.mjs --macro drawFrustum [--params '{"scale":1}'] --out out.svg

Options:
  --in PATH       Diagram JSON
  --ops PATH      Ops JSON array (or {ops:[…]}); starts from empty
  --macro NAME    High-level macro (see list_ops / MACRO_NAMES)
  --params JSON   Macro params object
  --out PATH      Output .svg or .png
  --format svg|png  Override extension
  --scale N       Geometry scale (default 2; does not set paper ink thickness)
  --frame-mm WxH  Target embed frame in mm for ink (default 54x40)
  --stroke-mm N   Min stroke mm when fitted to frame (default 0.4)
  --label-pt N    Baseline letter size in pt (default 8)
  --validate      Exit 1 if validateDiagram fails
  --summary       Print summarizeDiagram JSON to stderr
`);
}

function parseArgs(argv) {
  const args = {
    in: null,
    ops: null,
    macro: null,
    params: {},
    out: null,
    format: null,
    scale: 2,
    frameWidthMm: 54,
    frameHeightMm: 40,
    minStrokeMm: 0.4,
    labelPt: 8,
    validate: false,
    summary: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--ops") args.ops = argv[++i];
    else if (a === "--macro") args.macro = argv[++i];
    else if (a === "--params") args.params = JSON.parse(argv[++i] || "{}");
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--format") args.format = argv[++i];
    else if (a === "--scale") args.scale = Number(argv[++i]);
    else if (a === "--frame-mm") {
      const raw = String(argv[++i] || "");
      const m = raw.match(/^([0-9.]+)\s*[x×]\s*([0-9.]+)$/i);
      if (!m) {
        console.error("Bad --frame-mm; expected WxH e.g. 54x40");
        process.exit(2);
      }
      args.frameWidthMm = Number(m[1]);
      args.frameHeightMm = Number(m[2]);
    } else if (a === "--stroke-mm") args.minStrokeMm = Number(argv[++i]);
    else if (a === "--label-pt") args.labelPt = Number(argv[++i]);
    else if (a === "--validate") args.validate = true;
    else if (a === "--summary") args.summary = true;
    else if (a === "-h" || a === "--help") {
      usage();
      process.exit(0);
    } else {
      console.error("Unknown arg:", a);
      usage();
      process.exit(2);
    }
  }
  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

async function svgToPng(svg, outPath) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "PNG export requires playwright. Run: npm install --no-save playwright && npx playwright install chromium"
    );
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(svg, { waitUntil: "load" });
    const loc = page.locator("svg");
    await loc.screenshot({ path: outPath, omitBackground: false, type: "png" });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    usage();
    process.exit(2);
  }

  let doc;
  if (args.macro) {
    doc = runMacro(args.macro, { ...args.params, apply: true }).doc;
  } else if (args.ops) {
    const raw = loadJson(args.ops);
    const ops = Array.isArray(raw) ? raw : raw.ops;
    doc = applyOps(args.in ? loadJson(args.in) : emptyDiagram(), ops);
  } else if (args.in) {
    doc = loadJson(args.in);
  } else {
    console.error("Need --in, --ops, or --macro");
    process.exit(2);
  }

  if (args.validate) {
    const v = validateDiagram(doc);
    if (v.warnings?.length) for (const w of v.warnings) console.warn("warn:", w);
    if (!v.ok) {
      for (const e of v.errors) console.error("error:", e);
      process.exit(1);
    }
  }
  if (args.summary) {
    console.error(JSON.stringify(summarizeDiagram(doc), null, 2));
  }

  const svg = documentToSvg(doc, {
    scale: args.scale,
    frameWidthMm: args.frameWidthMm,
    frameHeightMm: args.frameHeightMm,
    minStrokeMm: args.minStrokeMm,
    labelPt: args.labelPt,
  });
  const format =
    args.format ||
    (extname(args.out).toLowerCase() === ".png" ? "png" : "svg");
  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  const outAbs = resolve(args.out);

  if (format === "svg") {
    writeFileSync(outAbs, svg, "utf8");
    console.log("Wrote", outAbs);
    return;
  }
  if (format === "png") {
    const svgPath = outAbs.replace(/\.png$/i, "") + ".svg";
    writeFileSync(svgPath, svg, "utf8");
    await svgToPng(svg, outAbs);
    console.log("Wrote", outAbs, "(and", svgPath + ")");
    return;
  }
  console.error("Unknown format:", format);
  process.exit(2);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
