# ADR 0001: Model-first records and detection-only watching

- Status: Accepted
- Date: 2026-08-09

## Context

Modelsheet describes generative media models rather than commercial reseller endpoints. Its durable value comes from source-backed capability records and from a drift feed derived from their Git history.

Provider endpoints, reseller aliases, and reseller prices change independently and would multiply records for the same underlying model. Automatically interpreting provider pages would also require lab-specific HTML parsers whose silent failures could look like real capability removals.

## Decision

The primary entity is the model. Each official model has one TOML record. API identifiers are metadata on that model; there is no inheritance, `base_model`, provider-offering entity, or cross-provider equivalence layer.

Pricing records only the model lab's own published charge. Reseller and aggregator prices are outside the registry even when they are the easiest public prices to find.

Modelsheet will not implement capability or pricing adapters for provider HTML. The scheduled watcher is detection-only: it hashes maintained official pages and reports a changed page for human review. It never extracts values, edits TOML, opens a pull request, or auto-merges.

## Consequences

- A model has one stable history, so capability diffs remain legible.
- The registry does not answer where a reseller offers a model or what that reseller charges.
- Missing lab pricing stays explicitly unknown.
- Page changes create review work rather than speculative data changes.
- Failed or partial fetches cannot erase claims, because watcher failures are not treated as content changes.
- A human remains responsible for interpreting a changed source and deciding whether the record should change.
