export type Modality = "audio" | "image" | "video";
export type DocumentationState = "documented" | "indexed";
export type ClaimState =
  | "supported"
  | "unsupported"
  | "not_applicable"
  | "unknown";
export type PricingState = "known" | "partial" | "unknown";
export type SourceKind =
  | "documentation"
  | "api_reference"
  | "api_schema"
  | "pricing"
  | "release_note"
  | "changelog";
export type OneOrMany<T> = T | readonly T[];

export interface RegistryCounts {
  readonly total_records: number;
  readonly documented: number;
  readonly indexed: number;
  readonly by_modality: Readonly<Record<Modality, number>>;
}

export interface Source {
  readonly id: string;
  readonly kind: SourceKind;
  readonly url: string;
  readonly retrieved_on: string;
}

export interface ModelIdentity {
  readonly id: string;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly lab: string;
  readonly modality: Modality;
  readonly status: "available" | "preview" | "unknown";
  readonly source_ids: readonly string[];
}

export interface Verification {
  readonly state: "unverified";
}

export interface ApiIdentifier {
  readonly kind: "model_id" | "snapshot_id" | "version_selector";
  readonly value: string;
  readonly resolves_to?: string;
  readonly source_ids: readonly string[];
}

export interface Language {
  readonly name: string;
  readonly code?: string;
}

export interface LanguageSupport {
  readonly state: ClaimState;
  readonly scope: "native_audio" | "speech_output" | "prompt_input";
  readonly published_label?: string;
  readonly listed_count?: number;
  readonly list_completeness?: "non_exhaustive";
  readonly languages?: readonly Language[];
  readonly source_ids: readonly string[];
}

export interface DurationConstraint {
  readonly state: ClaimState;
  readonly mode?: "range";
  readonly unit?: "second";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly automatic?: boolean;
  readonly source_ids: readonly string[];
}

export interface TextInputConstraint {
  readonly state: ClaimState;
  readonly unit?: "character";
  readonly max?: number;
  readonly source_ids: readonly string[];
}

export interface FrameRateConstraint {
  readonly state: ClaimState;
  readonly mode?: "exact_set";
  readonly unit?: "frame_per_second";
  readonly values?: readonly number[];
  readonly source_ids: readonly string[];
}

export interface DimensionExample {
  readonly width: number;
  readonly height: number;
  readonly unit: "pixel";
  readonly aspect_ratio: string;
  readonly source_ids: readonly string[];
}

export interface SizeOption {
  readonly id: string;
  readonly label?: string;
  readonly max_megapixels?: number;
  readonly render_modes?: readonly string[];
  readonly aspect_ratios?: readonly string[];
  readonly examples?: readonly DimensionExample[];
  readonly source_ids: readonly string[];
}

export interface SizeConstraint {
  readonly state: ClaimState;
  readonly mode?: "exact_set" | "range";
  readonly unit?: "pixel" | "resolution_tier";
  readonly automatic?: boolean;
  readonly default?: string;
  readonly edge_multiple?: number;
  readonly max_edge?: number;
  readonly min_total_pixels?: number;
  readonly max_total_pixels?: number;
  readonly experimental_above_total_pixels?: number;
  readonly max_long_to_short_ratio?: number;
  readonly options?: readonly SizeOption[];
  readonly examples?: readonly DimensionExample[];
  readonly source_ids: readonly string[];
}

export interface NativeAudioConstraint {
  readonly state: ClaimState;
  readonly default?: boolean;
  readonly source_ids: readonly string[];
}

export interface AudioFormat {
  readonly family: "mp3" | "pcm" | "wav" | "opus" | "ulaw" | "alaw";
  readonly encoding?: string;
  readonly sample_rate_mode: "exact_set";
  readonly sample_rate_unit: "hertz";
  readonly sample_rates: readonly number[];
  readonly bitrate_mode?: "exact_set";
  readonly bitrate_unit?: "kilobit_per_second";
  readonly bitrates?: readonly number[];
  readonly bit_depth_unit?: "bit";
  readonly bit_depths?: readonly number[];
  readonly source_ids: readonly string[];
}

export interface AudioFormatAccess {
  readonly format_ids: readonly string[];
  readonly minimum_plan: string;
  readonly source_ids: readonly string[];
}

export interface ReferenceInput {
  readonly role: string;
  readonly media_type:
    | "image"
    | "video"
    | "audio"
    | "image_mask"
    | "voice_id"
    | "binary";
  readonly state: ClaimState;
  readonly min_count?: number;
  readonly max_count?: number;
  readonly max_count_state?: "unknown";
  readonly demonstrated_count?: number;
  readonly count_scope?: "unique";
  readonly position_roles?: readonly string[];
  readonly max_duration?: number;
  readonly duration_unit?: "second";
  readonly formats?: readonly string[];
  readonly encodings?: readonly string[];
  readonly constraints?: readonly string[];
  readonly source_ids: readonly string[];
}

export interface DeliveryProfile {
  readonly id: string;
  readonly state: ClaimState;
  readonly transport: string;
  readonly endpoint?: string;
  readonly formats?: readonly string[];
  readonly default_format?: string;
  readonly max_partial_outputs?: number;
  readonly source_ids: readonly string[];
}

export interface Control {
  readonly name: string;
  readonly state: ClaimState;
  readonly mode?: "exact_set" | "range";
  readonly values?: readonly string[];
  readonly unsupported_values?: readonly string[];
  readonly default?: string | number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly formats?: readonly string[];
  readonly source_ids: readonly string[];
}

export interface Timing {
  readonly state: ClaimState;
  readonly granularity?: string;
  readonly delivery_profile_ids?: readonly string[];
  readonly endpoints?: readonly string[];
  readonly metadata?: readonly string[];
  readonly source_ids: readonly string[];
}

export interface CapabilityProfile {
  readonly id: string;
  readonly task: string;
  readonly endpoint?: string;
  readonly api_mode?: string;
  readonly api_mode_aliases?: readonly string[];
  readonly variants?: readonly string[];
  readonly source_ids: readonly string[];
  readonly duration?: DurationConstraint;
  readonly text_input?: TextInputConstraint;
  readonly frame_rate?: FrameRateConstraint;
  readonly size?: SizeConstraint;
  readonly native_audio?: NativeAudioConstraint;
  readonly audio_formats?: readonly AudioFormat[];
  readonly audio_format_access?: readonly AudioFormatAccess[];
  readonly reference_inputs?: readonly ReferenceInput[];
  readonly delivery_profiles?: readonly DeliveryProfile[];
  readonly controls?: readonly Control[];
  readonly timing?: Timing;
}

export interface Limitation {
  readonly id: string;
  readonly summary: string;
  readonly source_ids: readonly string[];
}

export interface Charge {
  readonly id: string;
  readonly state: "known" | "unknown";
  readonly kind?: "metered" | "estimate" | "usage_increment";
  readonly amount?: number;
  readonly denomination?: string;
  readonly per?: number;
  readonly unit?: string;
  readonly profile_id?: string;
  readonly applies_when?: readonly string[];
  readonly qualifier?: string;
  readonly source_ids: readonly string[];
}

export interface Pricing {
  readonly state: PricingState;
  readonly source_ids: readonly string[];
  readonly charges?: readonly Charge[];
}

export interface Conflict {
  readonly path: string;
  readonly summary: string;
  readonly handling: string;
  readonly source_ids: readonly string[];
}

export interface ModelsheetRecord {
  readonly schema_version: 1;
  readonly documentation_state: DocumentationState;
  readonly model: ModelIdentity;
  readonly verification?: Verification;
  readonly api_identifiers?: readonly ApiIdentifier[];
  readonly language_support?: LanguageSupport;
  readonly capability_profiles: readonly CapabilityProfile[];
  readonly limitations?: readonly Limitation[];
  readonly pricing: Pricing;
  readonly conflicts?: readonly Conflict[];
  readonly sources: readonly Source[];
}

export interface ModelsheetRegistry {
  readonly schema_version: 1;
  readonly counts: RegistryCounts;
  readonly models: readonly ModelsheetRecord[];
}

export interface ModelQuery {
  readonly modality?: OneOrMany<Modality>;
  readonly documentationState?: OneOrMany<DocumentationState>;
  readonly verificationState?: OneOrMany<"unverified" | "unspecified">;
  readonly lab?: string;
  readonly status?: OneOrMany<ModelIdentity["status"]>;
  readonly pricingState?: OneOrMany<PricingState>;
  readonly search?: string;
  readonly task?: OneOrMany<string>;
  readonly aspectRatio?: string;
  readonly maxDurationAtLeast?: number;
  readonly nativeAudioState?: ClaimState;
  readonly referenceRole?: string;
}

export const registry: Readonly<ModelsheetRegistry>;
export const models: readonly Readonly<ModelsheetRecord>[];

export function findModels(
  query?: Readonly<ModelQuery>,
): readonly Readonly<ModelsheetRecord>[];

export function getModel(
  identifier: string,
): Readonly<ModelsheetRecord> | undefined;

export function getModelById(
  id: string,
): Readonly<ModelsheetRecord> | undefined;

export function getModelCounts(
  records?: readonly Readonly<ModelsheetRecord>[],
): Readonly<RegistryCounts>;

export function listLabs(
  records?: readonly Readonly<ModelsheetRecord>[],
): readonly string[];

export function listTasks(
  records?: readonly Readonly<ModelsheetRecord>[],
): readonly string[];

export function resolveSources(
  record: Readonly<ModelsheetRecord>,
  sourceIds: readonly string[],
): readonly Readonly<Source>[];

export default registry;
