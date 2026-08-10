# 0002: Version the public data contract separately from registry data

Status: accepted, 2026-08-10

## Decision

Modelsheet publishes two machine-readable contracts:

- registry data with `schema_version = 1`; and
- the git-derived drift feed with `feed_version = 1`.

The unversioned URLs (`api.json` and `drift.json`) always point to the latest contract. Version-pinned copies (`api/v1.json` and `drift/v1.json`) remain available for consumers that cannot accept a breaking shape change. Model additions and factual capability or price changes do not change a contract version.

A contract version increments only when a consumer must change how it parses or interprets the document. Adding an optional field is compatible within the current version; removing or renaming a field, changing its type, or changing an existing field's meaning is breaking. The source JSON Schema and `SCHEMA.md` must change in the same pull request as a registry contract change.

The typed npm package uses normal semantic versioning and exports its supported registry schema version. Before its first external publication it remains at `0.x`. After publication, a breaking registry contract change also requires a package major-version change. Package publication is a maintainer release action, never part of an ordinary data pull request.

The drift JSON and RSS document are generated views of Git history. Contributors never author a parallel changelog, and regenerating either output must not create a commit-time or wall-clock difference.

## Hosting

Until a custom domain is deliberately purchased and configured, the canonical site is the repository's GitHub Pages project URL. No `CNAME` or DNS dependency is part of the build.
