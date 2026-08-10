#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const CLAIM_STATES = new Set([
  "supported",
  "unsupported",
  "not_applicable",
  "unknown",
]);
const MODALITIES = new Set(["audio", "image", "video"]);
const DOCUMENTATION_STATES = new Set(["documented", "indexed", "any"]);
const PRICING_STATES = new Set(["known", "partial", "unknown"]);
const FORMATS = new Set(["json", "table"]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ancestors(start) {
  const result = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) return result;
    current = parent;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findDataFile(explicitPath, cwd = process.cwd()) {
  if (explicitPath) {
    const resolved = path.resolve(cwd, explicitPath);
    if (!(await exists(resolved))) {
      throw new Error(`Modelsheet data file does not exist: ${resolved}`);
    }
    return resolved;
  }

  if (process.env.MODELSHEET_API_JSON) {
    const resolved = path.resolve(cwd, process.env.MODELSHEET_API_JSON);
    if (!(await exists(resolved))) {
      throw new Error(`MODELSHEET_API_JSON does not exist: ${resolved}`);
    }
    return resolved;
  }

  const roots = [
    ...ancestors(cwd),
    ...ancestors(path.dirname(SCRIPT_FILE)),
  ];
  const candidates = [];
  for (const root of roots) {
    candidates.push(
      path.join(root, "artifacts", "api.json"),
      path.join(root, "packages", "registry", "data", "api.json"),
      path.join(
        root,
        "node_modules",
        "@modelsheet",
        "registry",
        "data",
        "api.json",
      ),
    );
  }

  for (const candidate of new Set(candidates)) {
    if (await exists(candidate)) return candidate;
  }

  try {
    const workspaceRequire = createRequire(path.join(path.resolve(cwd), "package.json"));
    return workspaceRequire.resolve("@modelsheet/registry/api.json");
  } catch {
    throw new Error(
      "Could not locate Modelsheet data. Pass --data <api.json>, set MODELSHEET_API_JSON, build the registry, or install @modelsheet/registry.",
    );
  }
}

export async function loadRegistry(filePath) {
  const source = await readFile(filePath, "utf8");
  let registry;
  try {
    registry = JSON.parse(source);
  } catch (error) {
    throw new Error(`Could not parse ${filePath}: ${error.message}`, { cause: error });
  }

  if (
    registry?.schema_version !== 1 ||
    !Array.isArray(registry.models) ||
    registry.counts?.total_records !== registry.models.length
  ) {
    throw new Error(`${filePath} is not a valid Modelsheet v1 artifact`);
  }

  return registry;
}

function profileRatios(profile) {
  return new Set([
    ...(profile.size?.examples ?? []).map(({ aspect_ratio }) => aspect_ratio),
    ...(profile.size?.options ?? []).flatMap((option) => [
      ...(option.aspect_ratios ?? []),
      ...(option.examples ?? []).map(({ aspect_ratio }) => aspect_ratio),
    ]),
  ]);
}

function profileMatches(profile, options) {
  if (options.task && profile.task !== options.task) return false;
  if (options.aspectRatio && !profileRatios(profile).has(options.aspectRatio)) {
    return false;
  }
  if (options.maxDurationAtLeast !== undefined) {
    if (
      profile.duration?.state !== "supported" ||
      typeof profile.duration.max !== "number" ||
      profile.duration.max < options.maxDurationAtLeast
    ) {
      return false;
    }
  }
  if (
    options.nativeAudio &&
    profile.native_audio?.state !== options.nativeAudio
  ) {
    return false;
  }
  if (
    options.referenceRole &&
    !(profile.reference_inputs ?? []).some(
      (input) =>
        input.role === options.referenceRole && input.state === "supported",
    )
  ) {
    return false;
  }
  return true;
}

export function filterRecords(records, options) {
  const profileQuery = Boolean(
    options.task ||
      options.aspectRatio ||
      options.maxDurationAtLeast !== undefined ||
      options.nativeAudio ||
      options.referenceRole,
  );
  const foldedLab = options.lab?.toLocaleLowerCase();
  const foldedSearch = options.search?.toLocaleLowerCase();

  return records.filter((record) => {
    if (options.modality && record.model.modality !== options.modality) return false;
    if (
      options.documentationState !== "any" &&
      record.documentation_state !== options.documentationState
    ) {
      return false;
    }
    if (options.status && record.model.status !== options.status) return false;
    if (options.pricingState && record.pricing.state !== options.pricingState) {
      return false;
    }
    if (
      foldedLab &&
      !record.model.lab.toLocaleLowerCase().includes(foldedLab)
    ) {
      return false;
    }
    if (foldedSearch) {
      const searchable = [
        record.model.id,
        record.model.name,
        record.model.lab,
        ...(record.model.aliases ?? []),
        ...(record.api_identifiers ?? []).map(({ value }) => value),
      ];
      if (
        !searchable.some((value) =>
          value.toLocaleLowerCase().includes(foldedSearch),
        )
      ) {
        return false;
      }
    }
    return (
      !profileQuery ||
      record.capability_profiles.some((profile) => profileMatches(profile, options))
    );
  });
}

function matchingProfiles(record, options) {
  const hasCapabilityFilter = Boolean(
    options.task ||
      options.aspectRatio ||
      options.maxDurationAtLeast !== undefined ||
      options.nativeAudio ||
      options.referenceRole,
  );
  return hasCapabilityFilter
    ? record.capability_profiles.filter((profile) => profileMatches(profile, options))
    : record.capability_profiles;
}

export function summarizeRecord(record, options = {}) {
  return {
    id: record.model.id,
    name: record.model.name,
    aliases: record.model.aliases,
    lab: record.model.lab,
    modality: record.model.modality,
    status: record.model.status,
    documentation_state: record.documentation_state,
    verification_state: record.verification?.state ?? "legacy_seed_unspecified",
    pricing_state: record.pricing.state,
    matching_profiles: matchingProfiles(record, options).map((profile) => ({
      id: profile.id,
      task: profile.task,
      duration: profile.duration,
      size: profile.size,
      native_audio: profile.native_audio,
      reference_inputs: profile.reference_inputs,
      source_ids: profile.source_ids,
    })),
    sources: record.sources,
  };
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function assertChoice(value, choices, flag) {
  if (!choices.has(value)) {
    throw new Error(`${flag} must be one of: ${[...choices].join(", ")}`);
  }
}

export function parseArguments(argv) {
  const command = argv[0] ?? "list";
  if (!["counts", "list", "show", "compare", "help"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const options = {
    command,
    documentationState: "documented",
    format: "json",
    full: false,
    identifiers: [],
  };

  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) {
      options.identifiers.push(flag);
      continue;
    }
    if (flag === "--full") {
      options.full = true;
      continue;
    }
    if (flag === "--help") {
      options.command = "help";
      continue;
    }

    const value = takeValue(argv, index, flag);
    index += 1;
    if (flag === "--data") options.data = value;
    else if (flag === "--format") {
      assertChoice(value, FORMATS, flag);
      options.format = value;
    } else if (flag === "--modality") {
      assertChoice(value, MODALITIES, flag);
      options.modality = value;
    } else if (flag === "--documentation-state") {
      assertChoice(value, DOCUMENTATION_STATES, flag);
      options.documentationState = value;
    } else if (flag === "--lab") options.lab = value;
    else if (flag === "--status") options.status = value;
    else if (flag === "--pricing-state") {
      assertChoice(value, PRICING_STATES, flag);
      options.pricingState = value;
    } else if (flag === "--task") options.task = value;
    else if (flag === "--aspect-ratio") options.aspectRatio = value;
    else if (flag === "--max-duration-at-least") {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error(`${flag} must be a non-negative number`);
      }
      options.maxDurationAtLeast = seconds;
    } else if (flag === "--native-audio") {
      assertChoice(value, CLAIM_STATES, flag);
      options.nativeAudio = value;
    } else if (flag === "--reference-role") options.referenceRole = value;
    else if (flag === "--search") options.search = value;
    else if (flag === "--limit") {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`${flag} must be a positive integer`);
      }
      options.limit = limit;
    } else {
      throw new Error(`Unknown option: ${flag}`);
    }
  }

  return options;
}

function findRecord(records, identifier) {
  const exact = records.find((record) => record.model.id === identifier);
  if (exact) return exact;
  const folded = identifier.toLocaleLowerCase();
  const matches = records.filter((record) =>
    [
      record.model.name,
      ...(record.model.aliases ?? []),
      ...(record.api_identifiers ?? []).map(({ value }) => value),
    ].some((value) => value.toLocaleLowerCase() === folded),
  );
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous model identifier ${JSON.stringify(identifier)}: ${matches
        .map((record) => record.model.id)
        .join(", ")}`,
    );
  }
  if (matches.length === 0) {
    throw new Error(`Model not found: ${identifier}`);
  }
  return matches[0];
}

function printTable(records) {
  console.table(
    records.map((record) => ({
      id: record.model.id,
      name: record.model.name,
      lab: record.model.lab,
      modality: record.model.modality,
      documentation: record.documentation_state,
      verification: record.verification?.state ?? "legacy seed: unspecified",
      pricing: record.pricing.state,
    })),
  );
}

function usage() {
  return `Modelsheet local registry query

Usage:
  query.mjs counts [--data path]
  query.mjs list [filters] [--full] [--format json|table]
  query.mjs show <id-or-alias> [--data path]
  query.mjs compare <id-or-alias> <id-or-alias> [...] [--data path]

Selection filters:
  --modality audio|image|video
  --documentation-state documented|indexed|any (default: documented)
  --lab <text> --status <state> --pricing-state known|partial|unknown
  --task <task> --aspect-ratio <ratio> --max-duration-at-least <seconds>
  --native-audio supported|unsupported|not_applicable|unknown
  --reference-role <role> --search <text> --limit <positive integer>`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.command === "help") {
    console.log(usage());
    return;
  }

  const dataFile = await findDataFile(options.data);
  const registry = await loadRegistry(dataFile);

  if (options.command === "counts") {
    console.log(JSON.stringify(registry.counts, null, 2));
    return;
  }

  if (options.command === "show") {
    if (options.identifiers.length !== 1) {
      throw new Error("show requires exactly one model ID, name, alias, or API ID");
    }
    console.log(
      JSON.stringify(findRecord(registry.models, options.identifiers[0]), null, 2),
    );
    return;
  }

  if (options.command === "compare") {
    if (options.identifiers.length < 2) {
      throw new Error("compare requires at least two model identifiers");
    }
    console.log(
      JSON.stringify(
        options.identifiers.map((identifier) =>
          findRecord(registry.models, identifier),
        ),
        null,
        2,
      ),
    );
    return;
  }

  let records = filterRecords(registry.models, options).sort((left, right) =>
    compareStrings(left.model.id, right.model.id),
  );
  if (options.limit) records = records.slice(0, options.limit);

  if (options.format === "table") {
    printTable(records);
    return;
  }

  const result = options.full
    ? records
    : records.map((record) => summarizeRecord(record, options));
  console.log(JSON.stringify({ count: result.length, models: result }, null, 2));
}

const isCommandLine =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCommandLine) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
