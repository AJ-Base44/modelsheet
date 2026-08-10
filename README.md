# Modelsheet

Modelsheet is an open-source capability registry for generative media models. It answers two practical questions: what can this model actually produce, and what does that output cost from the lab that made it?

The registry is media-shaped: image sizes, video durations, reference inputs, generated audio, delivery formats, and the pricing units that apply to those capabilities. It is not an LLM registry, does not compare token context windows or reasoning features, and does not include reseller or aggregator pricing.

The long-term differentiator is a drift feed derived from the Git history of the model records. Capability changes should be reviewable as ordinary data diffs rather than disappearing into a comparison page.

## Coverage

**Coverage: 53 models indexed, 3 documented.**

An `indexed` record establishes the official model identity and first-party source links but does not claim comparison-ready capability data. A `documented` record contains at least one real, sourced capability constraint and non-unknown lab pricing, so it can appear in capability filters and comparisons.

## How records work

Each model has one TOML file at `models/<lab>/<model>.toml`. The model is the primary entity; API identifiers are access metadata for that same model, not separate provider endpoints.

A record contains:

- official model identity and any sourced colloquial aliases;
- task-specific capability profiles, so combinations such as duration, size, aspect ratio, and reference inputs are not falsely cross-multiplied;
- a flat list of lab-published pricing charges;
- explicit conflicts when official sources disagree; and
- a source ledger with the exact official URL and retrieval date behind each claim.

`unknown`, `unsupported`, and `not_applicable` are intentionally different. Missing documentation is never converted to `false` or an empty list. See [SCHEMA.md](SCHEMA.md) for the complete contract.

## Verification states

- `verified`: a human compared the record's stated values with the cited live first-party pages. Agents and automated jobs must never assign this state.
- `unverified`: claims have official source references, but a human has not completed that comparison. This is the default for contributions and for every new record created by an automated research run.

Older records without a `[verification]` table have no recorded verification state. Consumers must display that as `not recorded`, never infer `verified`, and never treat a citation as a substitute for human verification.

## Use the data

Contributors edit TOML only. Tooling validates the source records and builds a deterministic `artifacts/api.json` for consumers. The static site reads that artifact; there is no database or backend.

After installing Node.js 22 or newer:

```powershell
npm.cmd install
npm.cmd run check
```

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SCHEMA.md](SCHEMA.md) before opening a pull request. Use only official lab documentation, schemas, pricing pages, changelogs, or release notes. Every factual claim needs a source URL and the date it was read. When in doubt, record less and use `unknown`.

## Licence

Modelsheet is released under the [MIT License](LICENSE).
