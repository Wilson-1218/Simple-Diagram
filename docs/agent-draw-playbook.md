# Agent draw playbook · AI 繪圖手冊

**Simple Diagram** agents build figures via **JSON document + ops** only — never by clicking the UI.

| 中文 | English |
|---|---|
| 產物＝可「開啟」的 `.json` | Output = editor-openable `.json` |
| 一次 `apply_ops` 塞多步 | Batch many ops in one `apply_ops` |
| 先點／線／圓，再記號／填色 | Points → edges → circles → marks/fills |
| 出錯讀 `hint` 改該步 op | On error, fix the op named in `hint` |

Schema: [`diagram-format.md`](diagram-format.md) · Module: `src/diagram/` · MCP: `mcp/server.mjs`

---

## Recommended loop / 建議流程

1. `create_diagram` (or start from `null` doc in `apply_ops`)
2. One `apply_ops` with the full construction list; keep **`validate` + `summarize` on** (MCP defaults)
3. If `validation.ok` is false → fix refs / kinds → re-apply from last good doc (or rebuild)
4. Write file: `node tools/apply-ops.mjs --ops … --out … --validate`
5. Human opens the JSON in the editor / Pages

CLI:

```bash
node tools/apply-ops.mjs --ops examples/ops-right-triangle.json --out /tmp/tri.json --validate
node tools/validate-diagram.mjs /tmp/tri.json
```

---

## Coordinate tips / 座標

- World coords; **+y is down** (canvas). Place “up” with smaller `y`.
- Prefer explicit point `id`s (`A`,`B`,`O`) so later ops stay readable.
- Hidden 3D edges: `style: "dashed"`; construction: `"dotted"`.

---

## High-value ops (v13.4.2+)

| Need | Op |
|---|---|
| Common exam shapes | `addShape` (plane kinds + solids `cube`\|`cuboid`\|`rectPrism`\|`frustum`\|`tetra`\|`pyramid`\|`triPrism`\|`cylinder`\|`cone`) |
| Foot of perpendicular | `addFoot` (`pointId` + `segmentId` or `a`/`b`) |
| Circle tangent / radius / diameter / chord | `addTangent` · `addRadius` · `addDiameter` · `addChord` |
| Polygon / sector / segment shade | `addFill` with `kind` |
| Layer show/lock | `setLayers` / `setMeta.layers` |
| Align / distribute / equal length | `alignPoints` · `distributePoints` · `equalizeSegments` |
| Templates | Load `examples/*` or copy ops fixtures (`ops-*.json`, `frustum-square-ops.json`) |

UI-only (no dedicated op — approximate with points/segments/movePoint): live multi-select drag, keyboard shortcuts, export crop painting.

---

## Fill kinds

```json
{ "op": "addFill", "kind": "polygon", "pointIds": ["A","B","C"], "opacity": 0.2 }
{ "op": "addFill", "kind": "sector", "centerId": "O", "startId": "A", "endId": "B", "opacity": 0.2 }
{ "op": "addFill", "kind": "segment", "circleId": "c1", "startId": "P", "endId": "Q", "opacity": 0.2 }
{ "op": "addFill", "kind": "polygon", "pointIds": ["D","E","F"], "color": "#ffffff", "opacity": 1 }
```

Later fills paint on top. Opaque white (`#ffffff`, `opacity: 1`) punches out shaded regions for exam-style composite shading.

---

## MCP tools

| Tool | Use |
|---|---|
| `create_diagram` | Empty doc |
| `apply_ops` | Main path; returns `doc` + `validation` + `summary` by default |
| `summarize_diagram` | Counts/ids without full geometry |
| `validate_diagram` | Standalone check |
| `load_example` | Bundled doc or ops array |
| `list_ops` | Names + arg catalog |

---

## Fixtures

| File | What |
|---|---|
| `examples/ops-right-triangle.json` | Right △ + fill |
| `examples/ops-circle-tangent.json` | Circle + radius/tangent/chord/diameter |
| `examples/ops-shapes-align.json` | `addShape` + align |
| `examples/frustum-square-ops.json` | Solid frustum projection |
| `examples/ops-cube.json` | Cube wireframe |


## v13.5 — templates, macros, export

| Need | How |
|---|---|
| Templates ▾ combo (shared catalog) | MCP `list_templates` → same ids as UI: `circleGeom`, `circleCenter`, `altBase`. Insert: `{ "op": "insertTemplate", "id": "circleGeom" }` |
| Plane / solid single figures | Prefer Shape UI or `{ "op": "addShape", "kind": "frustum", … }`. AI-only template ids: `list_templates` with `includeAll:true` (still accepted by `insertTemplate`) |
| One-shot HKDSE macro | MCP `run_macro` or `node tools/export-diagram.mjs --macro drawFrustum --out out.svg` |
| Macros | `drawRightTriangle`, `drawFrustum`, `drawCircleWithTangent`, `drawCuboid`, `drawCube` |
| Export SVG/PNG | `node tools/export-diagram.mjs --in doc.json --out out.svg` (PNG needs playwright) |
| MCP | `list_templates`, `run_macro`, `export_svg` |
| Catalog source | `src/diagram/templates.mjs` (`TEMPLATE_CATALOG` + specs). Browser embed: `node tools/embed-templates.mjs` |

```bash
node tools/export-diagram.mjs --macro drawRightTriangle --params '{"a":160,"b":120}' --out /tmp/tri.svg --validate
node tools/export-diagram.mjs --ops examples/frustum-square-ops.json --out /tmp/fr.svg --validate
npm test   # includes HKDSE eval suite
```

Demo fixtures: `examples/eval-out/demo-right-triangle.*`, `demo-frustum.*`.
