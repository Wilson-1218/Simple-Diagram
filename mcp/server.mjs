#!/usr/bin/env node
/**
 * Minimal MCP server (stdio JSON-RPC) for Simple Diagram.
 * Tools: create_diagram, apply_ops, validate_diagram, summarize_diagram,
 *         load_example, list_ops
 *
 * Agents: prefer apply_ops with validate+summarize to cut round-trips.
 * See docs/agent-draw-playbook.md
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
  runMacro,
  MACRO_NAMES,
  listBuiltinTemplates,
  BUILTIN_TEMPLATE_IDS,
  OP_NAMES,
  OP_CATALOG,
  CURRENT_FORMAT_VERSION,
  APP_VERSION,
} from "../src/diagram/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const EXAMPLES_DIR = join(ROOT, "examples");

const SERVER_INFO = {
  name: "simple-diagram",
  version: APP_VERSION,
};

function listExamples() {
  try {
    return readdirSync(EXAMPLES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

function loadExample(name) {
  const safe = String(name || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("example name required");
  const path = join(EXAMPLES_DIR, `${safe}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

const TOOLS = [
  {
    name: "create_diagram",
    description:
      "Create an empty Simple Diagram JSON (formatVersion 1). " +
      "Prefer this once, then apply_ops with many ops in one call. " +
      "Do not simulate UI clicks — only emit document JSON + ops.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Document name (e.g. triangle.json)" },
        view: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            scale: { type: "number" },
          },
        },
        gridMode: { type: "string", enum: ["square", "triangle"] },
        gridSnap: { type: "boolean" },
      },
    },
  },
  {
    name: "apply_ops",
    description:
      "Apply diagram ops to a document (or empty if doc omitted). " +
      "Batch many ops in one call. Returns { doc, validation?, summary? }. " +
      "Defaults: validate=true, summarize=true (set false to shrink payload). " +
      "On error, returns { error, hint } with the failing op index. " +
      "Known ops: " +
      OP_NAMES.join(", "),
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "object", description: "Existing diagram JSON (optional)" },
        ops: {
          type: "array",
          description:
            'Op objects with "op" field, e.g. {"op":"addPoint","id":"A","x":0,"y":0}',
          items: { type: "object" },
        },
        validate: {
          type: "boolean",
          description: "Validate after apply (default true)",
        },
        summarize: {
          type: "boolean",
          description: "Include compact summary (default true)",
        },
        returnDoc: {
          type: "boolean",
          description: "Include full doc in response (default true)",
        },
      },
      required: ["ops"],
    },
  },
  {
    name: "validate_diagram",
    description:
      "Validate a Simple Diagram JSON document. Returns { ok, errors, warnings }. " +
      "Fix errors by correcting point refs / fill kinds / styles, then re-apply.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "object", description: "Diagram JSON" },
      },
      required: ["doc"],
    },
  },
  {
    name: "summarize_diagram",
    description:
      "Compact counts + ids for a diagram (no full geometry). Use to check progress without resending the whole doc.",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "object", description: "Diagram JSON" },
      },
      required: ["doc"],
    },
  },
  {
    name: "load_example",
    description:
      "Load a bundled example diagram or ops file by basename (no .json). " +
      "Available: " +
      listExamples().join(", ") +
      ". Ops files (*-ops / ops-*) are arrays — use as apply_ops.ops, not as doc.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Example basename, e.g. cube-sketch or ops-circle-tangent",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_ops",
    description:
      "List supported op names with short arg hints, formatVersion, app version, macros, templates, and examples.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_templates",
    description:
      "List Templates ▾ combo catalog (same source as the UI: circleGeom, circleCenter, altBase). " +
      "Pass includeAll=true for AI-only plane/solid ids (ui:false; prefer addShape for solids). " +
      "Insert with { op: insertTemplate, id }.",
    inputSchema: {
      type: "object",
      properties: {
        includeAll: {
          type: "boolean",
          description:
            "If true, include ui:false plane/solid template ids. Default false = Templates menu only.",
        },
      },
    },
  },
  {
    name: "run_macro",
    description:
      "Run a high-level draw macro (returns ops + applied doc + validation + summary). " +
      "Macros: " +
      MACRO_NAMES.join(", ") +
      ". Prefer this for HKDSE solids/triangles instead of hand-building points.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Macro name, e.g. drawFrustum" },
        params: { type: "object", description: "Macro parameters" },
        doc: { type: "object", description: "Optional base document to apply onto" },
      },
      required: ["name"],
    },
  },
  {
    name: "export_svg",
    description:
      "Render a diagram document to SVG markup (headless, white paper / black ink). " +
      "For files on disk use: node tools/export-diagram.mjs --in doc.json --out out.svg|png",
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "object", description: "Diagram JSON" },
        scale: { type: "number", description: "Export scale (default 2)" },
      },
      required: ["doc"],
    },
  },
];

function toolResult(obj, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
    isError: !!isError,
  };
}

function callTool(name, args) {
  args = args || {};
  switch (name) {
    case "create_diagram": {
      const overrides = {};
      if (args.name) overrides.name = args.name;
      if (args.view) overrides.view = args.view;
      if (args.gridMode === "square" || args.gridMode === "triangle") {
        overrides.gridMode = args.gridMode;
      }
      if (args.gridSnap != null) overrides.gridSnap = !!args.gridSnap;
      return toolResult(emptyDiagram(overrides));
    }
    case "apply_ops": {
      if (!Array.isArray(args.ops)) {
        return toolResult(
          {
            error: "ops must be an array",
            hint: 'Pass ops: [{ "op": "addPoint", "id": "A", "x": 0, "y": 0 }, ...]',
          },
          true
        );
      }
      const wantValidate = args.validate !== false;
      const wantSummary = args.summarize !== false;
      const wantDoc = args.returnDoc !== false;
      try {
        const doc = applyOps(args.doc || null, args.ops);
        const out = {};
        if (wantDoc) out.doc = doc;
        if (wantValidate) out.validation = validateDiagram(doc);
        if (wantSummary) out.summary = summarizeDiagram(doc);
        if (!wantDoc && !wantValidate && !wantSummary) out.doc = doc;
        return toolResult(out);
      } catch (err) {
        const msg = err.message || String(err);
        let hint =
          "Check op name spelling and that point/segment/circle ids exist before use.";
        const m = /ops\[(\d+)\]/.exec(msg);
        if (m) {
          const i = Number(m[1]);
          const bad = args.ops[i];
          hint += ` Failing op index ${i}: ${JSON.stringify(bad)}`;
        }
        return toolResult({ error: msg, hint }, true);
      }
    }
    case "validate_diagram": {
      if (!args.doc) return toolResult({ error: "doc required" }, true);
      return toolResult(validateDiagram(args.doc));
    }
    case "summarize_diagram": {
      if (!args.doc) return toolResult({ error: "doc required" }, true);
      return toolResult(summarizeDiagram(args.doc));
    }
    case "load_example": {
      try {
        const data = loadExample(args.name);
        const isOps =
          Array.isArray(data) ||
          (data && Array.isArray(data.ops) && !data.points);
        return toolResult({
          kind: isOps ? "ops" : "document",
          data,
          tip: isOps
            ? "Pass data (or data.ops) to apply_ops.ops"
            : "Use as apply_ops.doc or open in the editor",
        });
      } catch (err) {
        return toolResult(
          { error: err.message || String(err), available: listExamples() },
          true
        );
      }
    }
    case "list_ops": {
      return toolResult({
        formatVersion: CURRENT_FORMAT_VERSION,
        appVersion: APP_VERSION,
        ops: OP_NAMES,
        catalog: OP_CATALOG,
        macros: MACRO_NAMES,
        templates: BUILTIN_TEMPLATE_IDS,
        examples: listExamples(),
        playbook: "docs/agent-draw-playbook.md",
        exportCli: "node tools/export-diagram.mjs --ops … --out out.svg --validate",
      });
    }
    case "list_templates": {
      const includeAll = !!(args && args.includeAll);
      return toolResult({
        templates: listBuiltinTemplates({ uiOnly: !includeAll }),
        tip: includeAll
          ? "Combos: insertTemplate. Solids/planes: prefer addShape; insertTemplate still accepts ui:false ids."
          : 'apply_ops with { "op": "insertTemplate", "id": "circleGeom" } — same ids as Templates ▾',
      });
    }
    case "run_macro": {
      try {
        if (!args.name) return toolResult({ error: "name required" }, true);
        const params = { ...(args.params || {}), apply: true };
        if (args.doc) params.applyTo = args.doc;
        const { ops, doc } = runMacro(args.name, params);
        return toolResult({
          ops,
          doc,
          validation: validateDiagram(doc),
          summary: summarizeDiagram(doc),
        });
      } catch (err) {
        return toolResult(
          {
            error: err.message || String(err),
            hint: `Known macros: ${MACRO_NAMES.join(", ")}`,
          },
          true
        );
      }
    }
    case "export_svg": {
      if (!args.doc) return toolResult({ error: "doc required" }, true);
      try {
        const svg = documentToSvg(args.doc, { scale: args.scale });
        return toolResult({
          svg,
          summary: summarizeDiagram(args.doc),
          validation: validateDiagram(args.doc),
        });
      } catch (err) {
        return toolResult({ error: err.message || String(err) }, true);
      }
    }
    default:
      return toolResult({ error: `unknown tool: ${name}` }, true);
  }
}

// ——— JSON-RPC over stdio (MCP subset) ———
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    if (buffer.startsWith("{")) {
      const nl = buffer.indexOf("\n");
      if (nl < 0) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) handleMessage(line);
      continue;
    }
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      const alt = buffer.indexOf("\n\n");
      if (alt < 0) break;
      const headers = buffer.slice(0, alt);
      const match = /Content-Length:\s*(\d+)/i.exec(headers);
      if (!match) {
        buffer = buffer.slice(alt + 2);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = alt + 2;
      if (buffer.length < bodyStart + len) break;
      const body = buffer.slice(bodyStart, bodyStart + len);
      buffer = buffer.slice(bodyStart + len);
      handleMessage(body);
      continue;
    }
    const headers = buffer.slice(0, headerEnd);
    const match = /Content-Length:\s*(\d+)/i.exec(headers);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;
    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);
    handleMessage(body);
  }
});

function send(msg) {
  const json = JSON.stringify(msg);
  const frame = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
  process.stdout.write(frame);
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.method === "notifications/initialized" || msg.method === "initialized") {
    return;
  }
  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: msg.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }
  if (msg.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { tools: TOOLS },
    });
    return;
  }
  if (msg.method === "tools/call") {
    const tname = msg.params?.name;
    const targs = msg.params?.arguments || {};
    const result = callTool(tname, targs);
    send({ jsonrpc: "2.0", id: msg.id, result });
    return;
  }
  if (msg.method === "ping") {
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
    return;
  }
  if (msg.id != null) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    });
  }
}

process.stderr.write(
  `[simple-diagram MCP] ready · v${APP_VERSION} · formatVersion ${CURRENT_FORMAT_VERSION} · ${OP_NAMES.length} ops\n`
);
