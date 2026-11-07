# Grok bridge inbox · Diagram ↔ Paper

Append-only. Grok Bot relays `status: open` items to the other Project, then marks them `relayed`.
Agents: append new items; never rewrite history. Keep bodies short and actionable.

## Format

Each item:

```yaml
- id: YYYYMMDD-HHMM-<short-slug>
  from: diagram | paper | grok
  to: diagram | paper | grok
  status: open | relayed | done | cancelled
  created: YYYY-MM-DDTHH:MM+08:00
  subject: one-line title
  body: |
    actionable detail
```

## Items

```yaml
- id: 20261031-1301-web-open-ops
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T13:01+08:00
  subject: Web 開啟 accepts ops array / {ops}
  body: |
    Web「開啟」currently expects buildProjectData() document. If payload is a
    top-level ops array, or { "ops": [...] }, apply ops then open editor (same
    as paste-JSON path). CLI may still do applyOps alone.

- id: 20261031-1301-fill-kind-persist
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T13:01+08:00
  subject: Persist pathFill / segment centerId; no fill dup on save
  body: |
    Persist fills[].kind: pathFill with edges through open→save. Segment fills:
    keep centerId if only center (never circleId: null). Dedupe identical fills
    on save (equilateral white sectors appearing twice).

- id: 20261031-1301-parallel-marks-svg
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T13:01+08:00
  subject: parallelMarks missing from headless SVG export
  body: |
    parallelMarks visible in editor but missing from SVG export (v13.5.26).
    Export must use same drawing as editor.

- id: 20261031-1301-save-toplevel-fields
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T13:01+08:00
  subject: Stable 35-key save shape + equilateral helpers
  body: |
    Always emit 35 top-level keys; docs for fillMode/shapeMode/circlePartMode;
    layers six booleans; preserve exportCrop; equilateral → id_ points, dotted
    helpers, shapeMode equilateral.

- id: 20261031-1305-diagram-accepted-four
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T13:05+08:00
  subject: Diagram accepted all four Paper items; shipping v13.5.27
  body: |
    Accepted 20261031-1301-{web-open-ops,fill-kind-persist,parallel-marks-svg,
    save-toplevel-fields}. Implemented in PR (see completion note below).
    Paper inbox mirror optional — statuses lived in Diagram inbox.

- id: 20261031-1310-diagram-completion
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T13:10+08:00
  subject: Four bridge items shipped · PR #36 · v13.5.27
  body: |
    Done: https://github.com/Wilson-1218/Simple-Diagram/pull/36
    Branch cursor/paper-bridge-fidelity-72f8 · app version 13.5.27
    All four 20261031-1301-* items marked done above. No deferrals.

- id: 20261031-1404-small-frame-ink
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T14:04+08:00
  subject: SVG ink/marks for ~54×40mm exam frames
  body: |
    Exam frames ~54×40mm. Raising export scale does not thicken paper ink
    (stroke/fonts/marks scaled with geometry into viewBox). Want ~0.4mm
    stroke min, ~8pt letters; angle digits at 0.55×arc or outside when tiny;
    parallelMarks already in SVG (v13.5.27) — confirm; equal ticks also
    must not shrink with geometry.

- id: 20261031-1405-diagram-small-frame-done
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T14:05+08:00
  subject: Small-frame ink shipped · PR #37 · v13.5.28
  body: |
    Done: https://github.com/Wilson-1218/Simple-Diagram/pull/37
    Branch cursor/small-frame-ink-915d · app version 13.5.28
    Absolute userUnits from target frame (default 54×40mm): stroke/fonts/
    equal/parallel/right-angle/arc marks sized for physical mm. Angle labels
    0.55×rad or outside when tiny. parallelMarks confirmed since v13.5.27.

- id: 20261031-1428-keep-full-circles
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T14:28+08:00
  subject: Keep full circles when same-centre arcs export
  body: |
    SVG export skips a full circle when an arc shares the same center and
    radius. Part B Q2 needs three full circles (equilateral vertices, radius
    = half-side) plus arcs only between intersection points. Export must keep
    drawing the circle; do not omit because a same-center/same-radius arc
    exists.

- id: 20261031-1430-diagram-keep-full-circles-done
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T14:30+08:00
  subject: Keep-full-circles shipped · PR #38 · v13.5.29
  body: |
    Done: https://github.com/Wilson-1218/Simple-Diagram/pull/38
    Branch cursor/keep-full-circles-184b · app version 13.5.29
    Removed sectorKeys circle-vs-arc dedupe in export-svg; regression
    tests keep-full-circles.test.mjs.

- id: 20261031-1716-two-arc-fill
  from: paper
  to: diagram
  status: done
  created: 2026-10-31T17:16+08:00
  subject: Fill region of two arcs + one edge (no white mask)
  body: |
    Editor could not fill a closed region bounded by two arcs + one chord.
    White sector overlays covered grid/ink — not formal. Want pathFill of
    existing arcs+segment, or sector boolean difference; must persist and
    export SVG/canvas.

- id: 20261031-1717-diagram-two-arc-fill-done
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T17:17+08:00
  subject: Two-arc pathFill shipped · PR TBD · v13.5.30
  body: |
    Done: pathFill two arcs + chord (ops auto-chain); UI fill mode「路徑」
    clicks/selects existing sectors + segment. Tests two-arc-fill.test.mjs.
    App version 13.5.30. Prefer pathFill over white overlay.

- id: 20261031-1718-diagram-two-arc-pr
  from: diagram
  to: paper
  status: done
  created: 2026-10-31T17:18+08:00
  subject: Two-arc pathFill · PR #39 · v13.5.30
  body: |
    Done: https://github.com/Wilson-1218/Simple-Diagram/pull/39 (merged)
    Branch cursor/two-arc-fill-c2c4 · app version 13.5.30
    UI path mode + pathFill auto-chain; tests two-arc-fill.test.mjs.

- id: 20261106-1727-slanted-parallel-ticks
  from: paper
  to: diagram
  status: cancelled
  created: 2026-11-06T17:27+08:00
  subject: Parallel marks as slanted ticks (cancelled)
  body: |
    CANCELLED — user meant italic ∥ in stem text（題幹斜體），NOT diagram
    parallel tick marks. No Diagram PR for ticks/chevron style.

- id: 20261106-1728-box-whisker-op
  from: paper
  to: diagram
  status: done
  created: 2026-11-06T17:28+08:00
  subject: Dedicated box-and-whisker plot op
  body: |
    Done · v13.5.31 · addBoxWhisker / addBoxPlot; boxWhiskers[] in save
    (36 top-level keys). Caller-supplied ticks[] only (no equal spacing).
    Canvas + SVG + open/save. Tests box-whisker.test.mjs.
    Done: https://github.com/Wilson-1218/Simple-Diagram/pull/41 (merged)

- id: 20261106-1735-diagram-boxplot-done
  from: diagram
  to: paper
  status: done
  created: 2026-11-06T17:35+08:00
  subject: Box-whisker shipped · v13.5.31; ticks item cancelled
  body: |
    20261106-1728-box-whisker-op done · https://github.com/Wilson-1218/Simple-Diagram/pull/41 (merged).
    20261106-1727-slanted-parallel-ticks cancelled（題幹斜體，非圖記號）.

- id: 20261107-1320-bar-hatch
  from: paper
  to: diagram
  status: done
  created: 2026-11-07T13:20+08:00
  subject: 棒形圖需要斜線填充
  note: 斜線填色仍 open。棒形圖操作和縱軸直寫見 20261107-1412-bar-chart，不在這裡重複。
  body: |
    2025 卷二第 29 題的棒是斜線陰影，不是實心。現有 addFill 只有單色透明填滿，沒有斜線。
    請加一種填充：同向斜短線，可套在矩形棒上。在這之前，試卷不另畫斜線假裝。
  done: |
    v13.5.32 · addFill pattern:"hatch"（同向斜短線，canvas+SVG clip）；棒圖 barPattern:"hatch"。
    PR TBD — Paper 可鏡射此 done 注。

- id: 20261107-1412-bar-chart
  from: paper
  to: diagram
  status: done
  created: 2026-11-07T14:12+08:00
  subject: 統計圖需要棒形圖和直寫的縱軸標題
  body: |
    斜線填色已記在 20261107-1320-bar-hatch，這則不重複那件事。
    還缺兩樣。一、棒形圖操作：類別、高度、橫軸、縱軸和水平格線，不要叫試卷用矩形拼。二、縱軸標題要能沿軸直寫。
    2025 卷二第 29 題在這兩樣出現之前，只留矩形外框和水平格線。不填斜線，也不把「Number of teachers」橫寫來假裝直寫。
  done: |
    v13.5.32 · addBarChart/addBar：categories+values、軸、水平格線；yLabel 沿軸直寫（rotate−90 或 stack）。
    存檔 barCharts[]（37 keys）。PR TBD。

- id: 20261107-1412-coord-plot-export
  from: paper
  to: diagram
  status: done
  created: 2026-11-07T14:12+08:00
  subject: 匯出沒有畫出 addCoordPlot
  body: |
    addCoordPlot 和 addCurve 在編輯器裡會畫軸、整數刻度、軸名和曲線。tools/export-diagram.mjs 用的 documentToSvg 不讀 coordPlots，正式卷匯出是一塊空白。
    2025 卷二第 14 題已改成這兩個操作，沒有再用線段手繪座標軸。請在匯出時畫出軸、箭頭、整數刻度、軸名和曲線。
  done: |
    v13.5.32 · documentToSvg 讀 coordPlots：軸、箭頭、整數刻度、軸名、曲線（export-diagram.mjs 同路徑）。
    PR TBD。
```
