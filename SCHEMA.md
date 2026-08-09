# Modelsheet schema v1

This schema is derived from the first three source-backed records: FLUX 3 Video, GPT Image 2, and Eleven v3. It documents the union of fields those records actually required. Adding a field requires a real official-source claim that cannot be represented by the existing shape.

The primary entity is the model. A file represents one officially named model, not a reseller offering or provider endpoint. There is no inheritance, `base_model`, `release_id`, or per-provider availability layer.

## File and identity rules

- Store one UTF-8 TOML file at `models/<lab-slug>/<model-slug>.toml`.
- `model.name` is the lab's official published name. Colloquial or display names belong in `model.aliases`; API request values belong in `api_identifiers`.
- Every new record includes `[verification]` with `state = "unverified"`. The three seed records predate this process field and are the only allowed omissions.
- Do not write an empty array to mean unknown. Omit a non-applicable optional collection, or use a claim table with an explicit state when the distinction matters.
- A registry `model.id`, capability-profile `id`, pricing-charge `id`, and source `id` is stable identity. Presentation changes must not silently replace those IDs.
- All dates are TOML local dates in `YYYY-MM-DD` form.

## Claim states

Capability-shaped tables use `state` with these meanings:

| Value | Meaning |
| --- | --- |
| `supported` | An official source affirmatively exposes the capability for this profile. |
| `unsupported` | An official source or callable schema affirmatively excludes it. This is not interchangeable with missing documentation. |
| `not_applicable` | The concept does not apply to the modality or task, such as video duration for a still image. |
| `unknown` | The concept applies, but official sources do not state a safe value or conflict too strongly to select one. |

When `state` is `unknown`, `unsupported`, or `not_applicable`, value fields such as `min`, `max`, `values`, and `formats` are absent. Consumers must never coerce an absent claim to `false` or an empty set. A role or control that is not represented makes no claim and must also be treated as unknown, not unsupported.

`model.status` is a separate lifecycle claim. The current records use:

- `available`: an official source explicitly says the model is generally available or available through the lab API.
- `preview`: an official source explicitly labels the model Preview or pre-GA.
- `unknown`: no official lifecycle term can be mapped safely.

Do not translate marketing badges such as “Default” into a lifecycle status.

## Provenance

Every factual table has `source_ids`. Each ID must resolve to one `[[sources]]` table in the same file. The source reference applies to every scalar, array item, and inline table directly contained by that factual table; a nested TOML table carries its own `source_ids`.

Only first-party lab or provider pages are valid capability and pricing sources. `retrieved_on` records when the page was read, not when the model launched. Conflicting official claims remain in `[[conflicts]]`; they are not silently normalized.

### `[[sources]]`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | File-local source key referenced by `source_ids`. |
| `kind` | string | Source role used by current records: `documentation`, `api_reference`, `api_schema`, `pricing`, `release_note`, or `changelog`. |
| `url` | absolute HTTPS URL | Exact official page that was read. |
| `retrieved_on` | local date | Date the claim was checked against that URL. |

## Root and model fields

| Path | Type | Meaning |
| --- | --- | --- |
| `schema_version` | integer | Record schema version. These records use `1`. |
| `model.id` | string | Stable registry ID in `<lab-slug>/<model-slug>` form. |
| `model.name` | string | Official model name, preserving the lab's spelling and capitalization. |
| `model.aliases` | string array | Known colloquial or display names. This is absent when no alias is evidenced; API IDs do not belong here. |
| `model.lab` | string | Official lab name. |
| `model.modality` | string | Primary output modality: `video`, `image`, or `audio`. |
| `model.status` | string | Source-backed lifecycle status described above. |
| `model.source_ids` | string array | Sources for identity, aliases, modality, and lifecycle. |

### `[verification]`

Verification is process metadata, not a capability claim, so it does not carry `source_ids`.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | string | `unverified` for every new record. It means the citations are present but a human has not compared every stated value with the live pages. Automated tooling must never assign `verified`. |

The validator permits this table to be absent only on the three seed records that predate the field: `black-forest-labs/flux-3-video`, `openai/gpt-image-2`, and `elevenlabs/eleven-v3`.

### `[[api_identifiers]]`

API identifiers are access metadata for the same model; they do not create provider-offering entities.

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | string | Identifier role used here: `model_id`, `snapshot_id`, or `version_selector`. |
| `value` | string | Exact request or version value published by the lab. |
| `resolves_to` | string | Published target of a moving model ID. Present only when the lab states the mapping. |
| `source_ids` | string array | Sources for the identifier and mapping. |

## Language support

`[language_support]` records an officially stated language claim without expanding it beyond the source.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Whether language support is supported or unknown. |
| `scope` | string | What the claim covers, currently `native_audio`, `speech_output`, or `prompt_input`. |
| `published_label` | string | Lab wording such as “70+ languages”; it is not converted into an exact count. |
| `listed_count` | integer | Number of language entries actually transcribed into `languages`. |
| `list_completeness` | string | `non_exhaustive` when the source introduces examples with wording such as “including” or says more exist. |
| `languages` | inline-table array | Source-listed languages. Each item contains `name` and, only when published, `code`. |
| `languages[].name` | string | Language name exactly identified by the source. |
| `languages[].code` | string | Source-published code. Do not convert it to another coding standard. |
| `source_ids` | string array | Sources for the entire language claim and inline entries. |

For `state = "unknown"`, the positive fields after `scope` are absent.

## Capability profiles

Each `[[capability_profiles]]` is one task-specific envelope. Duration, size, references, delivery, and controls inside a profile may be combined; values from different profiles must not be cross-multiplied.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable file-local profile ID. |
| `task` | string | Normalized task key, such as `text_to_video`, `image_edit`, or `text_to_dialogue`. |
| `endpoint` | string | Exact official HTTP method and lab endpoint for the profile. |
| `api_mode` | string | Exact mode value used within a shared endpoint. |
| `api_mode_aliases` | string array | Alternate mode spellings accepted by that API. These are not model aliases. |
| `variants` | string array | Published render variants sharing the profile's task envelope. |
| `source_ids` | string array | Sources establishing the task, endpoint, mode, and variants. |

### Duration

`[capability_profiles.duration]` is always profile-scoped. A supported duration is a structured range in the current records; it is never a bare model-level minimum or maximum.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Support state for caller-visible output duration. |
| `mode` | string | `range` for the current source-backed duration claims. |
| `unit` | string | Unit for every numeric value; currently `second`. |
| `min` / `max` | number | Inclusive published bounds. |
| `step` | number | Published increment between valid values. |
| `automatic` | boolean | Present only when the API explicitly accepts automatic duration selection. |
| `source_ids` | string array | Sources for the complete duration claim. |

An exact-set duration shape will be added only when a real record requires one; it must not be approximated as a range.

### Text input

`[capability_profiles.text_input]` records a model-specific request limit only when an official model source states one. Product-card and grouped-plan values remain conflicts when they disagree.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Whether this profile accepts the input and has a usable source-backed limit. |
| `unit` | string | `character`. |
| `max` | integer | Published maximum characters per request. |
| `source_ids` | string array | Model-specific source for the limit. |

### Frame rate

`[capability_profiles.frame_rate]` keeps the temporal sampling claim separate from duration.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Support state for frame rate. |
| `mode` | string | `exact_set` in the current video record. |
| `unit` | string | `frame_per_second`. |
| `values` | number array | Exhaustive source-published values for this profile. |
| `source_ids` | string array | Sources for the frame-rate claim. |

### Size and resolution

`[capability_profiles.size]` is profile-scoped and uses either a named exact set or numeric range. Aspect ratios never live in an independent model-level list.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Support state for output sizing. |
| `mode` | string | `exact_set` when `options` exhaust the published choices; `range` when numeric constraints define the legal space. |
| `unit` | string | `resolution_tier` or `pixel`. |
| `automatic` | boolean | Whether the API explicitly accepts automatic size selection. |
| `default` | string | Published default selector or option. |
| `edge_multiple` | integer | Required divisibility of each image edge in pixels. |
| `max_edge` | integer | Inclusive maximum for either edge. |
| `min_total_pixels` / `max_total_pixels` | integer | Inclusive total-pixel range. |
| `experimental_above_total_pixels` | integer | Outputs strictly above this total-pixel count are labelled experimental by the source. |
| `max_long_to_short_ratio` | number | Maximum long-edge divided by short-edge ratio. |
| `source_ids` | string array | Sources for the size selector and range. |

`[[capability_profiles.size.options]]` represents one structured named size:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Exact API selector. |
| `label` | string | Source-published human label. |
| `max_megapixels` | number | Published upper pixel band for the option. |
| `render_modes` | string array | Variants for which this exact option is available. |
| `aspect_ratios` | string array | Ratios explicitly supported with this size option. Their placement here records the real combination and avoids a false cross-product. |
| `source_ids` | string array | Sources for this size/ratio combination. |

Documented dimensions use `[[capability_profiles.size.examples]]` for examples inside a numeric range, or `[[capability_profiles.size.options.examples]]` for an example attached to one named option. Both shapes use the same fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `width` / `height` | integer | Published dimensions. |
| `unit` | string | `pixel`. |
| `aspect_ratio` | string | Ratio label attached to those exact dimensions by the source context. Do not recalculate or normalize it. |
| `source_ids` | string array | Source for the example. |

Examples are evidence, not an exhaustive size set.

### Native audio

`[capability_profiles.native_audio]` answers whether a video profile can create synchronized audio in the same generation. It is `not_applicable` when audio is the primary output rather than a companion track.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Supported, unknown, or not applicable. |
| `default` | boolean | Published default; never inferred from omission. |
| `source_ids` | string array | Sources for support and default behavior. |

### Audio formats

Each `[[capability_profiles.audio_formats]]` normalizes one published family and its attached sample-rate, bitrate, and bit-depth options. Separate rows preserve combinations such as MP3 at 22.05 kHz/32 kbps versus 24 kHz/48 kbps; consumers must not cross-multiply values from different rows.

| Field | Type | Meaning |
| --- | --- | --- |
| `family` | string | Published format family: `mp3`, `pcm`, `wav`, `opus`, `ulaw`, or `alaw`. |
| `encoding` | string | Published sample encoding when stated; currently `s16le` for PCM. |
| `sample_rate_mode` | string | `exact_set` for the source-listed sample rates. |
| `sample_rate_unit` | string | `hertz`. |
| `sample_rates` | integer array | Exact sample-rate options attached to this row. |
| `bitrate_mode` | string | `exact_set` when the source lists bitrate choices. |
| `bitrate_unit` | string | `kilobit_per_second`. |
| `bitrates` | integer array | Exact bitrate choices attached to this row. |
| `bit_depth_unit` | string | `bit`. |
| `bit_depths` | integer array | Exact source-published bit depths attached to this row. |
| `source_ids` | string array | Sources for the complete audio-format combination. |

`[[capability_profiles.audio_format_access]]` attaches lab-plan requirements to exact format IDs without making those requirements part of pricing:

| Field | Type | Meaning |
| --- | --- | --- |
| `format_ids` | string array | Exact format selectors from a delivery profile that share the requirement. |
| `minimum_plan` | string | Lab-published minimum plan name, preserving its capitalization. |
| `source_ids` | string array | API reference that states the access requirement. |

### Reference inputs

Each `[[capability_profiles.reference_inputs]]` describes one semantic input role. It replaces booleans such as `ref_images = true`.

| Field | Type | Meaning |
| --- | --- | --- |
| `role` | string | Semantic role, including `keyframe_sequence`, `start_video`, `draft_cache`, `image_reference`, `edit_mask`, `voice`, or `audio_reference`. |
| `media_type` | string | Source input kind, currently `image`, `video`, `audio`, `image_mask`, `voice_id`, or `binary`. |
| `state` | claim state | Support state for this role in this profile. |
| `min_count` / `max_count` | integer | Published count bounds for the role. |
| `max_count_state` | string | `unknown` when a minimum is known but no safe model-specific maximum is published. |
| `demonstrated_count` | integer | Largest count directly shown by an official example. It is evidence, not a maximum. |
| `count_scope` | string | `unique` when the maximum counts distinct identifiers rather than list items. |
| `position_roles` | string array | Published semantic positions within an ordered input, such as start, intermediate, and end keyframes. |
| `max_duration` | number | Published maximum duration of a reference input. |
| `duration_unit` | string | Unit for `max_duration`; currently `second`. |
| `formats` | string array | Exact accepted media or artifact formats stated by the source. |
| `encodings` | string array | Exact transport encodings stated by the source. |
| `constraints` | string array | Source-backed atomic constraints that all apply, encoded as stable `key=value` statements. |
| `source_ids` | string array | Sources for the role, count, and constraints. |

### Delivery profiles

Each `[[capability_profiles.delivery_profiles]]` describes one output-delivery path. Buffered output, HTTP streaming, and WebSocket input are kept distinct.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable file-local delivery ID. |
| `state` | claim state | Whether this delivery path is supported. |
| `transport` | string | Exact normalized delivery mechanism. |
| `endpoint` | string | Method and endpoint when it differs from the capability profile's main endpoint. |
| `formats` | string array | Exact format selectors accepted by this delivery path. |
| `default_format` | string | Published default format selector. |
| `max_partial_outputs` | integer | Published maximum number of preview or partial outputs. |
| `source_ids` | string array | Sources for transport, endpoint, formats, and limits. |

### Controls

Each `[[capability_profiles.controls]]` is a source-published caller control. It is not a catch-all place for qualitative model claims.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | Stable normalized control name. |
| `state` | claim state | Whether the control is exposed. |
| `mode` | string | `exact_set` or `range`. |
| `values` | string array | Exhaustive published enum for an exact-set control. |
| `unsupported_values` | string array | Values explicitly excluded for this model. |
| `default` | string or integer | Published default, with the same value type used by the control. |
| `min` / `max` | number | Inclusive numeric bounds for a range control. |
| `step` | number | Published increment for a range control. |
| `unit` | string | Unit for a range control. |
| `formats` | string array | Output formats to which this control applies. |
| `source_ids` | string array | Sources for the control and all values. |

### Timing metadata

`[capability_profiles.timing]` records source-backed alignment metadata separately from audio streaming support.

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | claim state | Whether timing metadata is available for the profile. |
| `granularity` | string | Smallest published alignment unit; currently `character`. |
| `delivery_profile_ids` | string array | Exact IDs of this profile's delivery paths that have timing variants. |
| `endpoints` | string array | Exact method and endpoints that return timing metadata. |
| `metadata` | string array | Exact published response keys: `alignment`, `normalized_alignment`, and, for dialogue, `voice_segments`. |
| `source_ids` | string array | API references for the timing endpoints and returned metadata. |

## Documented limitations

Each `[[limitations]]` entry is a first-party limitation published by the model's lab. It records source-backed constraints or weaknesses, not community reception or Modelsheet's opinion.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable file-local limitation ID. |
| `summary` | string | Concise faithful paraphrase of the lab's published limitation. |
| `source_ids` | string array | Official lab documentation containing the limitation. |

Limitations must remain dated through their referenced `[[sources]]` entries. Community assessments, benchmark interpretations, and inferred weaknesses do not belong here.

## Pricing

`[pricing]` deliberately contains only a state and a flat `charges` list. It is not a billing engine.

| Field | Type | Meaning |
| --- | --- | --- |
| `pricing.state` | string | `known` when all represented profile pricing is published, `partial` when at least one profile or combination remains unknown, or `unknown` when the lab publishes no usable price. |
| `pricing.source_ids` | string array | Official lab pricing sources and any sources needed to explain coverage. |

Each `[[pricing.charges]]` is one atomic published charge or one explicit unknown gap:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable file-local charge ID. |
| `state` | string | `known` or `unknown`. |
| `kind` | string | `metered` for a billable rate, `estimate` for a lab-published estimate, or `usage_increment` for an extra native billing unit. |
| `amount` | number | Published amount. Zero is valid only when the source explicitly says included at no extra cost. |
| `denomination` | string | Exact billing denomination, such as `USD` or `image_output_token`. Never convert credits or tokens to currency unless the lab publishes that charge in currency. |
| `per` | positive integer | Number of `unit` items covered by `amount`. |
| `unit` | string | Atomic meter, such as `output_second`, `input_character`, or `image_output_token`. |
| `profile_id` | string | Optional exact `capability_profiles.id` scoped by the charge. When present, it must resolve inside the same record. |
| `applies_when` | string array | Conjunctive `key=value` conditions; every listed condition must match. Alternatives are separate charge rows. |
| `qualifier` | string | Necessary source-backed interpretation, such as “included” or “output-only estimate; inputs additional.” |
| `source_ids` | string array | Official source for this exact charge or unknown gap. |

For `state = "unknown"`, `kind`, `amount`, `denomination`, `per`, and `unit` are absent. A model such as Seedance 2.5 may therefore remain in the registry with `pricing.state = "unknown"` and no invented conversion or reseller rate.

## Conflicting official claims

`[[conflicts]]` preserves source disagreement next to the selected value or deliberate omission. It is part of the record so a later source change can resolve it without reconstructing the research trail.

| Field | Type | Meaning |
| --- | --- | --- |
| `path` | string | Human-stable path to the affected claim; `*` or comma-separated paths may identify repeated fields. |
| `summary` | string | Concise statement of what the official sources disagree about. |
| `handling` | string | Why the record uses one value or leaves the field unknown. |
| `source_ids` | string array | Every official source participating in the conflict. |

## Validation invariants

The Stage 3 validator should enforce these schema-derived rules:

1. All `model.id` values are unique; profile, charge, API-identifier value, and source IDs are unique within their relevant file scope.
2. Every `source_ids` entry resolves inside the same file, and every source has an HTTPS URL and `retrieved_on` date.
3. `listed_count` equals the number of `languages` entries.
4. Supported duration and control ranges have a unit, `min <= max`, and a positive `step` when present. A supported range-sized profile has a unit plus its published edge, pixel-total, and ratio constraints. Supported exact sets, including audio sample rates, bitrates, and bit depths, are non-empty.
5. Non-positive claim states carry no positive value fields. `max_count_state = "unknown"` and `max_count` cannot coexist.
6. Aspect ratios appear only inside a structured size option or dimension example.
7. A known charge has `kind`, `amount`, `denomination`, positive `per`, and `unit`; an unknown charge has none of them.
8. Arrays are never empty placeholders for unknown data.
9. Every alias is distinct from the official name and every API identifier; names and request identifiers stay separate.
10. A supported `text_input` has a positive `max` and unit; supported timing metadata has at least one endpoint, delivery-profile reference, and metadata key, and every referenced delivery ID exists in the same capability profile.
11. Every `audio_format_access.format_ids` value occurs in at least one delivery profile in the same capability profile.
12. Limitation IDs are unique within a record, and each limitation has a non-empty summary plus at least one resolvable source.
13. Every non-seed record has `verification.state = "unverified"`; no schema-valid value promotes a record to verified.
