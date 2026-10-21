#!/usr/bin/env node
/**
 * Apply diagram ops to a JSON document.
 *
 * Usage:
 *   node tools/apply-ops.mjs --in a.json --ops ops.json --out b.json
 *   node tools/apply-ops.mjs --ops ops.json --out b.json   # starts from empty
 *   node tools/apply-ops.mjs --in a.json --ops ops.json --validate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyOps, emptyDiagram, validateDiagram } from "../src/diagram/index.mjs";

function usage() {
  console.error(`Usage:
  node tools/apply-ops.mjs [--in doc.json] --ops ops.json --out out.json [--validate]
  node tools/apply-ops.mjs --create --out empty.json

Options:
  --in PATH       Input diagram JSON (default: empty document)
  --ops PATH      Ops JSON array (or { "ops": [...] })
  --out PATH      Output diagram JSON
  --validate      Run validateDiagram after apply (exit 1 on failure)
  --create        Write an empty diagram (ignores --ops)
  --pretty        Pretty-print output (default: true)
  --compact       Compact JSON
`);
}

function parseArgs(argv) {
  const args = {
    in: null,
    ops: null,
    out: null,
    validate: false,
    create: false,
    pretty: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--ops") args.ops = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--validate") args.validate = true;
    else if (a === "--create") args.create = true;
    else if (a === "--pretty") args.pretty = true;
    else if (a === "--compact") args.pretty = false;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    usage();
    process.exit(2);
  }

  let doc;
  if (args.create) {
    doc = emptyDiagram();
  } else {
    const base = args.in ? loadJson(args.in) : emptyDiagram();
    if (!args.ops) {
      console.error("--ops is required unless --create");
      process.exit(2);
    }
    const raw = loadJson(args.ops);
    const ops = Array.isArray(raw) ? raw : raw.ops;
    if (!Array.isArray(ops)) {
      console.error("ops file must be an array or { ops: [...] }");
      process.exit(2);
    }
    doc = applyOps(base, ops);
  }

  if (args.validate) {
    const result = validateDiagram(doc);
    if (result.warnings?.length) {
      for (const w of result.warnings) console.warn("warn:", w);
    }
    if (!result.ok) {
      for (const e of result.errors) console.error("error:", e);
      process.exit(1);
    }
  }

  const text = args.pretty ? JSON.stringify(doc, null, 2) + "\n" : JSON.stringify(doc);
  writeFileSync(resolve(args.out), text, "utf8");
  console.log("Wrote", resolve(args.out));
}

main();
