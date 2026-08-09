## Summary

Describe the records or tooling changed by this pull request.

## Evidence for each changed record

Complete one row per model record. Add rows rather than combining models.

| Record path | Official source URL(s) | Retrieved on (YYYY-MM-DD) | Verification state |
| --- | --- | --- | --- |
| `models/<lab>/<model>.toml` |  |  | `unverified` |

## Contributor checklist

- [ ] Every capability and price comes from an official lab source.
- [ ] Every factual table has `source_ids`, and every referenced source has an exact URL and retrieval date.
- [ ] I used `unknown` where the source is silent; I did not substitute `unsupported`, `false`, zero, or an empty list.
- [ ] Pricing is the lab's own price, not reseller or aggregator pricing.
- [ ] Every new record has `verification.state = "unverified"`.
- [ ] Official-source disagreements are preserved in `[[conflicts]]`.
- [ ] `npm run check` passes locally.
- [ ] No generated artifact was edited by hand.
