# Train pack fidelity lessons / 評測包對圖經驗

When building AI「對著畫」goldens from exam PDFs, **match the printed figure**, not a simplified sketch of the same story.

從考試 PDF 做 AI 訓練金標時，要以**原圖視覺**為準，而不是「題意差不多」的簡化草圖。

---

## Why the first pass drifted / 為何初版會偏

| Cause | Example |
|---|---|
| Diagram-intent shortcuts | Case 07 used a circular **segment** fill instead of corner **DE+DC+arc EC** |
| Export gaps | `addAngleArc` / sectors existed in ops but headless SVG did not draw them → missing **140°** |
| Helper geometry leaked | `addCircle` for fill math drew **full circles** when the exam showed only arcs / a semicircle |
| Point placement vs label offset | Case 03 put D too high on CF; the floating “D” was a bad point, not only `oy` |
| Invented annotations | Length numerals / shading topology not present (or different) on the page |

---

## Ship checklist (per case) / 出貨前對圖清單

Before merging a case folder, open the PDF crop (or `*-original-*-ref.png`) beside `target.svg` and confirm:

1. **Same points / labels** present (and no extra exam-visible junk)
2. **Same degree / length annotations** (e.g. `140°`, `9 cm`, `8 cm`) — or none if the figure has none
3. **Same shaded region topology** (corner vs segment vs “outside both arcs”)
4. **Same construction** (semicircle vs full circle; quarter-arc vs whole circle; square corners)
5. **Label offsets** sit next to their points (not halfway to another vertex)

Also: regenerate SVG after every ops change (`node tools/gen-mensuration-train.mjs` or `build-train-pack.mjs`). Keep cropped **original refs** next to goldens in the store pack for regression.

---

## Practical rules / 實務規則

- Prefer **ops that the exporter can paint** (sectors for arcs, `polyArc` / `pathFill` for exam corners, angle arcs with text).
- Use `addCircle` only as geometry scaffolding when a **sector/arc** also exists so export can omit the full circle stroke.
- Do **not** invent lengths, shades, or points “for neatness.”
- Record PDF part / Q# / page in `meta.json`; RNG seed in `examples/train/index.json`.
- When a user posts generated-vs-original screenshots, treat them as acceptance tests.

---

## Tooling notes

| Tool | Role |
|---|---|
| `tools/gen-mensuration-train.mjs` | Source of truth for case ops + prompts |
| `tools/build-train-pack.mjs` | Rebuild golden/SVG/summary from `ops.json` |
| `tests/diagram-train.test.mjs` | Validate all 10 goldens on `npm test` |
| Store `media/.../ai-train-pack/*-ref.png` | Human visual diffs |

Fill kinds useful for exam fidelity: `segment`, `polyArc` (polyline + closing arc), `pathFill` (mixed line/arc edges).
