#!/usr/bin/env node
/**
 * Minimal MCP server (stdio JSON-RPC) for Simple Diagram.
 * Tools: create_diagram, apply_ops, validate_diagram, load_example, list_ops
 *
 * Cursor MCP config example — see README «AI / Automation».
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  emptyDiagram,
  validateDiagram,
  OP_NAMES,
  CURRENT_FORMAT_VERSION,
} from "../src/diagram/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const EXAMPLES_DIR = join(ROOT, "examples");

const SERVER_INFO = {
  name: "simple-diagram",
  version: "13.3.0",
};

function listExamples() {
  try {
    return readdirSync(EXAMPLES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
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
      "Create an empty Simple Diagram JSON document (formatVersion 1). Optional overrides as JSON object fields.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Document name (e.g. cube.json)" },
        view: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            scale: { type: "number" },
          },
        },
      },
    },
  },
  {
    name: "apply_ops",
    description:
      "Apply an array of diagram ops to a document (or empty if omitted). Returns the new document. Ops: " +
      OP_NAMES.join(", "),
    inputSchema: {
      type: "object",
      properties: {
        doc: { type: "object", description: "Existing diagram JSON (optional)" },
        ops: {
          type: "array",
          description: "Array of op objects, each with \"op\" field",
          items: { type: "object" },
        },
        validate: {
          type: "boolean",
          description: "If true, validate result and include validation in response",
        },
      },
      required: ["ops"],
    },
  },
  {
    name: "validate_diagram",
    description: "Validate a Simple Diagram JSON document. Returns { ok, errors, warnings }.",
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
      "Load a bundled example diagram by name (without .json). Available: " +
      listExamples().join(", "),
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Example basename, e.g. cube-sketch",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_ops",
    description: "List supported op names and formatVersion.",
    inputSchema: { type: "object", properties: {} },
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
      return toolResult(emptyDiagram(overrides));
    }
    case "apply_ops": {
      if (!Array.isArray(args.ops)) {
        return toolResult({ error: "ops must be an array" }, true);
      }
      try {
        const doc = applyOps(args.doc || null, args.ops);
        if (args.validate) {
          const v = validateDiagram(doc);
          return toolResult({ doc, validation: v });
        }
        return toolResult(doc);
      } catch (err) {
        return toolResult({ error: err.message || String(err) }, true);
      }
    }
    case "validate_diagram": {
      if (!args.doc) return toolResult({ error: "doc required" }, true);
      return toolResult(validateDiagram(args.doc));
    }
    case "load_example": {
      try {
        return toolResult(loadExample(args.name));
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
        ops: OP_NAMES,
        examples: listExamples(),
      });
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
  // Support Content-Length framing (MCP) and newline-delimited JSON
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
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    const result = callTool(name, args);
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
  `[simple-diagram MCP] ready · formatVersion ${CURRENT_FORMAT_VERSION} · ${OP_NAMES.length} ops\n`
);
