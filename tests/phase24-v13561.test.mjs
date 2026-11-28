/**
 * v13.5.61 — copy PNG and download PNG rasterize documentToSvg.
 * A stem-leaf plus a block-arrow dot pattern must load as an image, and the
 * PNG text must stay near the SVG font-size (not about 3×).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, applyOps, documentToSvg, readableInkScale } from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("APP_VERSION is 13.5.62", () => {
  assert.equal(APP_VERSION, "13.5.62");
});

function figure() {
  return applyOps(null, [
    { op: "setMeta", autoScaleText: false },
    {
      op: "addStemLeaf",
      x: 80,
      y: 40,
      fontSize: 14,
      rows: [
        { stem: "1", leaves: [2, 5, 8] },
        { stem: "2", leaves: "0 3 7" },
        { stem: "3", leaves: [1] },
      ],
    },
    {
      op: "addDotPattern",
      x: 560,
      y: 40,
      arrowStyle: "block",
      verticalAlign: "bottom",
      patterns: [{ rows: [1, 2, 3] }, { rows: [1] }, { rows: [2, 2] }],
      labels: ["A", "B'", "C"],
    },
  ]);
}

function fontSizeOf(svg, text) {
  const m = svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`));
  assert.ok(m, text);
  return Number(m[1]);
}

test("explicit size 14 is not tripled when autoScaleText is false", () => {
  function wide(auto) {
    const ops = [];
    if (auto === false) ops.push({ op: "setMeta", autoScaleText: false });
    ops.push(
      { op: "addPoint", id: "Z", x: 1200, y: 0 },
      {
        op: "addStemLeaf",
        x: 40,
        y: 80,
        fontSize: 14,
        rows: [{ stem: "1", leaves: [8] }],
      },
      {
        op: "addBoxWhisker",
        y: 220,
        min: 1,
        q1: 2,
        median: 3,
        q3: 4,
        max: 5,
        ticks: [{ pos: 3, label: "QQ" }],
        axisMin: 0,
        axisMax: 10,
      }
    );
    return applyOps(null, ops);
  }
  const off = documentToSvg(wide(false), { scale: 2 });
  const on = documentToSvg(wide(undefined), { scale: 2 });
  assert.ok(readableInkScale(1200, 200) >= 3);
  assert.ok(Math.abs(fontSizeOf(off, "8") - 28) < 0.2, fontSizeOf(off, "8"));
  assert.ok(Math.abs(fontSizeOf(on, "8") - 28) < 0.2, fontSizeOf(on, "8"));
  const qqOff = fontSizeOf(off, "QQ");
  const qqOn = fontSizeOf(on, "QQ");
  assert.ok(qqOn > qqOff * 2.5, `default font ${qqOn} vs frozen ${qqOff}`);
});

test("copy and download rasterize the SVG instead of redrawing charts", () => {
  const app = readFileSync(resolve(root, "app.js"), "utf8");
  const copy = sliceBetween(app, "function copyWhiteBgPngToClipboard", "async function copyCurrentJsonToClipboard");
  assert.match(copy, /^function copyWhiteBgPngToClipboard\(\)/);
  assert.equal(copy.includes("await navigator.clipboard.write"), false);
  assert.equal(copy.includes("buildExportCanvas"), false);
  assert.match(copy, /new ClipboardItem\(\{ "image\/png": pngPromise \}\)/);
  assert.match(copy, /downloadPngBlob/);
  assert.equal(/img\.onload[\s\S]*clipboard\.write/.test(copy), false);
  const exp = sliceBetween(app, "async function exportPng", "function svgDocumentToPngBlob");
  assert.match(exp, /svgDocumentToPngBlob\(\)/);
  assert.equal(exp.includes("buildExportCanvas"), false);
  const raster = sliceBetween(app, "function svgDocumentToPngBlob", "function downloadPngBlob");
  assert.match(raster, /image\/svg\+xml;charset=utf-8/);
  assert.match(raster, /documentToSvg\(/);
  assert.match(raster, /autoScaleText: doc\.autoScaleText !== false/);
  assert.match(raster, /fillStyle = "#ffffff"/);
  assert.match(raster, /drawImage\(img, 0, 0, w, h\)/);
  assert.match(raster, /MAX_PNG_DIM/);
  assert.match(raster, /MAX_PNG_AREA/);
  const snap = sliceBetween(app, "function buildDocSnapshotForOps", "async function openDiagramPayload");
  assert.match(snap, /autoScaleText === false \? \{ autoScaleText: false \}/);
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

test("headless Chrome PNG text stays near the SVG font size", { timeout: 90000 }, async () => {
  const doc = figure();
  const svg = documentToSvg(doc, { scale: 2, autoScaleText: false });
  assert.match(svg, /<polygon /);
  assert.ok((svg.match(/<polygon /g) || []).length >= 2);
  const eight = svg.match(
    /<text x="([0-9.]+)" y="([0-9.]+)"[^>]*font-size="([0-9.]+)"[^>]*>8</
  );
  assert.ok(eight, "leaf 8");
  const rule = [...svg.matchAll(
    /<line x1="([0-9.]+)" y1="([0-9.]+)" x2="([0-9.]+)" y2="([0-9.]+)"[^>]*stroke-width="([0-9.]+)"/g
  )].find((m) => Math.abs(Number(m[2]) - Number(m[4])) < 0.05);
  assert.ok(rule, "header rule");
  const target = {
    x: Number(eight[1]),
    y: Number(eight[2]),
    fs: Number(eight[3]),
    ruleX: (Number(rule[1]) + Number(rule[3])) / 2,
    ruleY: Number(rule[2]),
    sw: Number(rule[5]),
    svgW: Number(svg.match(/width="(\d+)"/)[1]),
    svgH: Number(svg.match(/height="(\d+)"/)[1]),
  };
  assert.ok(Math.abs(target.fs - 28) < 0.2, target.fs);

  const server = await startServer();
  const port = server.address().port;
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=/tmp/chrome-sd-v13561-${process.pid}`,
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
    const measured = await page.eval(
      `(() => {
        const svg = ${JSON.stringify(svg)};
        const doc = ${JSON.stringify(doc)};
        const target = ${JSON.stringify(target)};
        function glyphHeight(data, w, h, x, y, fs) {
          const dark = (xx, yy) => {
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
            const i = (yy * w + xx) * 4;
            return data[i] < 170 && data[i + 1] < 170 && data[i + 2] < 170;
          };
          const lim = Math.round(fs * 2.2);
          const x0 = Math.max(0, Math.round(x - lim));
          const x1 = Math.min(w - 1, Math.round(x + lim));
          const y0 = Math.max(0, Math.round(y - lim));
          const y1 = Math.min(h - 1, Math.round(y + lim));
          let sx = -1;
          let sy = -1;
          let bestD = 1e12;
          for (let yy = Math.max(y0, Math.round(y - fs)); yy <= Math.min(y1, Math.round(y + fs)); yy++) {
            for (let xx = Math.max(x0, Math.round(x - fs)); xx <= Math.min(x1, Math.round(x + fs)); xx++) {
              if (!dark(xx, yy)) continue;
              const d = (xx - x) * (xx - x) + (yy - y) * (yy - y);
              if (d < bestD) {
                bestD = d;
                sx = xx;
                sy = yy;
              }
            }
          }
          if (sx < 0) return 0;
          const seen = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1));
          const at = (xx, yy) => (yy - y0) * (x1 - x0 + 1) + (xx - x0);
          const stack = [sx, sy];
          seen[at(sx, sy)] = 1;
          let minY = sy;
          let maxY = sy;
          let n = 0;
          while (stack.length) {
            const yy = stack.pop();
            const xx = stack.pop();
            n++;
            if (yy < minY) minY = yy;
            if (yy > maxY) maxY = yy;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = xx + dx;
                const ny = yy + dy;
                if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || !dark(nx, ny)) continue;
                const k = at(nx, ny);
                if (seen[k]) continue;
                seen[k] = 1;
                stack.push(nx, ny);
              }
            }
          }
          return n > 8 ? maxY - minY + 1 : 0;
        }
        function ruleThickness(data, w, h, x, y) {
          const xx = Math.max(0, Math.min(w - 1, Math.round(x)));
          const y0 = Math.max(0, Math.round(y - 40));
          const y1 = Math.min(h - 1, Math.round(y + 40));
          let runStart = -1;
          let best = 0;
          const consider = (endY) => {
            if (runStart < 0) return;
            const runEnd = endY - 1;
            if (runStart <= y + 1 && runEnd >= y - 1) best = Math.max(best, runEnd - runStart + 1);
          };
          for (let yy = y0; yy <= y1; yy++) {
            const i = (yy * w + xx) * 4;
            const ink = data[i] < 170 && data[i + 1] < 170 && data[i + 2] < 170;
            if (ink) {
              if (runStart < 0) runStart = yy;
            } else {
              consider(yy);
              runStart = -1;
            }
          }
          consider(y1 + 1);
          return best;
        }
        async function measure(blob) {
          const bmp = await createImageBitmap(blob);
          const c = document.createElement("canvas");
          c.width = bmp.width;
          c.height = bmp.height;
          const ctx = c.getContext("2d");
          ctx.drawImage(bmp, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          const sx = c.width / target.svgW;
          const sy = c.height / target.svgH;
          const fs = target.fs * (sx + sy) / 2;
          return {
            w: c.width,
            h: c.height,
            textH: glyphHeight(data, c.width, c.height, target.x * sx, target.y * sy, fs),
            ruleT: ruleThickness(data, c.width, c.height, target.ruleX * sx, target.ruleY * sy),
            fs,
          };
        }
        return (async () => {
          const loaded = await new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
            const timer = setTimeout(() => resolve({ err: "TIMEOUT" }), 8000);
            img.onload = () => {
              clearTimeout(timer);
              URL.revokeObjectURL(url);
              resolve({ w: img.naturalWidth, h: img.naturalHeight });
            };
            img.onerror = () => {
              clearTimeout(timer);
              URL.revokeObjectURL(url);
              resolve({ err: "ERROR" });
            };
            img.src = url;
          });
          for (let i = 0; i < 40 && !window.__examDiagram; i++) {
            await new Promise((r) => setTimeout(r, 50));
          }
          window.__examDiagram.applyData(doc);
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
          inClick = true;
          document.getElementById("btnCopyPngClipboard").click();
          inClick = false;
          const copyBlob = await window.__pngPromise;
          const copy = await measure(copyBlob);
          const origCreate = URL.createObjectURL.bind(URL);
          URL.createObjectURL = (b) => {
            if (b && b.type === "image/png") window.__dlBlob = b;
            return origCreate(b);
          };
          window.showSaveFilePicker = undefined;
          window.prompt = () => "simple-diagram.png";
          HTMLAnchorElement.prototype.click = function () {
            window.__download = this.download;
          };
          document.getElementById("btnExportPng").click();
          for (let i = 0; i < 80 && !window.__dlBlob; i++) await new Promise((r) => setTimeout(r, 50));
          const download = window.__dlBlob ? await measure(window.__dlBlob) : { err: "no download blob" };
          return {
            loaded,
            sync: window.__sync,
            promise: window.__pngIsPromise,
            copy,
            download,
            downloadName: window.__download || "",
          };
        })();
      })()`,
      true
    );
    assert.equal(measured.loaded.err || "", "");
    assert.equal(measured.loaded.w, target.svgW);
    assert.equal(measured.loaded.h, target.svgH);
    assert.equal(measured.sync, true);
    assert.equal(measured.promise, true);
    for (const name of ["copy", "download"]) {
      const row = measured[name];
      assert.equal(row.err || "", "", name + " " + JSON.stringify(row));
      assert.ok(row.textH > row.fs * 0.45, name + " text " + JSON.stringify(row));
      assert.ok(row.textH < row.fs * 1.5, name + " text ~3× " + JSON.stringify(row));
      assert.ok(row.ruleT > target.sw * 0.35, name + " rule " + JSON.stringify(row));
      assert.ok(row.ruleT < target.sw * 2.2, name + " rule ~3× " + JSON.stringify(row));
    }
    assert.equal(measured.downloadName, "simple-diagram.png");
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
