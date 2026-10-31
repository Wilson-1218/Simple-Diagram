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
```
