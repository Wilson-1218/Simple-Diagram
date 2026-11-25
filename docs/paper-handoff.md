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

### AI 零返修出圖鐵律（v13.5.36+）

出圖 agents（含 Paper 題圖重繪、MCP／CLI）**必須**遵守：

1. **唯一 schema**：以最新 [`ai.html`](../ai.html)（v13.5.36+）為準；**勿臆造**未列名的 op。
2. **構造勿手算**：中點／比例／交點／垂足**禁止**手算浮點再 `addPoint`——必須用 `addMidpoint`、`addRatioPoint`、`addIntersection`（含 `avoidPointId`／`pick` 等消歧）、`addFoot`。僅作方向／輔助的點加 `"hidden": true`（幾何保留、不畫標記）。
3. **輸出前檢查**：
   - `addTangent`：`aId` 偏左／上、`bId` 偏右／下
   - `addLengthLabel`：優先語意 `side`（above／below／left／right）
   - `addLabel`：`ox`／`oy` 向外約 14–20px
   - 題圖說明／不綁點的文字用 `addText`／`addCaption`（`x,y,text`；可選 `align`／`bold`）——**不要**為說明文字捏造假點
   - BoxWhisker 有數字刻度時 `ticks` 用 `{pos,label}` 物件
   - 多次 `addShape` → `idPrefix` 或 `labels:false` 避免 id／標籤衝突

### 瀏覽器往返（v13.5.38+）

- **Json ▾ → 複製目前 JSON**：把現行圖檔拷到剪貼簿給 AI 來回改。
- **貼上 JSON** 可勾「追加至現有圖形／Append to current canvas」（預設關＝取代）；追加 ops／`{ops:[…]}` 時套在現圖上、一批一個復原步驟。
- **匯出 ▾ → 複製白底 PNG**（Ctrl+Shift+C）：白底 `#fff`、墨 `#111` 的 PNG 進剪貼簿。

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
| [`grok-bridge-inbox.md`](grok-bridge-inbox.md) | Live cross-project feedback channel via Grok Bot（Diagram ↔ Paper） |
| [README](../README.md) | 產品概覽、CLI／MCP、版本 |

---

## 立體、水位與 3D 直角（v13.5.41）

與 [`ai.html`](../ai.html) §9 同一契約，供 Paper 直接呼叫。省略新欄位時，幾何與 v13.5.40 相同。

| 呼叫 | 要點 |
|---|---|
| `addShape` 立體 `h` | 視覺高度（包圍盒）。省略＝只按 `w` 等比，頂點不變 |
| `pyramid`／`cone` `apexOffset:[dx,dy]` | 世界單位平移頂點 V |
| `includeBaseCenter:true` | 底心點 id＝`O`，或 `{idPrefix}O`（`K` → `KO`） |
| `drawHeight:true` | 底心到 V 的點線 |
| `cylinder`／`cone` `waterLevel` | `0<t<1`：該高度局部半徑的水平橢圓，後一半虛線、前一半實線 |
| `addRightAngle` | 預設 `mode:"2d"`（紙上小標記）。`mode:"3d"` 或 `skew:true`：邊長 `size` 的平行四邊形，頂點為 `V+s·u1`、`V+s·u1+s·u2`、`V+s·u2` |
| `add3DPolyhedron` | `vertices:{A:[x,y,z]}`、`faces`（外向逆時針）、`origin`、`scale`（預設 40）、`yawDeg`（預設 35）、`pitchDeg`（預設 20）、`idPrefix`、`labels`。正面（含輪廓）的邊實線，只屬背面的邊虛線。`idPrefix:"K"` → 點 `KA` |

頂點順序：`cuboid`／`cube` 底 A,B,C,D、頂 E,F,G,H；`pyramid` 底 A,B,C,D、頂 V；`frustum` 下 A–D、上 E–H；`tetra` A 在上、B,C,D 底；`triPrism` 前 A,B,C、後 D,E,F；`rectPrism` A–F；`cylinder` 下心 O … 上心 O′；`cone` 底心 O … 頂 V。

曲線：沒寫 `color` 的 `addCoordPlot` 線在白紙上是 `#111111`（不是白）。`label.text`（`customText` 的別名）且未寫 `kind:"formula"` 時當自訂文字，`L_1` 有下標。

```json
{ "op": "addShape", "kind": "pyramid", "x": 200, "y": 240, "w": 120, "h": 150,
  "idPrefix": "K", "apexOffset": [40, 0], "includeBaseCenter": true, "drawHeight": true }
```

```json
{ "op": "add3DPolyhedron", "origin": [280, 320], "scale": 36, "idPrefix": "K",
  "vertices": { "A": [0,0,0], "B": [2,0,0], "C": [1,0,2], "V": [0,2,0] },
  "faces": [["A","B","C"], ["A","B","V"], ["B","C","V"], ["C","A","V"]] }
```

---

## 可行區域（v13.5.42）

與 [`ai.html`](../ai.html) §10.7、§8 同一契約。省略 `feasibleRegion`／`inequalities` 時，座標圖與填色與 v13.5.41 相同。

| 呼叫 | 要點 |
|---|---|
| `addCoordPlot.feasibleRegion` | 一個區域物件；`feasibleRegions` 為陣列。兩個都給就都畫 |
| `addFeasibleRegion` | 必填 `inequalities`。`plotId` 預設最後一張座標圖 |
| `addFill` + `inequalities` | 與 `addFeasibleRegion` 相同。沒有該欄位時仍是原來的多邊形／扇形填色 |
| `pattern` | 預設 `"hatch"`，也可 `"solid"`。`hatchSpacing` 預設 8 |
| `label` | 例如 `"R"`。凸多邊形面積形心上的置中粗體文字（既有光暈；`_`／`^` 走輕量數學文字） |
| `drawBoundaries` | 預設 false。true，或某一條 `drawLine:true`，為非軸邊界加曲線 |
| `domainClip` | `[uMin, uMax, vMin, vMax]`，預設該圖 `[xmin, xmax, ymin, ymax]` |

不等式（字串或 `{a,b,op,c}`／`{expr}`）收成半平面 `A u + B v ≤ C`。`<= >= < > ≤ ≥`、一般式與斜率式、可省略的 `*`、分數 `3/2` 與 `(3/2)` 都可以。解不出的那一條只警告並跳過。從視窗矩形做 Sutherland–Hodgman 裁切；空交集不加填色。`<` `>` 仍按閉半平面填色，邊界用虛線；`<=` `>=` 用實線。x=0 與 y=0 不加曲線。鉛直邊界是曲線 `type:"vline"`。

```json
{ "op": "addCoordPlot", "id": "plot1", "ox": 260, "oy": 360, "unitPx": 36,
  "xmin": -1, "xmax": 6, "ymin": -1, "ymax": 7,
  "feasibleRegion": {
    "inequalities": ["y <= 1.5x + 3", "2x + 3y <= 22", "y >= 0"],
    "pattern": "hatch", "hatchSpacing": 8, "label": "R", "drawBoundaries": true
  } }
```

---

## 版本釘選 / Version pin

- 以 **main**／產品標籤 **v13.5.26**（穩定基線）為準；應用欄位 `version` 與 schema `formatVersion` 分開。
- 優先使用能通過**當前** `validateDiagram`／schema 的 ops；勿假設未文件化的 op 名。
- 圖檔 schema：`formatVersion: 1`（缺省視為 v1）。

---

## 一句話 / One-liner

**Simple Diagram = figure engine；Simple Paper = OCR／layout + paper schema + preview；figures = ops → validate → apply → export（crops are reference only）；read this file + `ai.html`, not Agent Store.**
