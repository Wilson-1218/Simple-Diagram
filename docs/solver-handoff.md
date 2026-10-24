# Solver / Simple Solution handoff · 解題上層對接

給 **Simple Solution**（或其他解題／solution agent）的整合說明。  
本檔在 **GitHub** 公開；對接時以本 repo 為準，**不要**依賴其他 Cursor Project 的 Agent Store。

**Audience:** solution agents / orchestrators that produce step-by-step answers and call Simple Diagram only for figures.

---

## 角色分工 / Role split

| 產品 | 職責 |
|---|---|
| **Simple Diagram**（本 repo） | 出圖引擎：圖檔 JSON、`ops`、驗證、`applyOps`、匯出 PNG／SVG、考試圖風格 |
| **Simple Solution**（消費端） | 解題 orchestrator、**solution JSON**、步驟文案、唯讀渲染；（之後）動畫／reveal |

- Diagram **穩定版**（v13.5.26+）：勿大改人手 UI；解題產品只透過 JSON／ops／CLI／MCP 調用。
- Solution **不要**複製畫布邏輯；每步需要的圖改寫成 Diagram ops／doc，再驗證與套用。

---

## 正規 URL / Canonical URLs

| 用途 | URL |
|---|---|
| GitHub repo | https://github.com/Wilson-1218/Simple-Diagram |
| Pages 主 App | https://wilson-1218.github.io/Simple-Diagram/ |
| Pages AI ops 說明 | https://wilson-1218.github.io/Simple-Diagram/ai.html |
| 本對接說明（raw／blob） | [`docs/solver-handoff.md`](https://github.com/Wilson-1218/Simple-Diagram/blob/main/docs/solver-handoff.md) |

---

## 如何出圖 / How to produce figures

建議管線（與人手／AI 路徑一致）：

1. **產出 ops**（陣列，或 `{ "ops": [...] }`），必要時再包成完整圖檔（含 `formatVersion` 等）。
2. **驗證**：`validateDiagram`／`node tools/validate-diagram.mjs`；或 `apply-ops` 時加 `--validate`。
3. **套用**：`applyOps`／`node tools/apply-ops.mjs --ops … --out … --validate`。
4. **載入／預覽（可選）**：Pages／本機 App → **Json ▾ → 貼上 JSON**（貼 ops 或完整圖檔）。
5. **匯出**：App「匯出 ▾」或 CLI `node tools/export-diagram.mjs`（SVG；PNG 另見 README／playwright 說明）→ 嵌進 solution 渲染器。

瀏覽器路徑詳見 [`ai.html`](https://wilson-1218.github.io/Simple-Diagram/ai.html)（讀頁 → 產出 JSON → 貼上）。頁內**沒有**原生聊天。

### CLI / MCP（已有文件；勿發明工具名）

詳情與工具表見 [README · AI / Automation](../README.md#ai--automationjson--ops)、[`ai-diagram-layer.md`](ai-diagram-layer.md)、[`agent-draw-playbook.md`](agent-draw-playbook.md)。

- CLI：`tools/apply-ops.mjs`、`tools/validate-diagram.mjs`、`tools/export-diagram.mjs`
- MCP：`mcp/server.mjs`（stdio）；工具名以 README／playbook 為準（如 `create_diagram`、`apply_ops`、`validate_diagram`、`list_ops`、`list_templates`、`run_macro`、`export_svg` 等）
- 模組：`src/diagram/`（`applyOps`、`validateDiagram`、`emptyDiagram`、…）

---

## 不要做什麼 / What NOT to do

| 不要 | 原因 |
|---|---|
| 爬取／依賴其他 Cursor **Agent Store** | 對接契約以本 GitHub repo 為準 |
| 模擬 UI 滑鼠點擊／DOM | AI 路徑只走 JSON＋ops |
| Fork／重寫畫布渲染邏輯 | 用現有 validate／applyOps／匯出 |
| 把 **train pack**／試卷金標推上 GitHub | 訓練／評測資料留在各自 Agent Store |

---

## 建議的 solution 文件形狀（極簡草稿）

消費端自訂 schema；下列僅便於對接，**非**本 repo 的正式 schema。

```json
{
  "formatVersion": 1,
  "problem": "題幹文字…",
  "steps": [
    {
      "id": "s1",
      "text": "步驟說明（可用 Markdown）",
      "diagram": {
        "ops": [
          { "op": "addPoint", "id": "A", "x": 200, "y": 200 },
          { "op": "addPoint", "id": "B", "x": 400, "y": 200 },
          { "op": "addSegment", "a": "A", "b": "B" }
        ]
      }
    },
    {
      "id": "s2",
      "text": "…",
      "diagram": {
        "doc": { "formatVersion": 1, "app": "simple-diagram", "points": [], "segments": [] }
      }
    }
  ],
  "answer": "最終答案…",
  "animation": null,
  "reveal": null
}
```

- `diagram.ops`：優先；經 validate → applyOps 得到圖檔，再匯出 PNG／SVG。
- `diagram.doc`：已是完整圖檔時，欄位須符合 [`diagram-format.md`](diagram-format.md)（`formatVersion: 1`）。
- `animation`／`reveal`：預留給之後短片／逐步顯現；第一期可 `null` 或省略。

---

## 既有文件指標 / Pointers

| 文件 | 用途 |
|---|---|
| [`ai.html`](../ai.html)（Pages） | 完整 ops 指南（瀏覽器／Gemini） |
| [`diagram-format.md`](diagram-format.md) | 圖檔 JSON schema |
| [`ai-diagram-layer.md`](ai-diagram-layer.md) | AI 圖層（schema／ops／CLI／MCP／驗證） |
| [`simple-diagram-style.md`](simple-diagram-style.md) | 考試圖視覺風格 |
| [`agent-draw-playbook.md`](agent-draw-playbook.md) | Agent 繪圖手冊 |
| [README](../README.md) | 產品概覽、CLI／MCP、版本 |

---

## 版本釘選 / Version pin

- 以 **main**／產品標籤 **v13.5.26**（穩定基線）為準；應用欄位 `version` 與 schema `formatVersion` 分開。
- 優先使用能通過**當前** `validateDiagram`／schema 的 ops；勿假設未文件化的 op 名。
- 圖檔 schema：`formatVersion: 1`（缺省視為 v1）。

---

## 匯出嵌入 / Export for embedding

- App：**匯出 ▾** → PNG／SVG（匯出仍為白底考試圖風格）。
- CLI：見 README（例如 `export-diagram.mjs` → SVG）。
- Solution 渲染器應嵌**匯出圖**（或已 validate 的 doc 預覽），不要依賴人手編輯器狀態。

---

## 一句話 / One-liner

**Simple Diagram = figures；Simple Solution = solution JSON + steps；call ops → validate → apply → export；read this file + `ai.html`, not Agent Store.**
