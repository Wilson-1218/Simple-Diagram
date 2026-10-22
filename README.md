# Simple Diagram

手繪風格立體／平面數學圖編輯器 · Hand-drawn math diagram editor（黑線、白底、數學斜體標籤）。靜態站，無需建置。

---

## 目標 / Objective

| 中文 | English |
|---|---|
| **主要目的**：用手繪方式畫簡單的數學考試圖 | **Main purpose**: draw simple math exam diagrams by hand |
| 主要面向 **HKDSE**（香港中學文憑試） | Mainly for **HKDSE** (Hong Kong Diploma of Secondary Education) |
| 更新不定時 | Updates are irregular |

產品名稱：**Simple Diagram**

---

## 注意 / Notice

| 中文 | English |
|---|---|
| **不支援移動設備**（手機／平板） | **Not supported on mobile devices** (phones / tablets) |
| 請用桌上型電腦瀏覽器，或本機開檔 | Use a **desktop** browser, or open the files locally |

---

## 線上使用 / Use online

開啟 GitHub Pages（無需下載）：

**https://wilson-1218.github.io/Simple-Diagram/**

建議 **Chrome／Edge**（桌面版）。
---

## 本機開啟 / Open locally

**方式一：直接開檔**

- 瀏覽器開啟 `index.html`
- 或單檔版 `simple-diagram-standalone.html`（無需其他檔案）

**方式二：本機伺服器（建議）**

```bash
npx --yes serve -l 5173 .
```

然後開啟 http://localhost:5173/

以 `file://` 開啟時，部分 API 可能改為下載行為。

---

## 介面語言 / UI language

左側品牌下方可切換 **中｜EN** 與 **日／夜**畫布（按鈕與工具提示同步；畫布數學標籤不變；匯出仍白底）。

Toggle **中｜EN** and **day／night** canvas under the left-rail brand (export stays white).

---

## 授權／轉載聲明 / License & attribution

**MIT License** · Copyright © 2026 **Wilson Li**（[Wilson-1218](https://github.com/Wilson-1218)）· 見 [`LICENSE`](LICENSE)。

| 中文 | English |
|---|---|
| 可自由使用、複製及二次開發 | Free to use, copy, and modify |
| 轉載或再發佈時請保留來源聲明：**Simple Diagram**（Wilson Li）及下列連結 | When redistributing or republishing, please keep attribution: **“Simple Diagram”** by Wilson Li — and the link below |

**https://github.com/Wilson-1218/Simple-Diagram**

網頁右下角與 `?` 快捷鍵面板亦有簡短聲明。

---

## 目前版本 / Current version（v13.5.21）

左側兩欄工具｜頂部選單｜情境浮層。預設：網格開、三角格、縮放 **2×**。

### 更新說明
- **v13.5.21** — 存成模板進選單；左欄 3 直行／可拖寬
- **v13.5.20** — 長度浮層；網格進圖層；日夜在 Logo 下；`?` 移除更新說明
- **v13.5.19** — Json ▾；語系在左欄；模板改僅「我的」
- **v13.5.18** — AI 說明：⊥座標對應、cube／函數填色例
- **v13.5.17** — AI 說明頁涵蓋全部 ops（含座標圖）
- **v13.5.16** — AI 說明頁補齊 addShape／fill／角弧參數
- **v13.5.15** — 改為連到 ai.html；請用 Chrome 分享分頁給 Gemini
- **v13.5.14** — 深色介面對比改善（填色色票等）
- **v13.5.12** — 可貼上 JSON；AI 說明頁 ai.html（Pages）
- **v13.5.11** — 更新說明改精簡
- **v13.5.10** — 記號／標籤預設鎖定，解鎖後可拖移
- **v13.5.9** — 可存成模板；模板內有 AI 接入說明
- **v13.5.8** — 模板選單與 AI 模板目錄一致
- **v13.5.7** — 清除只清圖形，保留網格設定
- **v13.5.6** — 修復圖形浮層底列無法點擊
- **v13.5.5** — 立體進圖形浮層；模板改為組合起點
- *更早版本…* 填色、圖層、切線、AI 繪圖／匯出、MIT 等

| 位置 | 內容 |
|---|---|
| **左頂：品牌** | Logo、Simple Diagram、版本號、**中｜EN**、**日／夜**（工具列預設 3 直行，可拖邊調寬） |
| **左：繪製** | 選取、手掌、點、線段、圓弧、橢圓、扇弧、**填色**、**圖形**、標籤 |
| **左：構造** | 交點、中點、比例、水平、垂線、**垂足**、**切線**、**圓件**、座標 |
| **左：記號** | 直角、角弧、優角、平行、等長、長度 |
| **浮層：線型** | 線段／弧／橢圓／扇等工具，或選取邊時顯示 |
| **浮層：弧／扇** | 扇弧工具（或選取扇／弧）時顯示 |
| **浮層：單／雙／翻面** | 平行／等長／角弧工具（或選取對應記號）時顯示 |
| **浮層：長度** | 長度工具／選取時：字級、隨線｜水平、文字｜尺寸｜弧括 |
| **浮層：填色** | 填色工具：模式（多邊形／扇形／弓形）＋色票 |
| **浮層：圖形／圓件／對齊** | 圖形＝平面＋立體投影圖示；對齊於選取≥2 時 |
| **頂 overlay** | **模板 ▾**（含存成模板）、**圖層**（含網格）／最近、複製／復原、**Json ▾**、「匯出 ▾」、`?` |

快捷鍵（預設，可於 `?` 改）：選取 V、點 P、線 L、水平 H、圓 C、橢圓 E、扇弧 A、填色 I、圖形 B、圓件 T、中點 M、比例 R；Ctrl+Z／Y 復原重做、Ctrl+D 複製。

更多說明：[`docs/simple-diagram-features.md`](docs/simple-diagram-features.md) · 視覺風格：[`docs/simple-diagram-style.md`](docs/simple-diagram-style.md) · JSON 格式：[`docs/diagram-format.md`](docs/diagram-format.md)

---

## AI / Automation（JSON + ops）

> **Training packs**（考試「對著畫」評測等）留在 Agent Store／Context，**不上 GitHub**。Core AI layer（ops、MCP、macros、shared catalog）仍在本 repo。

| 中文 | English |
|---|---|
| AI **不**模擬滑鼠／DOM；只產生或修改 **JSON 圖檔** | AI does **not** click the UI; it edits the **JSON document** |
| Templates 選單與 MCP `list_templates` 同源目錄 | Shared `TEMPLATE_CATALOG` in `src/diagram/templates.mjs` |
| 人手「開啟」可直接載入 AI 產出的 JSON | Human **Open** loads AI-produced JSON as usual |
| Schema：`formatVersion: 1`（缺省視為 v1） | Schema: `formatVersion: 1` (missing ⇒ v1) |

### CLI

```bash
# 空檔
node tools/apply-ops.mjs --create --out empty.json

# 套用 ops
node tools/apply-ops.mjs --ops examples/ops-cube.json --out cube.json --validate

# 驗證
node tools/validate-diagram.mjs examples/cube-sketch.json

# 匯出 SVG（PNG 需 playwright）
node tools/export-diagram.mjs --macro drawFrustum --out /tmp/frustum.svg --validate

# 測試
npm test
```

模組入口：`src/diagram/`（`applyOps`、`validateDiagram`、`emptyDiagram`、`summarizeDiagram`）。  
格式說明：[`docs/diagram-format.md`](docs/diagram-format.md)。  
Agent 手冊：[`docs/agent-draw-playbook.md`](docs/agent-draw-playbook.md)。  
範例 ops：`examples/ops-*.json`、`frustum-square-ops.json`。

### MCP（Cursor 等）

無額外 npm 依賴。在 Cursor MCP 設定加入：

```json
{
  "mcpServers": {
    "simple-diagram": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "cwd": "/absolute/path/to/Simple-Diagram"
    }
  }
}
```

| Tool | 用途 |
|---|---|
| `create_diagram` | 建立空文件 |
| `apply_ops` | 對文件套用 ops 陣列 |
| `validate_diagram` | 驗證文件 |
| `load_example` | 載入 `examples/` 內建範例 |
| `list_ops` | 列出支援的 op 名稱 |
| `list_templates` | 列出 Templates ▾ 組合目錄（與 UI 同源；`includeAll` 含 AI-only） |
| `run_macro` / `export_svg` | 高階繪圖巨集／匯出 SVG |

啟動：`npm run mcp` 或 `node mcp/server.mjs`（stdio）。

### Ops 覆蓋（HKDSE 立體＋座標 MVP）

`addPoint` · `addSegment`（含 style）· `addLabel` · `addRightAngle` · `addAngleArc`／`addReflex` · `addParallelMark`／`addEqualMark` · `addLengthLabel` · `addMidTick` · `addCircle` · `addEllipse` · `addSector` · `addCoordPlot` · `addCurve` · `setView` · `setMeta` · `movePoint` · `remove`

---

## 檔案 / Files

| 檔案 | 說明 |
|---|---|
| `LICENSE` | MIT（Copyright © 2026 Wilson Li） |
| `index.html` | 主頁（搭配 `styles.css`、`app.js`） |
| `styles.css` | 樣式 |
| `app.js` | 應用邏輯 |
| `simple-diagram-standalone.html` | 單檔可攜版 |
| `src/diagram/` | Ops／驗證（Node ESM，亦可於支援 ESM 的環境引用） |
| `tools/` | CLI：`apply-ops.mjs`、`validate-diagram.mjs` |
| `mcp/server.mjs` | MCP stdio 伺服器 |
| `examples/` | 範例 JSON／ops |
| `tests/` | `node --test` 測試 |
