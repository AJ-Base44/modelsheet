# Modelsheet completion report

- Snapshot date: 2026-08-10
- Repository: <https://github.com/AJ-Base44/modelsheet>
- Main completion commit: `c9f0dc2`

## Registry state

Modelsheet contains 53 model records: 13 documented and 40 indexed.

| Modality | Records |
| --- | ---: |
| Image | 18 |
| Video | 18 |
| Audio | 17 |

`documented` means the record contains at least one sourced capability constraint and non-unknown lab pricing. `indexed` means the official model identity and first-party source links are recorded, but the model is not yet comparison-ready. The complete model inventory and source plan are in [coverage-plan.md](coverage-plan.md).

Verification remains deliberately conservative. Fifty records explicitly say `verification.state = "unverified"`; the three original seed records have no recorded verification state. No record in the built data claims `verified`. Consumers display that distinction instead of inferring confidence from the presence of a citation.

## Completed work

- The source contract is documented in `SCHEMA.md` and enforced by `schema/source-v1.schema.json` plus `scripts/validate.mjs`. Unknown keys, duplicate IDs, missing evidence, unresolved pricing profiles, and false `documented` claims fail validation.
- `scripts/build.mjs` emits deterministically ordered `artifacts/api.json` without a wall-clock timestamp and generates the README coverage block from the artifact counts.
- CI installs, validates, tests, checks generated coverage, builds the data, checks the typed package, builds the site, and tests the deploy output. `main` is protected by a strict required `validate-build-test` check, pull-request-only changes, blocked force pushes/deletion, and squash-only merging.
- The hash-only watcher monitors 14 first-party changelog, release-note, `llms.txt`, or documentation URLs. It opens an issue on a safe content-hash change and never extracts values, edits TOML, opens a pull request, or merges anything.
- The Astro site separates the 13 documented records from the 40 indexed records, exposes capability filtering and comparison, and labels verification state in text. It reads generated static artifacts only; there is no backend, database, or runtime provider lookup.
- The Git-derived drift pipeline emits deterministic `drift.json` and `drift.rss.xml` artifacts. The current artifact contains 117 semantic model events with exact field paths, before/after values, commit metadata, and no formatting-only events. The site includes a searchable drift page and RSS discovery metadata.
- Public-output generation includes latest and version-pinned registry and drift JSON, RSS, and the source JSON Schema. Contract versioning is recorded in [decision 0002](decisions/0002-versioning-and-distribution.md).
- `packages/registry` is a publish-ready, typed `@modelsheet/registry` package with ESM, CommonJS, raw JSON, query helpers, tests, and data-sync checks. It has not been published to npm.
- `skills/modelsheet` is a dependency-free, read-only agent skill for querying documented capabilities, prices, provenance, and verification state from the local artifact.
- GitHub Pages is live at <https://aj-base44.github.io/modelsheet/>. No custom domain, `CNAME`, DNS work, Vercel deployment, or domain purchase is part of the project.

No model TOML record was changed by the completion work described above.

## Evidence at this snapshot

- The full root check passed all 53 records and 39 tests; the package passed seven tests plus TypeScript checking; the site passed six acceptance and five deployed-output tests.
- The built artifact reports exactly 53 total, 13 documented, 40 indexed, with 18 image, 18 video, and 17 audio records.
- The post-merge CI run on `main` (`c9f0dc2`) passed.
- The repository reports MIT licensing, squash-only merging, strict branch protection, no force pushes, and no branch deletion on `main`.
- There were no open pull requests when this report was written.
- GitHub Pages deployment run `31391683526` passed. The home page, drift page, latest and v1 registry JSON, latest and v1 drift JSON, RSS, and source schema all returned HTTP 200. The deployed registry, drift JSON, and RSS bytes matched the deterministic local artifacts by SHA-256.

The completion work was squash-merged through protected PR #23. GitHub Pages is enabled with `build_type = "workflow"`, HTTPS enforced, and no custom domain.

## Human work that remains

1. Review unverified records against their cited live first-party pages. Only a human may change a record to `verified`.
2. Deepen the 40 indexed records with exact capability constraints and lab-direct pricing, leaving unsupported or unstated claims explicitly unknown.
3. Inspect each watcher issue and decide whether an official source change requires a model-data pull request. Detection never substitutes for review.
4. Choose an npm release cadence and publish `@modelsheet/registry` when maintainers are ready. Publication is intentionally not automated.
5. A custom domain can be added later if desired; the GitHub Pages project URL is the no-cost default.
6. Redundant historical deep-data branches remain on the remote. Their records are already present on `main`; deleting those branches is optional repository housekeeping, not a product blocker.

## Integrity summary

- Every comparison-visible model is `documented`; indexed records stay in a separate labelled list.
- No new model is marked verified.
- No reseller pricing or invented currency conversion is included.
- Unknown, unsupported, and not applicable remain distinct.
- The watcher is detection-only and cannot write records or open pull requests.
- Drift artifacts are generated from Git history rather than a contributor-maintained changelog.
- The typed package is not published, the Pages site is live at the repository URL, and no custom domain work was attempted.
