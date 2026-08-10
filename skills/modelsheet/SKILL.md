---
name: modelsheet
description: Query a local Modelsheet generative-media registry for image, video, or audio model capabilities, pricing, provenance, verification state, and comparisons. Use when selecting a media model for implementation, checking whether a model supports concrete output constraints, comparing documented lab pricing, or tracing a registry claim to its official source. Do not use for LLM selection.
---

# Modelsheet

Use the bundled dependency-free query script to inspect a local deterministic
`api.json`. It never fetches the network or modifies registry data.

## Query the registry

Run the script from any directory. It locates data in this order: `--data`,
`MODELSHEET_API_JSON`, a nearby `artifacts/api.json`, a nearby
`packages/registry/data/api.json`, or an installed
`@modelsheet/registry/api.json`.

```powershell
node skills/modelsheet/scripts/query.mjs counts
node skills/modelsheet/scripts/query.mjs list --modality video
node skills/modelsheet/scripts/query.mjs list --modality video --aspect-ratio 9:16 --max-duration-at-least 10 --native-audio supported
node skills/modelsheet/scripts/query.mjs show black-forest-labs/flux-3-video
node skills/modelsheet/scripts/query.mjs compare black-forest-labs/flux-3-video google/veo-3-1
```

`list` considers only `documented` records by default. Use
`--documentation-state indexed` to inspect the index or
`--documentation-state any` to include both states. Add `--full` for complete
records or `--format table` for a compact display.

Available selection flags are `--modality`, `--documentation-state`, `--lab`,
`--status`, `--pricing-state`, `--task`, `--aspect-ratio`,
`--max-duration-at-least`, `--native-audio`, `--reference-role`, `--search`,
and `--limit`. Capability flags must match one capability profile; the script
does not create a false match by combining unrelated profiles.

## Interpret results safely

- Recommend from `documented` records only. Treat `indexed` records as known
  names with sources, not capability evidence.
- Preserve `unknown`, `unsupported`, and `not_applicable` exactly. Do not turn
  omission into `false`, zero, or an empty capability.
- Treat `verification.state = "unverified"` as an explicit warning. A missing
  verification table on a legacy seed is unspecified, not proof of verification.
- Quote prices only in their recorded denomination and unit. Do not convert
  credits or extrapolate rates.
- Use each claim's `source_ids` to select matching entries from `sources` and
  include those official URLs when reporting a decision.
- If the registry lacks a required constraint, report the gap. Do not fill it
  from memory or a third-party source.

## Keep the boundary

This skill is read-only. Updating a record requires the Modelsheet contribution
workflow, official lab sources, retrieval dates, validation, and human review.
Never use this query script to claim live verification or currentness beyond the
recorded retrieval date.
