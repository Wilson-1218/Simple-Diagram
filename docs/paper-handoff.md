# Paper / Simple Paper handoff · 試卷還原對接

給 **Simple Paper**（試卷 PDF → OCR → 可編輯電子試卷）的整合說明。  
本檔在 **GitHub** 公開；對接時以本 repo 為準，**不要**依賴其他 Cursor Project 的 Agent Store。

**Audience:** paper／OCR／layout agents that digitize exam PDFs and call Simple Diagram only to **redraw** in-question figures（not final cropped bitmaps）.

> **See also:** [`solver-handoff.md`](solver-handoff.md) — related but different product（**Simple Solution**／解題 agents · **paused**／暫緩）. Do not expand solver docs here.

---

## 產品 / Product

| 中文 | English |
|---|---|
| 把數學題目 PDF（掃描／數位）經 OCR／版面理解，還原成**可編輯**的結構化電子試卷 | Digitize／restore math exam PDFs into a **structured, editable** electronic paper |
| 題中幾何／示意圖以 **Simple Diagram ops** **重繪**；**不要**把裁切位圖當最終圖 | **Redraw** in-question figures via Diagram **ops**；cropped bitmaps are **not** the final figure |
| 目標是可再編輯的電子格式，不是只做 PDF 再輸出 | Editable electronic format — not PDF-in／PDF-out only |

---

## 角色分工 / Role split

| 產品 | 職責 |
|---|---|
| **Simple Diagram**（本 repo） | **Figure engine**：圖檔 JSON、`ops`、驗證、`applyOps`、匯出 PNG／SVG、考試圖風格 |
| **Simple Paper**（消費端） | **OCR／layout**、**paper schema**、組版／預覽／assembly；圖區塊輸出為 Diagram ops／doc |

- Diagram **穩定版**（v13.5.26+）：勿大改人手 UI；Paper 只透過 JSON／ops／CLI／MCP 調用。
- Paper **不要**複製畫布邏輯；每題圖改寫成 Diagram ops／doc，再驗證與套用。

---

## 正規 URL / Canonical URLs

| 用途 | URL |
|---|---|
| GitHub repo | https://github.com/Wilson-1218/Simple-Diagram |
| Pages 主 App | https://wilson-1218.github.io/Simple-Diagram/ |
| Pages AI ops 說明 | https://wilson-1218.github.io/Simple-Diagram/ai.html |
| 本對接說明（blob） | [`docs/paper-handoff.md`](https://github.com/Wilson-1218/Simple-Diagram/blob/main/docs/paper-handoff.md) |

---

## 圖如何掛上試卷 / How figures attach

建議（與人手／AI 出圖路徑一致）：

1. **每圖一份** `ops`（陣列或 `{ "ops": [...] }`），或完整 diagram **doc**（含 `formatVersion` 等）。
2. **驗證**：`validateDiagram`／`node tools/validate-diagram.mjs`；或 `apply-ops` 時加 `--validate`。
3. **套用**：`applyOps`／`node tools/apply-ops.mjs --ops … --out … --validate`。
4. **匯出預覽**：App「匯出 ▾」或 CLI `node tools/export-diagram.mjs` → **PNG／SVG** 嵌進 paper 預覽／組版。
5. **原始裁切**（`sourceCrop`）：可選，**僅作對照／人工校正**；不是最終圖。

瀏覽器路徑詳見 [`ai.html`](https://wilson-1218.github.io/Simple-Diagram/ai.html)。頁內**沒有**原生聊天。

### CLI / MCP（已有文件；勿發明工具名）

詳情見 [README · AI / Automation](../README.md#ai--automationjson--ops)、[`ai-diagram-layer.md`](ai-diagram-layer.md)、[`agent-draw-playbook.md`](agent-draw-playbook.md)。

- CLI：`tools/apply-ops.mjs`、`tools/validate-diagram.mjs`、`tools/export-diagram.mjs`
- MCP：`mcp/server.mjs`（stdio）；工具名以 README／playbook 為準
- 模組：`src/diagram/`（`applyOps`、`validateDiagram`、`emptyDiagram`、…）

---

## 建議的 paper schema（極簡草稿）

消費端自訂；下列僅便於對接，**非**本 repo 的正式 schema。

```json
{
  "formatVersion": 1,
  "meta": {
    "title": "樣例練習卷",
    "year": 2026,
    "paper": "Paper 1"
  },
  "items": [
    {
      "id": "q1",
      "stem": "題幹文字（可用 Markdown）…",
      "choices": ["A …", "B …"],
      "marks": 3,
      "figures": [
        {
          "id": "q1-f1",
          "caption": "圖一",
          "ops": [
            { "op": "addPoint", "id": "A", "x": 200, "y": 200 },
            { "op": "addPoint", "id": "B", "x": 400, "y": 200 },
            { "op": "addSegment", "a": "A", "b": "B" }
          ],
          "sourceCrop": null
        },
        {
          "id": "q1-f2",
          "doc": {
            "formatVersion": 1,
            "app": "simple-diagram",
            "points": [],
            "segments": []
          }
        }
      ]
    }
  ]
}
```

- `figures[].ops`：優先；validate → applyOps → 匯出 PNG／SVG。
- `figures[].doc`：已是完整圖檔時，欄位須符合 [`diagram-format.md`](diagram-format.md)（`formatVersion: 1`）。
- `sourceCrop`：可選；原始裁切路徑／資料 URI **僅參考**，勿當最終圖。
- `choices`／`marks`／`caption`：可選。

---

## 管線草稿 / Pipeline sketch

```text
PDF
  → pages（影像／文字層）
  → OCR + block detection（題界、圖界、選項…）
  → paper JSON（meta + items）
  → 每圖：生成／修 Diagram ops｜doc → validate → applyOps → 匯出預覽
  → 組版／唯讀或薄編輯預覽
```

第一期可半自動：OCR＋人工校正題界；圖可「對照原圖＋人工／AI 出 ops」再驗證套用。

---

## 版權 / Copyright

| 要 | 不要 |
|---|---|
| 公開 GitHub 只用**自有／授權**樣例 | **不要**把受版權的完整歷屆試卷全文推上公開 GitHub |
| 敏感語料／訓練包留在**私有**或 **Agent Store** | 不要把大量掃描 PDF／金標包當公開資產 |

本 repo（Simple Diagram）的 MIT 授權**不**涵蓋第三方試卷內容。

---

## 不要做什麼 / What NOT to do

| 不要 | 原因 |
|---|---|
| 爬取／依賴其他 Cursor **Agent Store** | 對接契約以本 GitHub repo 為準 |
| 模擬 Diagram UI 滑鼠／DOM | AI 路徑只走 JSON＋ops |
| Fork／重寫畫布渲染邏輯 | 用現有 validate／applyOps／匯出 |
| 把裁切位圖當最終圖 | 最終圖＝重繪後的 Diagram 匯出 |
| 擴寫 Simple Solution 解題產品文件 | Solution **暫緩**；僅見 [`solver-handoff.md`](solver-handoff.md) 一行「paused」 |

---

## 既有文件指標 / Pointers

| 文件 | 用途 |
|---|---|
| [`ai.html`](../ai.html)（Pages） | 完整 ops 指南 |
| [`diagram-format.md`](diagram-format.md) | 圖檔 JSON schema |
| [`ai-diagram-layer.md`](ai-diagram-layer.md) | AI 圖層（schema／ops／CLI／MCP／驗證） |
| [`simple-diagram-style.md`](simple-diagram-style.md) | 考試圖視覺風格 |
| [`solver-handoff.md`](solver-handoff.md) | 相關但不同產品（解題／Solution · **paused**） |
| [README](../README.md) | 產品概覽、CLI／MCP、版本 |

---

## 版本釘選 / Version pin

- 以 **main**／產品標籤 **v13.5.26**（穩定基線）為準；應用欄位 `version` 與 schema `formatVersion` 分開。
- 優先使用能通過**當前** `validateDiagram`／schema 的 ops；勿假設未文件化的 op 名。
- 圖檔 schema：`formatVersion: 1`（缺省視為 v1）。

---

## 一句話 / One-liner

**Simple Diagram = figure engine；Simple Paper = OCR／layout + paper schema + preview；figures = ops → validate → apply → export（crops are reference only）；read this file + `ai.html`, not Agent Store.**
