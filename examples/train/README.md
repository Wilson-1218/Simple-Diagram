# AI train pack — Mensuration「對著畫」

Ten diagram-worthy items randomly sampled from **`Mensuration-clean.pdf`** (Agent Store / repo media).

| | |
|---|---|
| **RNG seed** | `20261021` |
| **Source PDF** | `/cursor/stores/self/media/simple-diagram/Mensuration-clean.pdf` |
| **Count** | 10 (Part A ×5 + Part B ×5) |

## Cases

See `index.json` for ids. Each folder:

| File | Role |
|---|---|
| `prompt.md` | ZH+EN draw task (diagram intent; calc optional) |
| `meta.json` | PDF part / Q# / page / seed |
| `ops.json` | Golden ops |
| `golden.json` | Document after `applyOps` |
| `target.svg` | Headless export |
| `summary.json` | Soft-check counts |

## Rebuild goldens

```bash
node tools/gen-mensuration-train.mjs   # regenerate all from embedded specs
# or refresh SVG/summary only:
node tools/build-train-pack.mjs
```

Per case:

```bash
node tools/export-diagram.mjs --ops examples/train/01-tri-ade-abc-ratio/ops.json \
  --out /tmp/out.svg --validate --summary
```

## Eval

```bash
npm test
```

`tests/diagram-train.test.mjs` validates every case: ops apply cleanly, `validateDiagram` ok, SVG non-empty.

## Fidelity

Goldens must **visually match** exam figures (not simplified intent sketches). Checklist + lessons: [`docs/train-pack-fidelity-lessons.md`](../../docs/train-pack-fidelity-lessons.md). Keep cropped original refs under the Agent Store pack for regression.

No human practice UI — AI / ops layer only.
