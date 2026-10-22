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

頂欄可切換 **中｜EN**（按鈕與工具提示同步；畫布數學標籤不變）。

Toggle **中｜EN** in the top bar (buttons and tooltips follow; canvas math labels stay the same).

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

## 目前版本 / Current version（v13.5.5）

**左側兩欄網格**（頂部品牌＋繪製／構造／記號）｜**頂部 overlay**（不佔畫布高度）｜**左側情境浮層**｜**匯出 ▾**

預設：網格開、三角格、匯出隱藏點開、畫布縮放 **2×**。  
長度沿邊傾斜；標籤避線；對齊輔助（不進匯出）；離開警告僅未儲存時。  
**v13.2**：新增 AI／自動化 JSON＋ops 層（`formatVersion`、CLI、MCP、驗證）；人手畫布流程不變。  
**v13.2.1**：修復關閉的 `<dialog>`（含座標圖對話框）因 CSS `display` 而出現在頁面底部。  
**v13.2.2**：上線品牌 logo（等距立方體＋粗體 SD）與 favicon。  
**v13.3**：填色／Fill — 多透明度陰影，依序點既有頂點圍封閉區；PNG／SVG／JSON（`fills`）／ops `addFill`。  
**v13.3.1**：頂欄改 overlay、線型／填色改情境浮層；底部斑馬紋修補；填色改為再點起點完成。  
**v13.3.2**：品牌移入左側工具列頂；弧／扇、單／雙／翻面改情境浮層。  
**v13.3.3**：構造「切線」— 圓上周點＋拖曳定長；端點可再調。  
**v13.4.0**：圖形（正方／等邊／長方／等腰）、圓件（弦／直徑／半徑）、多選對齊／等距／等長、扇形／弓形填色、圖層顯示鎖定、範本擴充、快捷鍵（B／T／I 等）。  
**v13.4.1**：修復關閉網格層／頂欄「網格」後格線仍顯示（`layers.gridShow` 控制繪製；頂欄同步顯示＋吸附）。  
**v13.4.2**：AI 層優化 — sector/segment `addFill`、圖形／切線／弦徑便利 op、對齊／圖層 ops、MCP summarize、[`docs/agent-draw-playbook.md`](docs/agent-draw-playbook.md)。
**v13.5.0**：AI 模板 `insertTemplate`、HKDSE macros（`run_macro`）、eval 套件、headless SVG／PNG 匯出 CLI／MCP。  
**v13.5.1**：MIT 授權＋雙語轉載聲明（README／網頁／`?` 面板）；`package.json` `"license": "MIT"`。  
**v13.5.2**：Mensuration AI train pack（`examples/train/`，10 題 seed `20261021`）＋ eval。  
**v13.5.3**：Train case 03 — point/label D at BH∩CF（不再偏高）。
**v13.5.4**：圖形浮層改圖示網格（無文字標籤）；擴充 HKDSE 常用形（菱形／平行四邊形／等腰梯形／鳶形／直角／等腰直角／正五／正六／圓／半圓）並接 `addShape`；填色色票新增**白色**（不透明，疊在灰影上挖空）；構造還原**垂足**（點→線段正交投影）＋ `addFoot`。
**v13.5.5**：立體投影進「圖形」浮層（立方體／長方體／棱柱／圓台／錐／柱等）；模板選單收斂為組合起點（圓＋弦徑／圓＋圓心／高到底）＋自訂。

| 位置 | 內容 |
|---|---|
| **左頂：品牌** | Logo、Simple Diagram、版本號 |
| **左：繪製** | 選取、手掌、點、線段、圓弧、橢圓、扇弧、**填色**、**圖形**、標籤 |
| **左：構造** | 交點、中點、比例、水平、垂線、**垂足**、**切線**、**圓件**、座標 |
| **左：記號** | 直角、角弧、優角、平行、等長、長度 |
| **浮層：線型** | 線段／弧／橢圓／扇等工具，或選取邊時顯示 |
| **浮層：弧／扇** | 扇弧工具（或選取扇／弧）時顯示 |
| **浮層：單／雙／翻面** | 平行／等長／角弧工具（或選取對應記號）時顯示 |
| **浮層：填色** | 填色工具：模式（多邊形／扇形／弓形）＋色票 |
| **浮層：圖形／圓件／對齊** | 圖形＝平面＋立體投影圖示；對齊於選取≥2 時 |
| **頂 overlay** | 中｜EN、**模板（組合起點）**、網格／深色／**圖層**／最近、複製／復原、儲存／開啟、「匯出 ▾」、`?` |

快捷鍵（預設，可於 `?` 改）：選取 V、點 P、線 L、水平 H、圓 C、橢圓 E、扇弧 A、填色 I、圖形 B、圓件 T、中點 M、比例 R；Ctrl+Z／Y 復原重做、Ctrl+D 複製。

更多說明：[`docs/simple-diagram-features.md`](docs/simple-diagram-features.md) · 視覺風格：[`docs/simple-diagram-style.md`](docs/simple-diagram-style.md) · JSON 格式：[`docs/diagram-format.md`](docs/diagram-format.md)

---

## AI train pack / 「對著畫」評測

來源：`Mensuration-clean.pdf`（隨機 10 題，seed **20261021**）。每題含 `prompt.md`、`ops.json`、`target.svg`。說明見 [`examples/train/README.md`](examples/train/README.md)。重建：`node tools/gen-mensuration-train.mjs`。

---

## AI / Automation（JSON + ops）

| 中文 | English |
|---|---|
| AI **不**模擬滑鼠／DOM；只產生或修改 **JSON 圖檔** | AI does **not** click the UI; it edits the **JSON document** |
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
