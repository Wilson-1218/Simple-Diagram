# AI Diagram Layer · AI 圖層（ABCD）

**狀態：** 已實作（v13.2）· AI 優化 **v13.5.4**· 產品名 **Simple Diagram** · MIT  
**原則：** AI 只走 **JSON document + ops**，不模擬人手 UI；現有畫布／快捷鍵／存檔／Pages 不變。

**PR：** https://github.com/Wilson-1218/Simple-Diagram/pull/1 · `cursor/ai-diagram-layer-037e` → `main`

---

## A — Schema

| 項目 | 位置 |
|---|---|
| 格式說明（中英） | [`diagram-format.md`](diagram-format.md) |
| `formatVersion: 1` | 新存檔必寫；載入缺省＝v1 |
| 範例 | `examples/cube-sketch.json`、`right-triangle.json`、`coord-sin.json` |

## B — Ops API

| 項目 | 位置 |
|---|---|
| 純函式模組 | `src/diagram/`（`applyOps`、`emptyDiagram`、…） |
| CLI | `node tools/apply-ops.mjs --in a.json --ops ops.json --out b.json` |
| 確定性 ID | 自動 `p_0001`…；或 op 內顯式 `id` |

**已覆蓋（HKDSE 立體＋座標 MVP）：**  
`addPoint` · `addSegment` · `addLabel` · `addRightAngle` · `addAngleArc`／`addReflex` · `addParallelMark`／`addEqualMark` · `addLengthLabel` · `addMidTick` · `addCircle` · `addEllipse` · `addSector` · `addFill`（含 sector/segment）· `addShape` · `addTangent`/`addRadius`/`addDiameter`/`addChord` · `alignPoints`/`distributePoints`/`equalizeSegments` · `setLayers` · `addCoordPlot` · `addCurve` · `setView` · `setMeta` · `movePoint` · `remove`（含 `type: "fill"`）

## C — AI 介面

| 介面 | 用法 |
|---|---|
| CLI | 見上；`node tools/validate-diagram.mjs <file>` |
| MCP | `node mcp/server.mjs`（stdio，無額外依賴） |

**MCP tools：** `create_diagram` · `apply_ops`（預設 validate+summarize）· `summarize_diagram` · `validate_diagram` · `load_example` · `list_ops`

Agent 手冊：[`agent-draw-playbook.md`](agent-draw-playbook.md)

Cursor 設定範例（`cwd` 改成 repo 絕對路徑）：

```json
{
  "mcpServers": {
    "simple-diagram": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "cwd": "/path/to/Simple-Diagram"
    }
  }
}
```

HTTP 略過（優先 CLI＋MCP）。

## D — Validation

| 項目 | 位置 |
|---|---|
| `validateDiagram(doc)` | `src/diagram/validate.mjs` → `{ ok, errors, warnings }` |
| 載入路徑 | `app.js` `lightValidateProject`：損壞拒開；舊檔缺 version 仍可開 |
| 測試 | `npm test`（`tests/diagram-ops.test.mjs`） |

## 人手 UI

- 「開啟」可載入 AI JSON；狀態列可顯示 `format v1`。
- **無**新編輯模式。副標 **v13.2**。

## 快速指令

```bash
npm test
node tools/apply-ops.mjs --ops examples/ops-cube.json --out /tmp/cube.json --validate
node mcp/server.mjs
```
