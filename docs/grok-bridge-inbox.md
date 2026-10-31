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
  subject: Keep-full-circles shipped · v13.5.29
  body: |
    Done: (PR URL filled on merge) · branch cursor/keep-full-circles-184b
    App version 13.5.29. Removed sectorKeys circle-vs-arc dedupe in
    export-svg; regression tests keep-full-circles.test.mjs.
```

