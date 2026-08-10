# Autonomous completion run report

Run dates: 2026-08-09 to 2026-08-10  
Repository: <https://github.com/AJ-Base44/modelsheet>  
Source survey date used by new records: 2026-08-09

## Outcome

The requested Phase A-F foundation is on `main`: open-source scaffolding, the GPT Image 2 corrections, strict validation and deterministic builds, CI, a hash-only official-source watcher, and a static Astro catalog site.

`main` still contains exactly the three pre-existing model records. Fifty new records were written as ten unmerged five-record branches. Every one of those fifty records declares `verification.state = "unverified"`; none was promoted to verified. GitHub CLI authentication was invalid, so the branches were pushed but pull requests were not opened automatically.

The coverage target is 53 models when the ten branches are reviewed and merged: 18 video, 18 image, and 17 audio. The complete official source survey is in [coverage-plan.md](coverage-plan.md).

## Phase A - repository scaffolding

Created and pushed as intentionally small commits:

- `LICENSE`: MIT, copyright Aatman Jain, 2026. GitHub's public repository API identifies the repository licence as MIT.
- `README.md`: product scope, exclusions, record structure, verification semantics, contribution path, and the current three-record `main` count.
- `.gitignore`: dependency, generated artifact, watcher state, and operating-system files.
- `.editorconfig`: UTF-8, LF, final newline.
- `CONTRIBUTING.md`: official-source-only evidence policy and unverified-by-default rule.
- `docs/decisions/0001-model-first-entity.md`: model-first identity, lab-direct pricing, no adapters, and hash-only watching.

## Phase B - GPT Image 2 corrections

Updated the existing OpenAI record and `SCHEMA.md` from the live OpenAI documentation read on 2026-08-09:

- added the published mask constraint that the image and mask must share format and dimensions and each remain under 50 MB;
- confirmed `text_input.max = 32000` and `output_count` range 1-10 against the live generate/edit API references;
- removed the inconsistent `output_compression` default from both profiles and recorded the generation-versus-edit reference disagreement as a conflict;
- added four first-party limitations: latency up to two minutes, text placement, recurring-character/brand consistency, and structured composition control.

The supporting official pages are the [GPT Image 2 model page](https://developers.openai.com/api/docs/models/gpt-image-2), [image generation guide](https://developers.openai.com/api/docs/guides/image-generation), [generate method](https://developers.openai.com/api/reference/resources/images/methods/generate), and [edit method](https://developers.openai.com/api/reference/resources/images/methods/edit).

No verification state was invented for the legacy record. Its missing state is displayed as **Verification not recorded** by the site.

## Phase C - schema, validator, build, and CI

Created:

- `schema/source-v1.schema.json`, with unknown keys rejected;
- `scripts/validate.mjs` and reusable record loading;
- `scripts/build.mjs`, which sorts records and object keys and emits no wall-clock timestamp;
- valid, invalid, semantic-reformatting, deterministic-build, verification-policy, and watcher safety tests;
- `.github/workflows/ci.yml` for Node 22 validation, tests, deterministic build, site acceptance tests, and site production build;
- `.github/pull_request_template.md` requiring source URL, retrieval date, and verification state.

The validator rejects duplicate global model IDs, duplicate stable IDs, missing or unresolved source references, unsourced factual claim tables, unresolved pricing `profile_id` values, unknown keys, and missing `unverified` state on every non-legacy record.

Final local evidence:

- 15/15 root tests passed;
- 4/4 site acceptance tests passed;
- two consecutive builds produced the same SHA-256: `BB5EEC05B530E318692CF1FE80B470F62E36619384630618B04DA315FFC31D7B`;
- semantic-only TOML reformatting produces identical JSON bytes;
- the latest checked GitHub Actions CI run completed successfully.

## Phase D - coverage

### Included on `main`

- Video: FLUX 3 Video.
- Image: GPT Image 2.
- Audio: Eleven v3.

### Included on unmerged data branches

- Video: Seedance 2.5; Dreamina Seedance 2.0; Dreamina Seedance 2.0 Fast; Dreamina Seedance 2.0 Mini; Seedance 1.5 Pro; Seedance 1.0 Pro; Seedance 1.0 Pro Fast; Veo 3.1; Veo 3.1 Fast; Veo 3.1 Lite; MiniMax Hailuo 2.3 Fast; Grok Imagine Video 1.5; Gen-4.5; Gen-4 Turbo; Aleph 2.0; MiniMax Hailuo 2.3; Ray3.14.
- Image: Gemini 3.1 Flash Image; Gemini 3.1 Flash Lite Image; Gemini 3 Pro Image; Gemini 2.5 Flash Image; Seedream 5.0 Pro; Seedream 5.0 Lite; Seedream 4.5; Seedream 4.0; Grok Imagine Image Quality; Grok Imagine Image; Ideogram 4.0; Ideogram 3.0; FLUX.2 [max]; FLUX.2 [pro]; FLUX.2 [flex]; FLUX.2 [klein] 4B; FLUX.2 [klein] 9B.
- Audio: Eleven Multilingual v2; Eleven Flash v2.5; Eleven Flash v2; Sound Effects v2; Eleven Music v2; MiniMax Speech 2.8 HD; MiniMax Speech 2.8 Turbo; MiniMax Music 2.6; Gemini 3.1 Flash TTS Preview; Gemini 2.5 Flash Preview TTS; Gemini 2.5 Pro Preview TTS; Lyria 3 Clip Preview; Lyria 3 Pro Preview; Stable Audio 3.0; Stable Audio 2.5; Seed Audio 1.0.

Official names are primary. Sourced colloquial aliases are data: Grok Imagine Video 1.5 has `Grok Video 1.5`; Gemini 3 Pro Image has `Nano Banana Pro`; Gemini 3.1 Flash Image has `Nano Banana 2`; Gemini 3.1 Flash Lite Image has `Nano Banana 2 Lite`.

### Eligible but deferred

These met the first-party source bar but were outside the balanced 53-model cut:

- MiniMax Hailuo 02, Act-Two, LTX-2.3 Fast, LTX-2.3 Pro;
- FLUX.1 Kontext [pro], FLUX.1 Kontext [max], and FLUX1.1 [pro], pending a dedicated legacy-status review;
- Octave 2 Preview, Octave 1, TTS-1, TTS-1 HD, and Aura-2.

### Excluded after official-source review

| Model or family | Reason |
| --- | --- |
| Kling VIDEO 3.0 series, including Omni | The official page is a series-level guide covering distinct models. No exact standalone capability-and-price contract was found for each member, so the series was not collapsed into one record. |
| Stable Video Diffusion | No current exact first-party served endpoint and active model-specific pricing source was confirmed. |
| Pika 2.5 | The public API route is through fal; no direct lab API and lab-direct API price were found. |
| Suno v5.5 | First-party consumer material exists, but no exact developer API model contract or ID was found. |
| Udio models | No official developer documentation for an exact currently served model was found. |
| Seed-Music | The official family page lacks an exact currently served developer model ID plus lab pricing surface. |
| GPT Image 1.5, GPT Image 1, GPT Image 1 Mini, `chatgpt-image-latest`, DALL-E 3, DALL-E 2 | OpenAI's official catalog marks them deprecated. |
| Imagen 4 family and older Imagen models | Google marks Imagen deprecated, with shutdown scheduled for 2026-08-17. |
| Gemini image preview IDs | Google's changelog says the preview IDs were shut down; stable IDs were selected instead. |
| Seedream 3.0 and SeedEdit 3.0 | BytePlus lists them as deprecated or deactivated. |
| `grok-imagine-image-pro` | xAI's retirement notice redirects it to Grok Imagine Image Quality. |
| FLUX.2 [dev] | BFL publishes open weights without a hosted lab API endpoint. |
| Veo 3.0, Veo 3.0 Fast, Veo 2.0 | Google's official surfaces mark them deprecated or past their removal date. |
| Sora 2 and Sora 2 Pro | OpenAI's official catalog marks them deprecated. |
| Gen-4 Aleph and Gen-3 Alpha Turbo | Runway marks these older API models deprecated. |
| LTX-2 Fast and LTX-2 Pro | LTX marks them deprecated, with removal scheduled for 2026-08-15. |
| GPT-4o mini TTS | OpenAI's official catalog marks it deprecated. |
| Eleven Turbo v2.5 and Eleven Turbo v2 | ElevenLabs lists them in the deprecated-model section. |
| Transcription-only models | Their output is text, not generative media. |
| OpenAI Realtime/GPT Audio and Google native-audio dialogue models | These are general conversational language models and are outside the non-LLM scope. |

### Unknowns and deliberately omitted details

The new branch records are intentionally identity-first rather than comprehensive-looking:

- `pricing.state` is `unknown` on all 50. Seedance 2.5 has no official pricing source. The other 49 cite the official lab pricing surface but do not copy a charge until a human transcribes and checks the exact model/tier row. No reseller price or currency conversion was substituted.
- `model.status` is `unknown` on 43 records because the cited surface did not establish a lifecycle term used by the schema. The seven stated lifecycle values are Gemini 2.5 Flash Image (`available`) and six explicit previews: Veo 3.1 Lite, the three Gemini TTS records, and both Lyria 3 records.
- API identifiers are omitted on all 50 rather than inferred. Seedance 1.5 Pro records the official identifier-prefix disagreement; Veo 3.1 records the Vertex-versus-Gemini ID and audio disagreements.
- Detailed duration, size/aspect-ratio, reference-input, native-audio, output-format, language, control, limitation, and charge fields are omitted where this run did not transcribe the official statement. The site and consumers treat those omissions as unknown; they never become false, empty, unsupported, or not applicable.
- Seed Audio 1.0 remains narrow: the official Dramagic source establishes the model and timbre-audio-generation function, not a general ModelArk capability contract.

`SCHEMA.md` now states that unknown pricing can mean no lab price, conflicting official surfaces, or a cited price that has not yet been transcribed and checked.

### Branches awaiting pull requests

GitHub CLI reported an invalid token for the configured `AJ-Base44` account. All branches are pushed and can be opened manually; none was merged:

| Branch | Models | Manual PR link |
| --- | ---: | --- |
| `data/batch-01` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-01) |
| `data/batch-02` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-02) |
| `data/batch-03` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-03) |
| `data/batch-04` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-04) |
| `data/batch-05` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-05) |
| `data/batch-06` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-06) |
| `data/batch-07` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-07) |
| `data/batch-08` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-08) |
| `data/batch-09` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-09) |
| `data/batch-10` | 5 | [Open PR](https://github.com/AJ-Base44/modelsheet/pull/new/data/batch-10) |

## Phase E - hash-only watcher

Created `scripts/watch.mjs`, `watch/targets.json`, watcher tests, and `.github/workflows/watch.yml`.

- Fourteen maintained first-party targets prefer changelogs/release notes, then `llms.txt` where available (including BFL and xAI), then documentation pages.
- The workflow runs daily at 03:17 UTC and by manual dispatch, with one-second request spacing and a descriptive user agent.
- A first successful response creates a baseline without opening an issue. A later hash change opens a GitHub issue containing the URL, retrieval time, prior successful check, and both hashes.
- State is persisted with GitHub Actions cache. Failed, partial, empty, undersized, truncated, wrong-content-type, or suspiciously shrunken responses do not advance state and cannot become changes.
- Generic visible-content normalization removes volatile scripts and markup for hashing but never identifies or extracts a model value.
- The watcher has no TOML-writing, pull-request, merge, or auto-merge path. Issue creation failure preserves the old hash for retry.

All 14 targets completed a live baseline fetch during this run. The watcher test suite covers baseline, changed content, HTTP/partial failure, truncation, issue failure, dynamic markup, empty app shells, complete app-shell fallback, and Markdown sources.

## Phase F - static site

Created a self-contained static Astro app under `site/` with Vercel deployment configuration for `modelsheet.dev`. Astro was chosen because it produces a small static build while allowing build-time data ingestion and focused client-side filtering. No deploy or DNS change was attempted.

The site:

- reads `artifacts/api.json` at build time and performs no runtime API lookup;
- provides search, modality and capability-preset filters, and comparison for up to three records;
- excludes unknown capability data from affirmative matches and requires the duration, aspect ratio, and generated-audio claims to coexist on one capability profile;
- displays `Verified`, `Unverified`, or `Verification not recorded` as text on every record card and comparison row;
- displays only recorded prices and capabilities, with no extrapolation;
- has responsive, keyboard-accessible layouts and a horizontally safe comparison table.

The acceptance test passed in both code and the collaborative browser: select `Video`, then select `9:16 · over 10s · generated audio`. Those two filter changes returned FLUX 3 Video. Comparison, desktop rendering, and an iPhone-sized layout were also exercised successfully.

The initially generated Astro 5 lockfile reported high-severity advisories. It was upgraded to Astro 7.2.0, the build-time artifact path was adjusted for Astro 7 prerendering, and the final dependency audit reports zero vulnerabilities.

## Failures and handling

- GitHub CLI authentication was invalid. Git pushes still worked, so all ten data branches were pushed and manual PR links are provided above.
- The Kling 3.0 candidate proved to be a series surface rather than one model. It was removed from batch 03 in a follow-up commit, replaced with MiniMax Hailuo 2.3 Fast, and added to exclusions. No history was rewritten.
- Seedance 2.5 had no official pricing source. It remains included with unknown pricing as explicitly required.
- Veo official surfaces disagree on IDs and audio semantics. The records preserve the conflict and omit the disputed claims.
- Raw HTML hashes churned on dynamic lab pages during watcher smoke testing. A lab-neutral content fingerprint removed volatile script/markup noise without adding field extraction; all targets then baselined successfully.
- Sandboxed npm/cache and esbuild access failed on Windows. The same locked installs and builds succeeded with the approved unsandboxed execution path.
- The first programmatic Astro build path was unreliable on Windows, and Astro 7 changed the prerender module base. The site now uses Astro's direct CLI build and a stable working-directory-relative artifact path; the final production build passes.
- The first collaborative-browser snapshot and one offscreen selector click failed. Retrying with the attached preview and semantic locators succeeded; the product itself showed no fresh console or network errors.

## Human work remaining

1. Re-authenticate GitHub CLI or use the links above to open the ten PRs.
2. Review each five-record PR against its official live pages. Transcribe only the capabilities and lab-direct charges actually stated, then keep `unverified` until a human has checked the complete record.
3. Reconcile the Seedance identifier and Veo service-surface conflicts before adding disputed API IDs or audio claims.
4. Approve and merge records individually; do not bulk-merge merely to reach the count.
5. Connect the Vercel project to `site/` and configure `modelsheet.dev` DNS. No DNS or deployment was attempted in this run.
6. Confirm repository Actions retain `issues: write` for the scheduled watcher and triage each source-change issue manually.
7. The product-vision git-history drift feed and RSS output remain a follow-on workstream; the completed watcher detects upstream source changes but does not replace that feed.

## Final checklist

- [x] `LICENSE` is present and GitHub identifies the repository as MIT.
- [x] `README.md` explains scope, exclusions, record structure, and verification states.
- [x] CI and negative fixtures reject malformed records automatically.
- [x] Two consecutive `api.json` builds are byte-identical.
- [x] Every new record is explicitly unverified.
- [x] Every stated model claim references an official source URL and retrieval date.
- [x] No new Phase D model record was committed to `main`; the required edit to the pre-existing GPT Image 2 record is the only model-data change on `main`.
- [x] The watcher writes no TOML, opens no PR, and never merges.
- [x] The site shows verification state as text on every record and comparison row.
- [x] The two-filter acceptance test was run in code and in the browser and passed.
- [x] No branch was merged, no force-push occurred, and nothing auto-merged.
