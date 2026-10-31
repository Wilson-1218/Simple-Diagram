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
[]
```
