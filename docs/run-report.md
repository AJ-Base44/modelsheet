# Modelsheet project status

- Snapshot date: 2026-08-11
- Repository: <https://github.com/AJ-Base44/modelsheet>
- Public site: <https://aj-base44.github.io/modelsheet/>

## Registry state

Modelsheet contains 53 model records: 52 documented and one indexed.

| Modality | Records |
| --- | ---: |
| Image | 18 |
| Video | 18 |
| Audio | 17 |

`documented` means a record contains at least one sourced capability constraint and non-unknown lab-direct pricing. `indexed` records establish an official identity and first-party sources without claiming comparison-ready capability data. The generated coverage block in `README.md` and the counts in `api.json` are the authoritative live totals.

Seedance 2.5 is the sole indexed record. ByteDance publishes an official model page, serving identifier, and price surface, but no model-specific API parameter contract from which Modelsheet can safely record exact capability constraints. The record preserves that gap instead of borrowing values from another Seedance model.

Verification remains separate from documentation depth. Fifty records explicitly say `verification.state = "unverified"`; the three original seed records have no recorded verification state. No record in the built registry claims `verified`.

## Shipped system

- One TOML record per official lab model, validated by `schema/source-v1.schema.json` and `scripts/validate.mjs`.
- Deterministic `api.json`, version-pinned registry output, semantic git-history drift JSON, and RSS with no wall-clock build data.
- CI validation, tests, package synchronization, static-site builds, and deploy-output checks on every pull request.
- Strict protected `main`, pull-request-only changes, required up-to-date CI, squash-only merges, and blocked force pushes/deletion.
- A detection-only watcher over first-party changelogs, release notes, `llms.txt`, and documentation. It can open issues, but cannot extract claims, write TOML, open pull requests, or merge.
- A static Astro comparison site that displays only documented records in filters and comparisons, while listing indexed records separately with text labels.
- Public latest and versioned registry/drift artifacts, RSS, and source schema on GitHub Pages. No custom domain, DNS, backend, database, auth, or runtime provider lookup is required.
- A typed, dependency-free `@modelsheet/registry` package source with ESM, CommonJS, raw JSON, TypeScript declarations, query helpers, and tests.
- A dependency-free local agent skill for querying documented capabilities, lab prices, provenance, and uncertainty.

## Integrity guarantees

- Every stated model claim carries first-party source IDs that resolve to URLs and retrieval dates in the same record.
- Lab-direct pricing only; reseller and aggregator prices are excluded.
- Unknown, unsupported, and not applicable remain distinct.
- A record cannot claim `documented` without real capability constraints and non-unknown pricing.
- Formatting-only TOML changes do not alter `api.json` or create drift events.
- The watcher treats failed, partial, or suspicious responses as failures rather than changes.
- Verification state is visible in text and is never inferred from the presence of citations.

## Deliberately human-only or future work

1. A maintainer may compare an unverified record with every cited live page and explicitly assign `verified`; agents and automation cannot do that.
2. Seedance 2.5 can become documented if ByteDance publishes a model-specific serving contract with exact parameter constraints.
3. `@modelsheet/registry` remains unpublished until the maintainer chooses an npm release cadence and performs the first release.
4. A custom domain remains optional. The GitHub Pages project URL is the complete no-cost deployment.
5. Models listed as deferred in `coverage-plan.md` are future coverage candidates, not unfinished records in the current 53-model registry.
