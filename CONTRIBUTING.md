# Contributing to Modelsheet

Modelsheet is useful only when its uncertainty is honest. A smaller record with explicit unknowns is better than a comprehensive-looking record built from assumptions.

## Evidence bar

Use first-party lab sources only:

- model-specific developer documentation;
- an official API reference or published schema;
- the lab's own pricing page;
- an official changelog or release-note page when identity or lifecycle is the claim.

Do not use blog posts, comparison articles, listicles, community posts, search snippets, reseller catalogs, or your own prior knowledge as evidence for a capability or price. Never substitute reseller or aggregator pricing for the lab's price.

Every factual table must reference at least one `[[sources]]` entry through `source_ids`. Each source entry must contain the exact official HTTPS URL and the date the page was read. A URL elsewhere in the file does not satisfy this requirement.

If an official source does not state a value, use `state = "unknown"` where the schema provides a claim table. Do not turn missing documentation into `unsupported`, `false`, zero, or an empty list. Preserve disagreements between official pages in `[[conflicts]]`.

## Verification

New records and agent-assisted contributions must include:

```toml
[verification]
state = "unverified"
```

`unverified` means the record has citations but a human has not compared every stated value with the cited live pages. It is the default. Automated tools and coding agents must never promote a record to `verified`; that requires a maintainer's explicit human review.

## Record changes

1. Read [SCHEMA.md](SCHEMA.md).
2. Add or edit one TOML file under `models/<lab-slug>/`.
3. Keep the official lab name in `model.name`; put colloquial names in `model.aliases` and API request values in `api_identifiers`.
4. Add only fields needed by a real, cited claim. Propose a schema extension only when the existing shape cannot express that claim.
5. Run `npm.cmd install` once, then `npm.cmd run check` before opening a pull request.
6. Complete the pull-request evidence checklist for every changed record.

Model records should arrive through pull requests, never as unreviewed direct commits to `main`. Contributors edit data, not generated artifacts; `artifacts/api.json` is built deterministically from the TOML records.

## Pull-request scope

Keep data pull requests small. Five records or fewer is the preferred review size. Do not combine model data with site or tooling changes unless the data genuinely requires a schema extension.
