/**
 * v13.5.60 — stem-leaf and dot-pattern figures export PNG.
 * documentToSvg for those shapes loads in an Image. Copy PNG calls
 * clipboard.write synchronously with a Promise blob, and downloads if write rejects.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, applyOps, documentToSvg } from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION is 13.5.60", () => {
  assert.equal(APP_VERSION, "13.5.60");
});

function stemDoc() {
  return applyOps(null, [
    { op: "addPoint", id: "B", x: 40, y: 20, label: "B'" },
    {
      op: "addStemLeaf",
      x: 80,
      y: 40,
      rows: [
        { stem: "1", leaves: [2, 5, 8] },
        { stem: "2", leaves: "0 3 7" },
        { stem: "3", leaves: [1] },
      ],
    },
  ]);
}

function dotsDoc() {
  return applyOps(null, [
    {
      op: "addDotPattern",
      x: 40,
      y: 80,
      arrowStyle: "block",
      verticalAlign: "bottom",
      patterns: [{ rows: [1, 2, 3] }, { rows: [1] }, { rows: [2, 2] }],
      labels: ["A", "B'", "C"],
    },
  ]);
}

function plainDoc() {
  return applyOps(null, [
    { op: "addPoint", id: "A", x: 0, y: 0 },
    { op: "addPoint", id: "C", x: 80, y: 0 },
    { op: "addSegment", a: "A", b: "C" },
  ]);
}

test("stem-leaf B' and block-arrow dots stay well-formed SVG", () => {
  const stem = documentToSvg(stemDoc(), { scale: 2 });
  const dots = documentToSvg(dotsDoc(), { scale: 2 });
  for (const svg of [stem, dots]) {
    assert.equal(svg.includes("NaN"), false);
    assert.equal(svg.includes("undefined"), false);
    assert.equal(svg.includes("Infinity"), false);
    assert.equal(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(svg), false);
  }
  assert.match(stem, />B'</);
  assert.match(stem, />Stem \(tens\)</);
  assert.match(stem, />Leaf \(units\)</);
  assert.match(dots, /<polygon /);
  assert.match(dots, />B'</);
  assert.equal((dots.match(/<polygon /g) || []).length >= 2, true);
});

test("copy PNG writes synchronously and export canvas paints stat charts", () => {
  const app = readFileSync(resolve(root, "app.js"), "utf8");
  const copy = sliceBetween(app, "function copyWhiteBgPngToClipboard", "async function copyCurrentJsonToClipboard");
  assert.match(copy, /^function copyWhiteBgPngToClipboard\(\)/);
  assert.equal(copy.includes("await navigator.clipboard.write"), false);
  assert.match(copy, /new ClipboardItem\(\{ "image\/png": pngPromise \}\)/);
  assert.match(copy, /downloadPngBlob/);
  assert.equal(/img\.onload[\s\S]*clipboard\.write/.test(copy), false);
  const png = sliceBetween(app, "function buildExportCanvas", "async function exportPng");
  const stat = png.indexOf("isStatChart(bc)");
  const bar = png.indexOf("paintBarChart(");
  assert.ok(stat > 0 && bar > stat);
});

function sliceBetween(src, start, end) {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, start);
  return src.slice(i, j);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname);
    const path = resolve(root, "." + (rel === "/" ? "/index.html" : rel));
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = readFileSync(path);
      res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

test("headless Chrome loads both SVGs and exercises copy PNG", { timeout: 90000 }, async () => {
  const stemSvg = documentToSvg(stemDoc(), { scale: 2 });
  const dotsSvg = documentToSvg(dotsDoc(), { scale: 2 });
  const server = await startServer();
  const port = server.address().port;
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=/tmp/chrome-sd-v13560-${process.pid}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  let stderr = "";
  chrome.stderr.on("data", (buf) => {
    stderr += buf.toString();
  });
  try {
    const wsUrl = await waitForWs(chrome);
    const page = await connectPage(wsUrl, `http://127.0.0.1:${port}/index.html`);
    const loaded = await page.eval(
      `(() => {
        const svgs = ${JSON.stringify({ stem: stemSvg, dots: dotsSvg })};
        const out = {};
        function parse(name, svg) {
          const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          return doc.querySelector("parsererror") ? "FAIL" : "ok";
        }
        function load(name, svg) {
          return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
            const timer = setTimeout(() => resolve(name + " TIMEOUT"), 4000);
            img.onload = () => {
              const c = document.createElement("canvas");
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const ctx = c.getContext("2d");
              ctx.drawImage(img, 0, 0);
              const data = ctx.getImageData(0, 0, c.width, c.height).data;
              let ink = 0;
              for (let i = 0; i < data.length; i += 16) {
                if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) ink++;
              }
              clearTimeout(timer);
              URL.revokeObjectURL(url);
              resolve({ name, w: img.naturalWidth, h: img.naturalHeight, ink });
            };
            img.onerror = () => {
              clearTimeout(timer);
              URL.revokeObjectURL(url);
              resolve(name + " ERROR");
            };
            img.src = url;
          });
        }
        return (async () => {
          for (const name of Object.keys(svgs)) out[name + "Parse"] = parse(name, svgs[name]);
          for (const name of Object.keys(svgs)) out[name] = await load(name, svgs[name]);
          return out;
        })();
      })()`,
      true
    );
    assert.equal(loaded.stemParse, "ok");
    assert.equal(loaded.dotsParse, "ok");
    assert.equal(typeof loaded.stem, "object", JSON.stringify(loaded.stem));
    assert.equal(typeof loaded.dots, "object", JSON.stringify(loaded.dots));
    assert.ok(loaded.stem.w > 10 && loaded.stem.ink > 0, JSON.stringify(loaded.stem));
    assert.ok(loaded.dots.w > 10 && loaded.dots.ink > 0, JSON.stringify(loaded.dots));

    const painted = await page.eval(
      `(() => {
        const docs = ${JSON.stringify({ stem: stemDoc(), dots: dotsDoc(), plain: plainDoc() })};
        function inkOf(canvas) {
          const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let n = 0;
          for (let i = 0; i < data.length; i += 16) {
            if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) n++;
          }
          return n;
        }
        return (async () => {
          for (let i = 0; i < 40 && !window.__examDiagram; i++) {
            await new Promise((r) => setTimeout(r, 50));
          }
          const out = {};
          for (const name of ["plain", "stem", "dots"]) {
            window.__examDiagram.applyData(docs[name]);
            let canvas = null;
            let err = "";
            for (let i = 0; i < 30; i++) {
              try {
                canvas = window.__examDiagram.buildExportCanvas(2);
                if (inkOf(canvas) > 0) break;
              } catch (e) {
                err = String(e && e.message || e);
                break;
              }
              await new Promise((r) => setTimeout(r, 50));
            }
            out[name] = canvas
              ? { w: canvas.width, h: canvas.height, ink: inkOf(canvas), err }
              : { err: err || "no canvas" };
          }
          return out;
        })();
      })()`,
      true
    );
    for (const name of ["plain", "stem", "dots"]) {
      assert.equal(painted[name].err || "", "", name + " " + JSON.stringify(painted[name]));
      assert.ok(painted[name].ink > 0, name + " " + JSON.stringify(painted[name]));
    }

    const copied = await page.eval(
      `(() => {
        const Orig = window.ClipboardItem;
        window.ClipboardItem = function (items) {
          const png = items["image/png"];
          window.__pngIsPromise = !!(png && typeof png.then === "function");
          window.__pngPromise = window.__pngIsPromise ? png : Promise.resolve(png);
          return new Orig(items);
        };
        window.ClipboardItem.prototype = Orig.prototype;
        window.ClipboardItem.supports = Orig.supports;
        let inClick = false;
        navigator.clipboard.write = () => {
          window.__sync = inClick;
          return Promise.resolve();
        };
        return (async () => {
          window.__examDiagram.applyData(${JSON.stringify(dotsDoc())});
          inClick = true;
          document.getElementById("btnCopyPngClipboard").click();
          inClick = false;
          const blob = await window.__pngPromise;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const pngMagic = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
          return {
            sync: window.__sync,
            promise: window.__pngIsPromise,
            type: blob.type,
            size: blob.size,
            pngMagic,
            status: document.getElementById("statusHint").textContent,
          };
        })();
      })()`,
      true
    );
    assert.equal(copied.sync, true);
    assert.equal(copied.promise, true);
    assert.equal(copied.type, "image/png");
    assert.equal(copied.pngMagic, true);
    assert.ok(copied.size > 100);
    assert.match(copied.status, /PNG/);

    const downloaded = await page.eval(
      `(() => {
        navigator.clipboard.write = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
        window.showSaveFilePicker = undefined;
        window.prompt = () => "simple-diagram.png";
        HTMLAnchorElement.prototype.click = function () {
          window.__download = this.download;
        };
        document.getElementById("btnCopyPngClipboard").click();
        return (async () => {
          for (let i = 0; i < 80 && !window.__download; i++) await new Promise((r) => setTimeout(r, 50));
          return {
            download: window.__download || "",
            status: document.getElementById("statusHint").textContent,
          };
        })();
      })()`,
      true
    );
    assert.equal(downloaded.download, "simple-diagram.png");
    assert.match(downloaded.status, /下載|simple-diagram\.png/);
  } finally {
    chrome.kill("SIGKILL");
    await new Promise((r) => server.close(r));
  }
  void stderr;
});

function waitForWs(chrome) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("chrome debug port timeout")), 15000);
    const onData = (buf) => {
      const text = buf.toString();
      const m = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        chrome.stderr.off("data", onData);
        resolvePromise(m[1]);
      }
    };
    chrome.stderr.on("data", onData);
    chrome.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("chrome exited " + code));
    });
  });
}

async function connectPage(wsUrl, url) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  });
  function send(method, params, sessionId) {
    const msgId = ++id;
    return new Promise((res, rej) => {
      pending.set(msgId, { resolve: res, reject: rej });
      const packet = { id: msgId, method, params };
      if (sessionId) packet.sessionId = sessionId;
      ws.send(JSON.stringify(packet));
    });
  }
  const { targetId } = await send("Target.createTarget", { url });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params = {}) => send(method, params, sessionId);
  await call("Runtime.enable");
  await call("Page.enable");
  return {
    eval(expression, awaitPromise) {
      return call("Runtime.evaluate", {
        expression,
        awaitPromise: !!awaitPromise,
        returnByValue: true,
      }).then((result) => {
        if (result.exceptionDetails) {
          throw new Error(JSON.stringify(result.exceptionDetails));
        }
        return result.result?.value;
      });
    },
  };
}
