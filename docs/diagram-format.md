# Diagram JSON format · 圖檔 JSON 格式

**Simple Diagram** 以 JSON 儲存整份圖稿。人手在編輯器「儲存／開啟」的檔案，與 AI／CLI／MCP 產出的檔案是**同一格式**。

AI 路徑只透過 **JSON document + ops**，不模擬 DOM／點擊。

| 中文 | English |
|---|---|
| 目前 schema：`formatVersion: 1` | Current schema: `formatVersion: 1` |
| 缺省 `formatVersion` 視為 v1（舊檔相容） | Missing `formatVersion` treated as v1 |
| 應用版本欄位 `version`（如 13.2）與格式版分開 | App `version` (e.g. 13.2) is separate from schema |

完整欄位對應 `app.js` 的 `buildProjectData()`／`applyProjectData()`。

---

## 頂層欄位 / Top-level fields

| 欄位 | 型別 | 說明 |
|---|---|---|
| `formatVersion` | number | **Schema 版**；新檔寫 `1`；載入時缺省＝v1 |
| `version` | number \| string | 應用版（如 `13.4.2`），僅資訊用 |
| `app` | string | 固定 `"simple-diagram"` |
| `name` | string | 檔名提示 |
| `savedAt` | number | 可選；儲存時間戳 |
| `points` | array | 頂點 |
| `segments` | array | 線段 |
| `labels` | array | 點標籤 |
| `rightAngles` | array | 直角記號 |
| `angleArcs` | array | 角弧／優角記號 |
| `midTicks` | array | 比例分點記號 |
| `parallelMarks` | array | 平行記號 |
| `equalMarks` | array | 等長記號 |
| `lengthLabels` | array | 長度標註 |
| `circles` | array | 圓（中心＋圓周上一點） |
| `ellipses` | array | 軸對齊橢圓 |
| `sectors` | array | 圓弧／扇形 |
| `fills` | array | 區域填色（封閉多邊形陰影） |
| `coordPlots` | array | 簡易座標圖 |
| `exportCrop` | object\|null | 匯出裁切 `{minX,minY,maxX,maxY}` |
| `sectorMode` | `"arc"`\|`"sector"` | UI 扇弧模式 |
| `nextLetter` | string | 下一個預設標籤字母 |
| `labelFontSize` | number | 預設字級（12–36） |
| `rightAngleSize` | number | 直角／角弧預設尺寸 |
| `activeParallelGroup` | 0\|1 | UI：單／雙平行 |
| `activeEqualGroup` | 0\|1 | UI：單／雙等長 |
| `activeArcGroup` | 0\|1 | UI：單／雙角弧 |
| `layers` | object | 圖層顯示／鎖定（`gridShow`/`coordsShow`/`helpersShow` + `*Lock`） |
| `gridSnap` | boolean | 網格吸附 |
| `gridMode` | `"square"`\|`"triangle"` | 網格種類 |
| `hideExportPoints` | boolean | 匯出隱藏頂點 |
| `view` | object | 相機 `{x,y,scale}`（螢幕座標平移＋縮放） |

---

## 幾何物件 / Geometry objects

### points

```json
{ "id": "A", "x": 100, "y": 200, "marker": "x" }
```

- `marker` 可選：`"x"`｜`"foot"`（垂足等）

### segments

```json
{ "id": "AB", "a": "A", "b": "B", "style": "solid" }
```

- `style`：`"solid"`｜`"dashed"`｜`"dotted"`｜`"dashdot"`（虛線常用於隱藏邊）

### labels

```json
{ "id": "lA", "pointId": "A", "text": "A", "ox": -12, "oy": -14, "size": 16 }
```

- 每個點通常一個標籤；`ox`/`oy` 為相對點的世界偏移

### rightAngles

```json
{ "id": "ra1", "vertex": "A", "arm1": "B", "arm2": "C", "size": 10 }
```

### angleArcs

```json
{ "id": "arc1", "vertex": "A", "arm1": "B", "arm2": "C", "size": 10, "group": 0, "text": "", "reflex": false }
```

- `group`：0 單弧、1 雙弧
- `reflex: true`＝優角（>180°）

### parallelMarks / equalMarks

```json
{ "id": "pm1", "segmentId": "AB", "group": 0, "side": 1 }
```

- `group`：0 單、1 雙；`side`：`1` 或 `-1`（翻面）

### lengthLabels

```json
{ "id": "ll1", "segmentId": "AB", "text": "5", "side": 1 }
```

### midTicks

```json
{ "id": "mt1", "segmentId": "AB", "pointId": "P" }
```

### circles

```json
{ "id": "c1", "centerId": "O", "throughId": "A", "style": "solid" }
```

### ellipses

```json
{ "id": "e1", "centerId": "O", "rxId": "Rx", "ryId": "Ry", "style": "solid", "backDashed": true }
```

### sectors

```json
{ "id": "sec1", "centerId": "O", "startId": "A", "endId": "B", "style": "solid", "mode": "arc" }
```

- `mode`：`"arc"`｜`"sector"`

### fills

```json
{ "id": "f1", "kind": "polygon", "pointIds": ["A", "B", "C", "D"], "color": "#666666", "opacity": 0.2 }
{ "id": "f2", "kind": "sector", "centerId": "O", "startId": "A", "endId": "B", "color": "#666666", "opacity": 0.2 }
{ "id": "f3", "kind": "segment", "circleId": "c1", "startId": "P", "endId": "Q", "opacity": 0.2 }
```

- `kind`：`polygon`（預設）｜`sector`｜`segment`（弓形）
- 多邊形：依既有頂點順序（≥3）；扇形：圓心＋兩端點；弓形：圓＋弦兩端
- `opacity` 0–1；繪於線段／標籤之下
- UI 色票：灰 10／20／35／50% 與藍灰約 22%（`#6b8799`）

### coordPlots

```json
{
  "id": "plot1",
  "ox": 280, "oy": 260, "unitPx": 40,
  "xmin": -2, "xmax": 6, "ymin": -2, "ymax": 6,
  "axisLabelX": "x", "axisLabelY": "y",
  "showOrigin": true, "showTicks": true, "showTickLabels": true,
  "xAngleUnit": "rad",
  "angleAxisOn": false,
  "curves": [
    {
      "id": "sin1",
      "type": "sin",
      "params": { "A": 1, "B": 1, "C": 0, "D": 0 },
      "label": { "show": true, "kind": "formula", "formulaMode": "algebraic", "t": 0.55, "n": 0.55 }
    }
  ]
}
```

**曲線 `type`：** `line`｜`quad`｜`log`｜`ln`｜`exp`｜`circle`｜`sin`｜`cos`｜`tan`

| type | 主要 params |
|---|---|
| line | `m`, `c` |
| quad | `a`, `b`, `c` |
| log | `a`, `base` |
| ln / exp | `a`；（exp 另有 `b`） |
| circle | `circleForm`: `general`\|`standard`\|`center`；`D,E,F` 或 `h,k,r` |
| sin/cos/tan | `A`, `B`, `C`, `D`；三角參數單位見 plot 的 `xAngleUnit` |

---

## 範例檔 / Examples

| 檔案 | 內容 |
|---|---|
| [`examples/cube-sketch.json`](../examples/cube-sketch.json) | 立方體線框（含虛線隱藏邊） |
| [`examples/right-triangle.json`](../examples/right-triangle.json) | 直角三角形＋長度 |
| [`examples/coord-sin.json`](../examples/coord-sin.json) | 座標軸＋ sin 曲線 |
| [`examples/ops-cube.json`](../examples/ops-cube.json) | 以 ops 重建立方體的指令陣列 |
| [`examples/ops-right-triangle.json`](../examples/ops-right-triangle.json) | 直角三角形＋填色 ops |
| [`examples/ops-circle-tangent.json`](../examples/ops-circle-tangent.json) | 圓＋半徑／切線／弦／直徑／弓形填色 |
| [`examples/ops-shapes-align.json`](../examples/ops-shapes-align.json) | 常用圖形＋對齊 |

驗證：

```bash
node tools/validate-diagram.mjs examples/cube-sketch.json
```

---

## Ops API（摘要）

純函式：`applyOps(doc, ops[]) → doc`（見 `src/diagram/`）。

常用 op：`addPoint`、`addSegment`、`addLabel`、`addRightAngle`、`addAngleArc`／`addReflex`、`addParallelMark`、`addEqualMark`、`addLengthLabel`、`addCircle`、`addEllipse`、`addSector`、`addFill`（polygon｜sector｜segment）、`addShape`、`addTangent`／`addRadius`／`addDiameter`／`addChord`、`alignPoints`／`distributePoints`／`equalizeSegments`、`addCoordPlot`、`addCurve`、`setView`、`setMeta`／`setLayers`、`movePoint`、`remove`。詳見 [`agent-draw-playbook.md`](agent-draw-playbook.md)。

CLI：

```bash
node tools/apply-ops.mjs --ops examples/ops-cube.json --out /tmp/cube.json --validate
```

詳見 README「AI / Automation」與 [`docs/ai-diagram-layer.md`](ai-diagram-layer.md)（Agent Store 同步副本）。
